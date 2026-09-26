import { db } from './db';
import { packBackupBinary, unpackBackupBinary } from './binaryCodec';

export type SyncMode = 'standalone' | 'lan' | 'usb';
export type LanRole = 'server' | 'client';
export type UsbRole = 'server' | 'client';

export interface LanServerStatus {
  running: boolean;
  port: number;
  ip: string;
  has_pin: boolean;
  client_count: number;
  db_hash?: string;
  shutdown_alert?: boolean;
}

export interface SyncConfig {
  mode: SyncMode;
  lan: {
    role: LanRole;
    port: number;
    pin: string;
    serverUrl: string;
    autoSyncInterval: number; // en secondes (30 par defaut)
  };
  usb: {
    role: UsbRole;
    filePath: string;
    autoSyncOnClose: boolean;
  };
}

const DEFAULT_SYNC_CONFIG: SyncConfig = {
  mode: 'standalone',
  lan: {
    role: 'server',
    port: 4123,
    pin: '',
    serverUrl: 'http://192.168.1.50:4123',
    autoSyncInterval: 30
  },
  usb: {
    role: 'server',
    filePath: '',
    autoSyncOnClose: true
  }
};

const SYNC_STORAGE_KEY = 'openmdl_sync_settings';

export class SyncService {
  private static instance: SyncService;
  private config: SyncConfig;
  private autoSyncTimer: any = null;
  private listeners: Set<(config: SyncConfig, status: string) => void> = new Set();
  private shutdownListeners: Set<(message: string) => void> = new Set();

  public currentStatus: 'idle' | 'syncing' | 'success' | 'error' = 'idle';
  public lastSyncTime: string | null = null;
  public lastSyncMessage: string = '';
  public cachedLocalIp: string = '127.0.0.1';
  public cachedServerStatus: LanServerStatus | null = null;

  public isServerReachable: boolean = true;
  public lastSyncedDbHash: string = localStorage.getItem('openmdl_synced_db_hash') || '';
  public lastRemoteDbHash: string = '';
  public shutdownAlertActive: boolean = false;
  public shutdownAlertMessage: string = '';

  private constructor() {
    this.config = this.loadConfig();
    this.initMode();
    this.getLocalIp().then(ip => {
      this.cachedLocalIp = ip;
    }).catch(() => {});
  }

  public static getInstance(): SyncService {
    if (!SyncService.instance) {
      SyncService.instance = new SyncService();
    }
    return SyncService.instance;
  }

  public getConfig(): SyncConfig {
    return { ...this.config };
  }

  public subscribe(callback: (config: SyncConfig, status: string) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  public onShutdownAlert(callback: (message: string) => void): () => void {
    this.shutdownListeners.add(callback);
    return () => this.shutdownListeners.delete(callback);
  }

  private notify(statusMsg: string): void {
    this.listeners.forEach(fn => fn(this.config, statusMsg));
  }

  public loadConfig(): SyncConfig {
    try {
      const stored = localStorage.getItem(SYNC_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          ...DEFAULT_SYNC_CONFIG,
          ...parsed,
          lan: { ...DEFAULT_SYNC_CONFIG.lan, ...(parsed.lan || {}) },
          usb: { ...DEFAULT_SYNC_CONFIG.usb, ...(parsed.usb || {}) }
        };
      }
    } catch {
      // Ignorer
    }
    return { ...DEFAULT_SYNC_CONFIG };
  }

  public async saveConfig(newConfig: Partial<SyncConfig>): Promise<void> {
    this.config = {
      ...this.config,
      ...newConfig,
      lan: { ...this.config.lan, ...(newConfig.lan || {}) },
      usb: { ...this.config.usb, ...(newConfig.usb || {}) }
    };

    localStorage.setItem(SYNC_STORAGE_KEY, JSON.stringify(this.config));
    await this.initMode();
    this.notify('Configuration enregistree.');
  }

  public async initMode(): Promise<void> {
    this.stopAutoSyncTimer();

    if (this.config.mode === 'lan') {
      if (this.config.lan.role === 'server') {
        await this.startLanServer();
      } else {
        await this.stopLanServer();
        this.startAutoSyncTimer();
      }
    } else {
      await this.stopLanServer();
    }
  }

