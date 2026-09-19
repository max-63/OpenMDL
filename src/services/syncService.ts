import { db } from './db';

export type SyncMode = 'standalone' | 'lan' | 'usb';
export type LanRole = 'server' | 'client';
export type UsbRole = 'server' | 'client';

export interface LanServerStatus {
  running: boolean;
  port: number;
  ip: string;
  has_pin: boolean;
  client_count: number;
}

export interface SyncConfig {
  mode: SyncMode;
  lan: {
    role: LanRole;
    port: number;
    pin: string;
    serverUrl: string;
    autoSyncInterval: number; // en secondes (0 = desactive)
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
    autoSyncInterval: 15
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
  public currentStatus: 'idle' | 'syncing' | 'success' | 'error' = 'idle';
  public lastSyncTime: string | null = null;
  public lastSyncMessage: string = '';
  public cachedLocalIp: string = '127.0.0.1';
  public cachedServerStatus: LanServerStatus | null = null;

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

  // --- Client LAN ---

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

      const remoteData = await res.json();
      if (!remoteData || typeof remoteData !== 'object' || !Array.isArray(remoteData.products)) {
        throw new Error('Donnees recues invalides ou corrompues.');
      }

      db.importData(remoteData);

      this.currentStatus = 'success';
      this.lastSyncTime = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      this.lastSyncMessage = `Synchronise avec succes a ${this.lastSyncTime}`;
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
    const intervalSec = Number(this.config.lan.autoSyncInterval);
    if (intervalSec > 0 && this.config.mode === 'lan' && this.config.lan.role === 'client') {
      this.autoSyncTimer = setInterval(() => {
        this.syncFromLanServer();
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
    const path = customPath || this.config.usb.filePath;
    if (!path || !path.trim()) {
      return { success: false, message: 'Aucun chemin de fichier renseigne pour la cle USB.' };
    }

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const dbJson = JSON.stringify(db.exportData(), null, 2);
      await invoke('write_file_to_path', { filePath: path.trim(), content: dbJson });

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
    const path = customPath || this.config.usb.filePath;
    if (!path || !path.trim()) {
      return { success: false, message: 'Aucun chemin de fichier renseigne pour la cle USB.' };
    }

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const content = await invoke<string>('read_file_from_path', { filePath: path.trim() });
      const data = JSON.parse(content);

      if (!data || typeof data !== 'object' || !Array.isArray(data.products)) {
        throw new Error('Fichier USB invalide.');
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