  // --- Serveur LAN ---

  public async startLanServer(): Promise<LanServerStatus | null> {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const dbJson = JSON.stringify(db.exportData());
      const status = await invoke<LanServerStatus>('start_lan_server', {
        port: Number(this.config.lan.port) || 4123,
        pin: this.config.lan.pin.trim() ? this.config.lan.pin.trim() : null,
        dbJson
      });
      this.cachedServerStatus = status;
      this.cachedLocalIp = status.ip;
      this.currentStatus = 'success';
      this.lastSyncMessage = `Serveur LAN actif sur ${status.ip}:${status.port}`;
      this.notify(this.lastSyncMessage);
      return status;
    } catch (err) {
      console.warn('Erreur demarrage serveur LAN :', err);
      this.cachedServerStatus = null;
      this.currentStatus = 'error';
      this.lastSyncMessage = 'Impossible de demarrer le serveur LAN : ' + String(err);
      this.notify(this.lastSyncMessage);
      return null;
    }
  }

  public async stopLanServer(): Promise<void> {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('stop_lan_server');
      this.cachedServerStatus = null;
      this.lastSyncMessage = 'Serveur LAN arrete';
      this.notify(this.lastSyncMessage);
    } catch {
      this.cachedServerStatus = null;
    }
  }

  public async getLanServerStatus(): Promise<LanServerStatus | null> {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const status = await invoke<LanServerStatus>('get_lan_server_info');
      this.cachedServerStatus = status;
      if (status && status.ip) {
        this.cachedLocalIp = status.ip;
      }
      return status;
    } catch {
      return null;
    }
  }

  public async getLocalIp(): Promise<string> {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke<string>('get_local_ip');
    } catch {
      return '127.0.0.1';
    }
  }

  public async notifyLocalDbChanged(): Promise<void> {
    if (this.config.mode === 'lan' && this.config.lan.role === 'server') {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const dbJson = JSON.stringify(db.exportData());
        await invoke('update_lan_server_db', { dbJson });
      } catch {
        // Ignorer
      }
    }
  }

  public async broadcastShutdownAlert(message?: string): Promise<void> {
    const msg = message || 'La permanence du foyer se termine. Le poste va devenir inaccessible.';
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('broadcast_lan_shutdown_alert', { message: msg });
    } catch {
      const targetUrl = `http://127.0.0.1:${this.config.lan.port || 4123}`;
      fetch(`${targetUrl}/api/shutdown_alert`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: msg
      }).catch(() => {});
    }
    this.notify('Alerte de fermeture diffusee aux postes clients.');
  }

  public async clearShutdownAlert(): Promise<void> {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('clear_lan_shutdown_alert');
    } catch {
      // Ignorer
    }
  }

  // --- Client LAN & Synchronisation intelligente 30s par empreinte de hash ---

  public async testLanConnection(url?: string, pin?: string): Promise<{ success: boolean; message: string; info?: any }> {
    const targetUrl = (url || this.config.lan.serverUrl).replace(/\/+$/, '');
    const targetPin = pin !== undefined ? pin : this.config.lan.pin;

    try {
      const res = await fetch(`${targetUrl}/api/ping`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(4000)
      });

      if (!res.ok) {
        return { success: false, message: `Reponse serveur invalide (${res.status} ${res.statusText})` };
      }

      const pingData = await res.json();

      // Test de lecture securisee si un PIN est requis
      const dbRes = await fetch(`${targetUrl}/api/db`, {
        method: 'GET',
        headers: {
          'X-Pin': targetPin || '',
          'Content-Type': 'application/json'
        },
        signal: AbortSignal.timeout(4000)
      });

      if (dbRes.status === 401) {
        return { success: false, message: 'Code PIN incorrect ou refuse par le serveur de caisse.' };
      }

      return {
        success: true,
        message: `Connexion reussie avec le serveur OpenMDL (${pingData.name || 'Caisse Foyer'})`,
        info: pingData
      };
    } catch (err: any) {
      return { success: false, message: 'Hote inaccessible : ' + (err.message || String(err)) };
    }
  }

  public async checkHashAndSync(): Promise<{ synced: boolean; reachable: boolean; message: string }> {
    if (this.config.mode !== 'lan' || this.config.lan.role !== 'client') {
      return { synced: false, reachable: false, message: 'Mode Client LAN inactif' };
    }

    const targetUrl = this.config.lan.serverUrl.replace(/\/+$/, '');

    try {
      const res = await fetch(`${targetUrl}/api/ping`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(3500)
      });

      if (!res.ok) {
        throw new Error(`Reponse serveur HTTP ${res.status}`);
      }

      const pingData = await res.json();
      this.isServerReachable = true;

      // 1. Alerte de fin de permanence diffusee par le Foyer
      if (pingData.shutdown_alert && !this.shutdownAlertActive) {
        this.shutdownAlertActive = true;
        this.shutdownAlertMessage = pingData.shutdown_message || 'La permanence du foyer se termine. Le poste va devenir inaccessible.';
        
        // Alerte visuelle pour l'utilisateur
        this.shutdownListeners.forEach(cb => cb(this.shutdownAlertMessage));

        // Telechargement immediat et inconditionnel de la base finale
        await this.syncFromLanServer();
        this.notify('Alerte Foyer : Copie finale de la base de donnees telechargee avec succes !');
        return { synced: true, reachable: true, message: 'Base finale telechargee avec succes.' };
      } else if (!pingData.shutdown_alert) {
        this.shutdownAlertActive = false;
      }

      // 2. Verification de l'empreinte hash de la base de donnees
      const remoteHash = pingData.db_hash || '';
      this.lastRemoteDbHash = remoteHash;

      if (remoteHash && remoteHash !== this.lastSyncedDbHash) {
        // Le hash distant differe : nouvelle vente ou nouvelle decaisse, on telecharge !
        const syncRes = await this.syncFromLanServer();
        if (syncRes.success) {
          this.lastSyncedDbHash = remoteHash;
          localStorage.setItem('openmdl_synced_db_hash', remoteHash);
          return { synced: true, reachable: true, message: 'Base de donnees synchronisee suite a modification.' };
        }
      } else {
        // Hash identique : aucune bande passante gaspillee, copie locale deja a jour
        this.currentStatus = 'success';
        this.lastSyncTime = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        this.lastSyncMessage = `Donnees synchronisees (empreinte verifiee a ${this.lastSyncTime})`;
        this.notify(this.lastSyncMessage);
        return { synced: false, reachable: true, message: this.lastSyncMessage };
      }

      return { synced: false, reachable: true, message: 'Verification achevee.' };
    } catch (err: any) {
      // Le serveur Foyer est eteint : LE CLIENT CONSERVE TOUTES SES DONNEES LOCALES SANS RIEN SUPPRIMER
      this.isServerReachable = false;
      this.currentStatus = 'idle';
      this.lastSyncMessage = 'Poste Foyer eteint / inaccessible. Consultation active sur la replique locale securisee.';
      this.notify(this.lastSyncMessage);
      return { synced: false, reachable: false, message: this.lastSyncMessage };
    }
  }

  public async syncFromLanServer(): Promise<{ success: boolean; message: string }> {
    if (this.config.mode !== 'lan' || this.config.lan.role !== 'client') {
      return { success: false, message: 'Le mode Client LAN n\'est pas active.' };
    }

    const targetUrl = this.config.lan.serverUrl.replace(/\/+$/, '');
    this.currentStatus = 'syncing';
    this.notify('Synchronisation en cours...');

    try {
      const res = await fetch(`${targetUrl}/api/db`, {
        method: 'GET',
        headers: {
          'X-Pin': this.config.lan.pin || '',
          'Content-Type': 'application/json'
        },
        signal: AbortSignal.timeout(6000)
      });

      if (res.status === 401) {
        throw new Error('Code PIN invalide.');
      }

      if (!res.ok) {
        throw new Error(`Erreur serveur (${res.status} ${res.statusText})`);
      }

      const remoteHashHeader = res.headers.get('X-DB-Hash');
      const remoteData = await res.json();
      if (!remoteData || typeof remoteData !== 'object' || !Array.isArray(remoteData.products)) {
        throw new Error('Donnees recues invalides ou corrompues.');
      }

      db.importData(remoteData);

      if (remoteHashHeader) {
        this.lastSyncedDbHash = remoteHashHeader;
        localStorage.setItem('openmdl_synced_db_hash', remoteHashHeader);
      }

      this.currentStatus = 'success';
      this.isServerReachable = true;
      this.lastSyncTime = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      this.lastSyncMessage = `Replique mise a jour a ${this.lastSyncTime}`;
      this.notify(this.lastSyncMessage);

      return { success: true, message: this.lastSyncMessage };
    } catch (err: any) {
      this.currentStatus = 'error';
      this.lastSyncMessage = 'Echec de synchronisation : ' + (err.message || String(err));
      this.notify(this.lastSyncMessage);
      return { success: false, message: this.lastSyncMessage };
    }
  }

  private startAutoSyncTimer(): void {
    this.stopAutoSyncTimer();
    const intervalSec = Number(this.config.lan.autoSyncInterval) || 30;
    if (intervalSec > 0 && this.config.mode === 'lan' && this.config.lan.role === 'client') {
      // Verification initiale immediate
      this.checkHashAndSync();
      // Verification recurrente toutes les 30 secondes
      this.autoSyncTimer = setInterval(() => {
        this.checkHashAndSync();
      }, intervalSec * 1000);
    }
  }

  private stopAutoSyncTimer(): void {
    if (this.autoSyncTimer) {
      clearInterval(this.autoSyncTimer);
      this.autoSyncTimer = null;
    }
  }

  // --- Clé USB / Fichier partagé ---

  public async exportToUsbFile(customPath?: string): Promise<{ success: boolean; message: string }> {
    let path = (customPath || this.config.usb.filePath || '').trim();
    if (!path) {
      return { success: false, message: 'Aucun chemin de fichier renseigne pour la cle USB.' };
    }

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const isJson = path.toLowerCase().endsWith('.json');
      const data = db.exportData();

      if (isJson) {
        const dbJson = JSON.stringify(data, null, 2);
        await invoke('write_file_to_path', { filePath: path, content: dbJson });
      } else {
        if (!path.toLowerCase().endsWith('.mdlb')) {
          path = `${path}.mdlb`;
        }
        const binaryBytes = await packBackupBinary(data);
        await invoke('write_binary_file', { filePath: path, bytes: Array.from(binaryBytes) });
      }

      this.lastSyncTime = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      this.lastSyncMessage = `Sauvegarde exportee sur la cle USB (${this.lastSyncTime})`;
      this.currentStatus = 'success';
      this.notify(this.lastSyncMessage);

      return { success: true, message: this.lastSyncMessage };
    } catch (err: any) {
      this.currentStatus = 'error';
      this.lastSyncMessage = 'Erreur ecriture cle USB : ' + (err.message || String(err));
      this.notify(this.lastSyncMessage);
      return { success: false, message: this.lastSyncMessage };
    }
  }

  public async importFromUsbFile(customPath?: string): Promise<{ success: boolean; message: string }> {
    const path = (customPath || this.config.usb.filePath || '').trim();
    if (!path) {
      return { success: false, message: 'Aucun chemin de fichier renseigne pour la cle USB.' };
    }

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const bytes = await invoke<number[]>('read_binary_file', { filePath: path });
      const data = await unpackBackupBinary(new Uint8Array(bytes));

      if (!data || typeof data !== 'object' || !Array.isArray(data.products)) {
        throw new Error('Fichier de sauvegarde USB non valide ou corrompu.');
      }

      db.importData(data);

      this.lastSyncTime = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      this.lastSyncMessage = `Donnees rechargees depuis la cle USB (${this.lastSyncTime})`;
      this.currentStatus = 'success';
      this.notify(this.lastSyncMessage);

      return { success: true, message: this.lastSyncMessage };
    } catch (err: any) {
      this.currentStatus = 'error';
      this.lastSyncMessage = 'Erreur lecture cle USB : ' + (err.message || String(err));
      this.notify(this.lastSyncMessage);
      return { success: false, message: this.lastSyncMessage };
    }
  }
}

export const syncService = SyncService.getInstance();
