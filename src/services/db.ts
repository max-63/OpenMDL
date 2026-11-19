import type {
  Product,
  Sale,
  Session,
  Volunteer,
  RestockLog,
  VolunteerPerk,
  ProductStockEvolution,
  TpeSettings,
  TpePaymentLog,
  SnakeScore,
  PacmanScore,
  PerkSettings,
  PerkEligibilityRule,
  CashFloatSettings,
  SessionCashWithdrawal,
  EnrichedCashWithdrawal,
  AppProfile,
  DrawerCashState,
  ChatMessage,
  ChatChannel,
  ChatSettings,
  VolunteerThemeSettings,
  DatabaseConnectionConfig,
  ExternalDatabaseConfig,
  UserPermissions,
  VolunteerPerkPolicy,
  VolunteerPerkMode
} from '../types';
import { resolveVolunteerPermissions } from '../types/index.ts';

import {
  computeCrc32Hex,
  EURO_DENOMINATIONS,
  decomposeCashAmount,
  STORAGE_KEYS,
  DEFAULT_DATABASE_CONFIG,
  DEFAULT_CHAT_SETTINGS,
  DEFAULT_PERK_SETTINGS,
  DEFAULT_CASH_FLOAT_SETTINGS,
  DEFAULT_TPE_SETTINGS,
  INITIAL_PRODUCTS,
  INITIAL_VOLUNTEERS,
  DEMO_PRODUCTS,
  type ActivityLog
} from './db/constants.ts';

import { storageService } from './db/storageService.ts';
import { catalogService } from './db/catalogService.ts';
import { cashService } from './db/cashService.ts';
import { chatService } from './db/chatService.ts';
import { perkService } from './db/perkService.ts';
import { volunteerService } from './db/volunteerService.ts';
import { backupService } from './db/backupService.ts';
import { demoDataService } from './db/demoDataService.ts';
import { externalDbService } from './db/externalDbService.ts';

export {
  computeCrc32Hex,
  DEFAULT_DATABASE_CONFIG,
  DEFAULT_CHAT_SETTINGS,
  DEFAULT_PERK_SETTINGS,
  DEFAULT_CASH_FLOAT_SETTINGS,
  type ActivityLog
};

export class DatabaseService {
  private products: Product[] = [];
  private sales: Sale[] = [];
  private sessions: Session[] = [];
  private volunteers: Volunteer[] = [];
  private restocks: RestockLog[] = [];
  private logs: ActivityLog[] = [];
  private volunteerPerks: VolunteerPerk[] = [];
  private perkSettings: PerkSettings = { ...DEFAULT_PERK_SETTINGS };
  private cashFloatSettings: CashFloatSettings = { ...DEFAULT_CASH_FLOAT_SETTINGS };
  private tpeSettings: TpeSettings = { ...DEFAULT_TPE_SETTINGS };
  private tpeLogs: TpePaymentLog[] = [];
  private snakeScores: SnakeScore[] = [];
  private activeSession: Session | null = null;
  private currentVolunteer: Volunteer | null = null;
  private chatMessages: ChatMessage[] = [];
  private chatChannels: ChatChannel[] = [];
  private chatSettings: ChatSettings = { ...DEFAULT_CHAT_SETTINGS };
  private databaseConfig: DatabaseConnectionConfig = {
    ...DEFAULT_DATABASE_CONFIG,
    external: { ...DEFAULT_DATABASE_CONFIG.external! }
  };
  private listeners: Set<() => void> = new Set();
  private suppressExternalSync = false;

  constructor() {
    this.loadAll();
  }

  private dispatchExternalOp(opType: string, payload: unknown): void {
    if (this.suppressExternalSync || !externalDbService.isExternalEnabled(this.databaseConfig)) {
      return;
    }

    void externalDbService.executeOp(this.databaseConfig, opType, payload, (statusUpdate) => {
      const prevStatus = this.databaseConfig.status;
      const prevPending = this.databaseConfig.pendingOpsCount || 0;
      const prevError = this.databaseConfig.lastError;

      this.databaseConfig = {
        ...this.databaseConfig,
        status: statusUpdate.status,
        pendingOpsCount: statusUpdate.pendingOpsCount,
        lastError: statusUpdate.lastError,
        lastPing: statusUpdate.status === 'connected'
          ? new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
          : this.databaseConfig.lastPing
      };
      storageService.safeSetItem(STORAGE_KEYS.DATABASE_CONFIG, JSON.stringify(this.databaseConfig));

      if (
        prevStatus !== this.databaseConfig.status ||
        prevPending !== (this.databaseConfig.pendingOpsCount || 0) ||
        prevError !== this.databaseConfig.lastError
      ) {
        this.notify();
      }
    });
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach(fn => fn());
  }

  private onDbChanged(): void {
    import('./syncService').then(m => m.syncService.notifyLocalDbChanged()).catch(() => {});
  }

  public cleanLocalStorageQuota(): void {
    storageService.cleanLocalStorageQuota({
      logs: this.logs,
      tpeLogs: this.tpeLogs,
      chatMessages: this.chatMessages
    });
  }

  public async initSqlitePersistence(): Promise<void> {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const allEntries = await invoke<Array<[string, string]>>('sqlite_get_all');
      if (allEntries && allEntries.length > 0) {
        let changed = false;
        for (const [k, v] of allEntries) {
          try {
            if (!v) continue;
            if (k === STORAGE_KEYS.PRODUCTS) {
              this.products = JSON.parse(v);
              storageService.setLocalCacheOnly(k, v);
              changed = true;
            } else if (k === STORAGE_KEYS.SALES) {
              this.sales = JSON.parse(v);
              storageService.setLocalCacheOnly(k, v);
              changed = true;
            } else if (k === STORAGE_KEYS.SESSIONS) {
              this.sessions = JSON.parse(v);
              storageService.setLocalCacheOnly(k, v);
              changed = true;
            } else if (k === STORAGE_KEYS.VOLUNTEERS) {
              this.volunteers = JSON.parse(v);
              storageService.setLocalCacheOnly(k, v);
              changed = true;
            } else if (k === STORAGE_KEYS.RESTOCKS) {
              this.restocks = JSON.parse(v);
              storageService.setLocalCacheOnly(k, v);
              changed = true;
            } else if (k === STORAGE_KEYS.LOGS) {
              this.logs = JSON.parse(v);
              storageService.setLocalCacheOnly(k, v);
              changed = true;
            } else if (k === STORAGE_KEYS.PERKS) {
              this.volunteerPerks = JSON.parse(v);
              storageService.setLocalCacheOnly(k, v);
              changed = true;
            } else if (k === STORAGE_KEYS.CASH_FLOAT_SETTINGS) {
              this.cashFloatSettings = { ...DEFAULT_CASH_FLOAT_SETTINGS, ...JSON.parse(v) };
              storageService.setLocalCacheOnly(k, v);
              changed = true;
            } else if (k === STORAGE_KEYS.PERK_SETTINGS) {
              this.perkSettings = { ...DEFAULT_PERK_SETTINGS, ...JSON.parse(v) };
              storageService.setLocalCacheOnly(k, v);
              changed = true;
            } else if (k === STORAGE_KEYS.TPE_SETTINGS) {
              this.tpeSettings = { ...DEFAULT_TPE_SETTINGS, ...JSON.parse(v) };
              storageService.setLocalCacheOnly(k, v);
              changed = true;
            } else if (k === STORAGE_KEYS.TPE_LOGS) {
              this.tpeLogs = JSON.parse(v);
              storageService.setLocalCacheOnly(k, v);
              changed = true;
            } else if (k === STORAGE_KEYS.PACMAN_SCORES) {
              const parsed = JSON.parse(v);
              if (Array.isArray(parsed)) {
                this.snakeScores = parsed;
                storageService.setLocalCacheOnly(k, v);
                changed = true;
              }
            } else if (k === STORAGE_KEYS.ACTIVE_SESSION) {
              this.activeSession = JSON.parse(v);
              if (this.activeSession) {
                this.currentVolunteer = this.volunteers.find(vol => vol.id === this.activeSession?.volunteerId) || this.currentVolunteer;
              }
              storageService.setLocalCacheOnly(k, v);
              changed = true;
            } else if (k === STORAGE_KEYS.DATABASE_CONFIG) {
              const parsed = JSON.parse(v);
              this.databaseConfig = {
                ...DEFAULT_DATABASE_CONFIG,
                ...parsed,
                external: { ...DEFAULT_DATABASE_CONFIG.external!, ...(parsed.external || {}) }
              };
              storageService.setLocalCacheOnly(k, v);
              changed = true;
            } else if (k === STORAGE_KEYS.CHAT_SETTINGS) {
              this.chatSettings = { ...DEFAULT_CHAT_SETTINGS, ...JSON.parse(v) };
              storageService.setLocalCacheOnly(k, v);
              changed = true;
            } else if (k === STORAGE_KEYS.CHAT_CHANNELS) {
              this.chatChannels = JSON.parse(v);
              storageService.setLocalCacheOnly(k, v);
              changed = true;
            } else if (k === STORAGE_KEYS.CHAT_MESSAGES) {
              const msgs = JSON.parse(v);
              if (Array.isArray(msgs) && msgs.length > 0) {
                this.chatMessages = msgs;
                storageService.setLocalCacheOnly(k, v);
                changed = true;
              }
            } else if (k === STORAGE_KEYS.APP_PROFILE) {
              storageService.setLocalCacheOnly(k, v);
              changed = true;
            }
          } catch {}
        }

        try {
          const sqliteChatMsgs = await invoke<ChatMessage[]>('sqlite_get_chat_messages', { channelId: null });
          if (sqliteChatMsgs && sqliteChatMsgs.length > 0) {
            this.chatMessages = sqliteChatMsgs;
            storageService.setLocalCacheOnly(STORAGE_KEYS.CHAT_MESSAGES, JSON.stringify(sqliteChatMsgs));
            changed = true;
          } else if (this.chatMessages.length > 0) {
            for (const msg of this.chatMessages) {
              await invoke('sqlite_save_chat_message', {
                id: msg.id,
                channelId: msg.channelId,
                authorId: msg.authorId,
                authorName: msg.authorName,
                authorRole: msg.authorRole,
                authorAvatarColor: msg.authorAvatarColor || null,
                authorBubbleColor: msg.authorBubbleColor || null,
                content: msg.content,
                timestamp: msg.timestamp,
                signature: msg.signature
              }).catch(() => {});
            }
          }
        } catch {}

        if (changed) {
          this.notify();
        }
      } else {
        this.saveProducts();
        this.saveSales();
        this.saveSessions();
        this.saveVolunteers();
        this.saveRestocks();
        this.saveLogs();
        this.saveVolunteerPerks();
        this.saveCashFloatSettings();
        this.savePerkSettings();
        this.saveTpeSettings();
        this.saveTpeLogs();
        this.saveSnakeScores();
        this.saveChatChannels();
        storageService.safeSetItem(STORAGE_KEYS.CHAT_SETTINGS, JSON.stringify(this.chatSettings));
        storageService.safeSetItem(STORAGE_KEYS.DATABASE_CONFIG, JSON.stringify(this.databaseConfig));
        storageService.safeSetItem(STORAGE_KEYS.APP_PROFILE, this.getAppProfile());
        this.saveChatMessages();
      }

      if (externalDbService.isExternalEnabled(this.databaseConfig)) {
        await this.syncFromExternalDatabase();
        this.configureExternalAutoSync();
      }
    } catch {}
  }

  private loadAll(): void {
    if (typeof localStorage === 'undefined') {
      this.products = INITIAL_PRODUCTS;
      this.volunteers = INITIAL_VOLUNTEERS;
      return;
    }

    this.cleanLocalStorageQuota();
    try {
      const storedProds = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
      this.products = storedProds ? JSON.parse(storedProds) : INITIAL_PRODUCTS;

      let prodsMigrated = false;
      this.products = this.products.map(p => {
        const match = DEMO_PRODUCTS.find(dp => dp.id === p.id || dp.name.trim().toLowerCase() === p.name.trim().toLowerCase());
        if (match && p.imageUrl !== match.imageUrl) {
          prodsMigrated = true;
          return { ...p, imageUrl: match.imageUrl };
        }
        return p;
      });
      if (prodsMigrated) {
        this.saveProducts();
      }

      const storedSales = localStorage.getItem(STORAGE_KEYS.SALES);
      this.sales = storedSales ? JSON.parse(storedSales) : [];

      const storedSessions = localStorage.getItem(STORAGE_KEYS.SESSIONS);
      this.sessions = storedSessions ? JSON.parse(storedSessions) : [];
      if (this.sessions.length < 5) {
        this.seedDemoSessions();
      }

      const storedVolunteers = localStorage.getItem(STORAGE_KEYS.VOLUNTEERS);
      let parsedVolunteers: Volunteer[] = storedVolunteers ? JSON.parse(storedVolunteers) : INITIAL_VOLUNTEERS;

      const adminExists = parsedVolunteers.some(v => v.username === 'admin');
      if (!adminExists) {
        parsedVolunteers.unshift({
          id: 'vol-admin',
          username: 'admin',
          password: 'admin',
          name: 'Administrateur',
          role: 'Administrateur',
          avatarColor: '#ea580c',
          isAdmin: true,
          isSuspended: false,
          createdAt: new Date().toISOString()
        });
      }

      parsedVolunteers = parsedVolunteers.map(v => ({
        ...v,
        username: v.username || (v.id === 'vol-1' ? 'admin' : v.name.toLowerCase().replace(/[^a-z0-9]/g, '')),
        password: v.password || (v.username === 'admin' ? 'admin' : 'password123'),
        isAdmin: v.isAdmin ?? (v.username === 'admin' || v.role.includes('Bureau') || v.role.includes('Admin') || v.role.includes('CVL')),
        isSuspended: v.isSuspended ?? false,
        createdAt: v.createdAt || new Date().toISOString()
      }));

      this.volunteers = parsedVolunteers;

      const storedRestocks = localStorage.getItem(STORAGE_KEYS.RESTOCKS);
      this.restocks = storedRestocks ? JSON.parse(storedRestocks) : [];

      const storedLogs = localStorage.getItem(STORAGE_KEYS.LOGS);
      this.logs = storedLogs ? JSON.parse(storedLogs) : [];

      const storedPerks = localStorage.getItem(STORAGE_KEYS.PERKS);
      this.volunteerPerks = storedPerks ? JSON.parse(storedPerks) : [];

      const storedPerkSettings = localStorage.getItem(STORAGE_KEYS.PERK_SETTINGS);
      this.perkSettings = storedPerkSettings
        ? { ...DEFAULT_PERK_SETTINGS, ...JSON.parse(storedPerkSettings) }
        : { ...DEFAULT_PERK_SETTINGS };

      const storedCashFloat = localStorage.getItem(STORAGE_KEYS.CASH_FLOAT_SETTINGS);
      if (storedCashFloat) {
        try {
          const parsed = JSON.parse(storedCashFloat);
          this.cashFloatSettings = {
            ...DEFAULT_CASH_FLOAT_SETTINGS,
            ...parsed,
            baseCounts: { ...DEFAULT_CASH_FLOAT_SETTINGS.baseCounts, ...(parsed.baseCounts || {}) },
            lastRemainingCounts: parsed.lastRemainingCounts || {},
            carriedOverDifferences: parsed.carriedOverDifferences || {}
          };
        } catch {
          this.cashFloatSettings = { ...DEFAULT_CASH_FLOAT_SETTINGS };
        }
      }

      const storedTpe = localStorage.getItem(STORAGE_KEYS.TPE_SETTINGS);
      this.tpeSettings = storedTpe ? JSON.parse(storedTpe) : DEFAULT_TPE_SETTINGS;

      const storedTpeLogs = localStorage.getItem(STORAGE_KEYS.TPE_LOGS);
      this.tpeLogs = storedTpeLogs ? JSON.parse(storedTpeLogs) : [];

      localStorage.removeItem(STORAGE_KEYS.SNAKE_SCORES);
      const storedPacman = localStorage.getItem(STORAGE_KEYS.PACMAN_SCORES);
      if (storedPacman) {
        try {
          const parsed = JSON.parse(storedPacman);
          const fakeNames = ['jérémy', 'jeremy', 'thomas m.', 'thomas'];
          this.snakeScores = Array.isArray(parsed)
            ? parsed.filter((s: any) =>
              s && typeof s === 'object' &&
              s.playerName &&
              !fakeNames.includes(String(s.playerName).toLowerCase().trim()) &&
              !['s1', 's2', 's3'].includes(s.id) &&
              !(s.score === 140 && String(s.playerName).includes('Jér')) &&
              !(s.score === 90 && String(s.playerName).includes('Thom')) &&
              !(s.score === 80 && String(s.playerName).includes('Adri'))
            )
            : [];
        } catch {
          this.snakeScores = [];
        }
      } else {
        this.snakeScores = [];
      }
      this.saveSnakeScores();

      const storedActive = localStorage.getItem(STORAGE_KEYS.ACTIVE_SESSION);
      if (storedActive) {
        this.activeSession = JSON.parse(storedActive);
        if (this.activeSession) {
          this.currentVolunteer = this.volunteers.find(v => v.id === this.activeSession?.volunteerId) || null;
        }
      }

      const storedChatSettings = localStorage.getItem(STORAGE_KEYS.CHAT_SETTINGS);
      if (storedChatSettings) {
        try {
          this.chatSettings = { ...DEFAULT_CHAT_SETTINGS, ...JSON.parse(storedChatSettings) };
        } catch {
          this.chatSettings = { ...DEFAULT_CHAT_SETTINGS };
        }
      }

      const storedChannels = localStorage.getItem(STORAGE_KEYS.CHAT_CHANNELS);
      if (storedChannels) {
        try {
          this.chatChannels = JSON.parse(storedChannels);
        } catch {
          this.chatChannels = [];
        }
      }

      if (!this.chatChannels.some(c => c.id === 'all')) {
        this.chatChannels.unshift({
          id: 'all',
          name: 'Général (Tous)',
          description: 'Canal d\'échange commun pour tous les bénévoles et membres connectés',
          isPrivate: false,
          createdAt: new Date().toISOString(),
          createdBy: 'system'
        });
      }
      if (!this.chatChannels.some(c => c.id === 'admins')) {
        this.chatChannels.push({
          id: 'admins',
          name: 'Admins & Vie Scolaire',
          description: 'Canal privé sécurisé réservé aux membres du bureau, administrateurs et vie scolaire',
          isPrivate: true,
          createdAt: new Date().toISOString(),
          createdBy: 'system'
        });
      }
      this.saveChatChannels();

      const storedDbConfig = localStorage.getItem(STORAGE_KEYS.DATABASE_CONFIG);
      if (storedDbConfig) {
        try {
          const parsed = JSON.parse(storedDbConfig);
          this.databaseConfig = {
            ...DEFAULT_DATABASE_CONFIG,
            ...parsed,
            external: { ...DEFAULT_DATABASE_CONFIG.external!, ...(parsed.external || {}) }
          };
        } catch {
          this.databaseConfig = {
            ...DEFAULT_DATABASE_CONFIG,
            external: { ...DEFAULT_DATABASE_CONFIG.external! }
          };
        }
      }

      const storedMessages = localStorage.getItem(STORAGE_KEYS.CHAT_MESSAGES);
      if (storedMessages) {
        try {
          const rawMessages: ChatMessage[] = JSON.parse(storedMessages);
          this.chatMessages = rawMessages.map(m => {
            if (m.authorAvatarUrl && m.authorAvatarUrl.startsWith('data:')) {
              const { authorAvatarUrl, ...rest } = m;
              return rest;
            }
            return m;
          });
        } catch {
          this.chatMessages = [];
        }
      }

      const purged = this.purgeExpiredChatMessages();
      if (purged > 0 || this.chatMessages.length > 0) {
        this.saveChatMessages();
      }

      this.saveProducts();
      this.saveVolunteers();
    } catch (e) {
      console.error('Erreur chargement base de données locale:', e);
      this.products = INITIAL_PRODUCTS;
      this.volunteers = INITIAL_VOLUNTEERS;
    }
  }

  // --- Sauvegardes & Persistances ---
  public saveProducts(): void {
    storageService.safeSetItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(this.products), () => this.cleanLocalStorageQuota());
    this.onDbChanged();
  }

  public saveSales(): void {
    storageService.safeSetItem(STORAGE_KEYS.SALES, JSON.stringify(this.sales), () => this.cleanLocalStorageQuota());
    this.onDbChanged();
  }

  public saveSessions(): void {
    storageService.safeSetItem(STORAGE_KEYS.SESSIONS, JSON.stringify(this.sessions), () => this.cleanLocalStorageQuota());
    this.onDbChanged();
  }

  public saveVolunteers(): void {
    volunteerService.saveVolunteers(this.volunteers, (k, v) => storageService.safeSetItem(k, v, () => this.cleanLocalStorageQuota()));
  }

  public saveRestocks(): void {
    storageService.safeSetItem(STORAGE_KEYS.RESTOCKS, JSON.stringify(this.restocks), () => this.cleanLocalStorageQuota());
  }

  public saveLogs(): void {
    storageService.safeSetItem(STORAGE_KEYS.LOGS, JSON.stringify(this.logs), () => this.cleanLocalStorageQuota());
  }

  public savePerkSettings(): void {
    storageService.safeSetItem(STORAGE_KEYS.PERK_SETTINGS, JSON.stringify(this.perkSettings), () => this.cleanLocalStorageQuota());
  }

  public saveCashFloatSettings(): void {
    storageService.safeSetItem(STORAGE_KEYS.CASH_FLOAT_SETTINGS, JSON.stringify(this.cashFloatSettings), () => this.cleanLocalStorageQuota());
  }

  public saveTpeSettings(): void {
    storageService.safeSetItem(STORAGE_KEYS.TPE_SETTINGS, JSON.stringify(this.tpeSettings), () => this.cleanLocalStorageQuota());
  }

  public saveTpeLogs(): void {
    storageService.safeSetItem(STORAGE_KEYS.TPE_LOGS, JSON.stringify(this.tpeLogs), () => this.cleanLocalStorageQuota());
  }

  public saveChatMessages(): void {
    chatService.saveChatMessages(this.chatMessages);
  }

  public saveChatChannels(): void {
    chatService.saveChatChannels(this.chatChannels);
  }

  private saveSnakeScores(): void {
    const serialized = JSON.stringify(this.snakeScores);
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(STORAGE_KEYS.SNAKE_SCORES);
    }
    storageService.safeSetItem(STORAGE_KEYS.PACMAN_SCORES, serialized);
  }

  public logActivity(type: ActivityLog['type'], message: string): void {
    const author = this.currentVolunteer ? this.currentVolunteer.name : 'Système';
    const logItem: ActivityLog = {
      id: 'log-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      timestamp: new Date().toISOString(),
      type,
      message,
      author
    };
    this.logs.unshift(logItem);
    if (this.logs.length > 500) this.logs.pop();
    this.saveLogs();
    this.dispatchExternalOp('insert_activity_log', logItem);
    console.log(`[${logItem.type}] ${logItem.timestamp} - ${logItem.author}: ${logItem.message}`);
  }

  // --- Bénévoles & Authentification ---
  public getVolunteers(): Volunteer[] {
    return volunteerService.getVolunteers(this.volunteers);
  }

  public getCurrentVolunteer(): Volunteer | null {
    return this.currentVolunteer;
  }

  public getActiveSession(): Session | null {
    return this.activeSession;
  }

  public login(volunteerIdOrUsername: string): boolean {
    const clean = volunteerIdOrUsername.trim().toLowerCase();
    const volunteer = this.volunteers.find(v => v.id === volunteerIdOrUsername || v.username.toLowerCase() === clean);
    if (!volunteer || volunteer.isSuspended) return false;

    this.currentVolunteer = volunteer;

    if (!this.activeSession || this.activeSession.status !== 'active') {
      this.activeSession = {
        id: 'sess-' + Date.now(),
        startTime: new Date().toISOString(),
        volunteerId: volunteer.id,
        volunteerName: volunteer.name,
        totalSales: 0,
        totalCash: 0,
        totalTpe: 0,
        salesCount: 0,
        status: 'active'
      };
      storageService.safeSetItem(STORAGE_KEYS.ACTIVE_SESSION, JSON.stringify(this.activeSession));
      this.dispatchExternalOp('upsert_session', this.activeSession);
      this.logActivity('SESSION', `Ouverture de permanence par ${volunteer.name}`);
    } else {
      this.logActivity('INFO', `Connexion de ${volunteer.name} à la séance active`);
    }

    this.notify();
    return true;
  }

  public authenticate(username: string, password: string): { success: boolean; message: string; volunteer?: Volunteer } {
    return volunteerService.authenticate(
      this.volunteers,
      username,
      password,
      id => this.login(id),
      msg => this.logActivity('SECURITY', msg)
    );
  }

  public getEffectivePermissions(volunteer?: Volunteer | null): UserPermissions {
    const target = volunteer === undefined ? this.currentVolunteer : volunteer;
    return resolveVolunteerPermissions(target);
  }

  public hasPermission(flag: keyof UserPermissions, volunteer?: Volunteer | null): boolean {
    const target = volunteer === undefined ? this.currentVolunteer : volunteer;
    if (!target) return false;
    return !!this.getEffectivePermissions(target)[flag];
  }

  public updateUserPermissionsAndPerk(
    volunteerId: string,
    updates: {
      role?: string;
      isAdmin?: boolean;
      permissions?: Partial<UserPermissions>;
      perkPolicy?: VolunteerPerkPolicy;
    }
  ): { success: boolean; message: string; user?: Volunteer } {
    if (this.currentVolunteer && !this.hasPermission('canManageUsers')) {
      return { success: false, message: 'Accès refusé : permission Paramètres & Comptes requise.' };
    }
    const res = volunteerService.updateUserPermissionsAndPerk(
      this.volunteers,
      this.currentVolunteer?.id,
      volunteerId,
      updates
    );
    if (res.success && res.user) {
      if (this.currentVolunteer && this.currentVolunteer.id === res.user.id) {
        this.currentVolunteer = res.user;
      }
      this.saveVolunteers();
      this.dispatchExternalOp('upsert_volunteer', res.user);
      this.logActivity(
        'INFO',
        `Permissions & conso mises à jour pour @${res.user.username} (${res.user.name}) par ${this.currentVolunteer?.name || 'Admin'}`
      );
      this.notify();
    }
    return res;
  }

  public createUser(userData: {
    name: string;
    username: string;
    password: string;
    role?: string;
    isAdmin?: boolean;
    permissions?: Partial<UserPermissions>;
    perkPolicy?: VolunteerPerkPolicy;
  }): { success: boolean; message: string; volunteer?: Volunteer } {
    if (this.currentVolunteer && !this.hasPermission('canManageUsers')) {
      return { success: false, message: 'Accès refusé : permission Paramètres & Comptes requise.' };
    }
    const res = volunteerService.createUser(this.volunteers, userData);
    if (res.success && res.volunteer) {
      this.saveVolunteers();
      this.dispatchExternalOp('upsert_volunteer', res.volunteer);
      this.logActivity('INFO', `Création du compte @${res.volunteer.username} (${res.volunteer.name}) par ${this.currentVolunteer?.name || 'Admin'}`);
      this.notify();
    }
    return res;
  }

  public toggleSuspendUser(volunteerId: string): { success: boolean; message: string } {
    const res = volunteerService.toggleSuspendUser(this.volunteers, this.currentVolunteer?.id, volunteerId);
    if (res.success && res.user) {
      this.saveVolunteers();
      this.dispatchExternalOp('upsert_volunteer', res.user);
      const action = res.user.isSuspended ? 'suspendu' : 'réactivé';
      this.logActivity('WARNING', `Compte @${res.user.username} (${res.user.name}) ${action} par ${this.currentVolunteer?.name || 'Admin'}`);
      this.notify();
    }
    return res;
  }

  public deleteUser(volunteerId: string): { success: boolean; message: string } {
    const res = volunteerService.deleteUser(this.volunteers, this.currentVolunteer?.id, volunteerId);
    if (res.success && res.deletedUser) {
      this.saveVolunteers();
      this.dispatchExternalOp('delete_volunteer', { id: res.deletedUser.id });
      this.logActivity('WARNING', `Suppression du compte @${res.deletedUser.username} (${res.deletedUser.name}) par ${this.currentVolunteer?.name || 'Admin'}`);
      this.notify();
    }
    return res;
  }

  public resetUserPassword(volunteerId: string, newPass: string): { success: boolean; message: string } {
    const res = volunteerService.resetUserPassword(this.volunteers, volunteerId, newPass);
    if (res.success && res.user) {
      this.saveVolunteers();
      this.dispatchExternalOp('upsert_volunteer', res.user);
      this.logActivity('INFO', `Mot de passe réinitialisé pour @${res.user.username} par ${this.currentVolunteer?.name || 'Admin'}`);
      this.notify();
    }
    return res;
  }

  public updateUserName(volunteerId: string, newName: string): { success: boolean; message: string } {
    const res = volunteerService.updateUserName(this.volunteers, this.snakeScores, volunteerId, newName);
    if (res.success && res.user) {
      this.saveVolunteers();
      this.saveSnakeScores();
      this.dispatchExternalOp('upsert_volunteer', res.user);
      if (this.currentVolunteer?.id === res.user.id) {
        this.currentVolunteer.name = res.user.name;
      }
      this.logActivity('INFO', `Nom de @${res.user.username} modifié en "${res.user.name}"`);
      this.notify();
    }
    return res;
  }

  public updateVolunteerAvatar(volunteerId: string, avatarUrl: string): { success: boolean; message: string } {
    const volunteer = this.volunteers.find(v => v.id === volunteerId);
    if (!volunteer) return { success: false, message: 'Utilisateur introuvable' };

    volunteer.avatarUrl = avatarUrl;
    if (this.currentVolunteer?.id === volunteerId) {
      this.currentVolunteer.avatarUrl = avatarUrl;
    }

    this.saveVolunteers();
    this.dispatchExternalOp('upsert_volunteer', volunteer);
    this.logActivity('INFO', `Photo de profil mise à jour pour @${volunteer.username}`);
    this.notify();
    return { success: true, message: 'Photo de profil enregistrée avec succès' };
  }

  public updateVolunteerThemeSettings(volunteerId: string, settings: VolunteerThemeSettings): { success: boolean; message: string } {
    const volunteer = this.volunteers.find(v => v.id === volunteerId);
    if (!volunteer) return { success: false, message: 'Utilisateur introuvable' };

    volunteer.themeSettings = {
      ...(volunteer.themeSettings || {}),
      ...settings
    };

    if (this.currentVolunteer?.id === volunteerId) {
      this.currentVolunteer.themeSettings = volunteer.themeSettings;
    }

    this.saveVolunteers();
    this.dispatchExternalOp('upsert_volunteer', volunteer);
    this.notify();
    return { success: true, message: 'Préférences d\'affichage du chat enregistrées' };
  }

  public logout(): void {
    const volName = this.currentVolunteer?.name || 'Inconnu';
    this.createAutomaticBackup(`logout_${volName.replace(/[^a-zA-Z0-9]/g, '_')}`);
    this.logActivity('INFO', `Déconnexion de ${volName}`);
    this.currentVolunteer = null;
    this.notify();
  }

  // --- Sessions & Permanence ---
  public saveActiveSession(): void {
    if (this.activeSession) {
      storageService.safeSetItem(STORAGE_KEYS.ACTIVE_SESSION, JSON.stringify(this.activeSession));
    } else {
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_SESSION);
    }
  }

  public saveSessionDraft(draftNotes: string, draftPerkProductId?: string, draftCashCounts?: Record<string, number>): void {
    if (!this.activeSession) return;
    this.activeSession.draftNotes = draftNotes;
    this.activeSession.draftPerkProductId = draftPerkProductId;
    if (draftCashCounts) {
      this.activeSession.draftCashCounts = { ...draftCashCounts };
    }
    this.saveActiveSession();
    this.dispatchExternalOp('upsert_session', this.activeSession);
  }

  public clearSessionDraft(): void {
    if (!this.activeSession) return;
    delete this.activeSession.draftNotes;
    delete this.activeSession.draftPerkProductId;
    delete this.activeSession.draftCashCounts;
    this.saveActiveSession();
    this.dispatchExternalOp('upsert_session', this.activeSession);
  }

  public closeSession(
    incidentNotes: string,
    perkProductId?: string,
    cashWithdrawal?: SessionCashWithdrawal
  ): { session: Session; backupName: string; perkResult?: { success: boolean; message: string } } {
    if (!this.activeSession) {
      throw new Error('Aucune séance active à clôturer');
    }

    let perkResult: { success: boolean; message: string } | undefined;
    if (perkProductId) {
      perkResult = this.claimVolunteerPerk(this.activeSession.volunteerId, perkProductId, this.activeSession.id);
    }

    this.activeSession.endTime = new Date().toISOString();
    this.activeSession.status = 'closed';
    this.activeSession.incidentNotes = incidentNotes.trim();

    if (cashWithdrawal) {
      this.activeSession.cashWithdrawal = cashWithdrawal;

      const newLastRemainingCounts: Record<string, number> = {};
      const newCarriedOverDifferences: Record<string, number> = {};

      for (const item of cashWithdrawal.items) {
        newLastRemainingCounts[item.id] = item.remainingCount;
        const diff = item.remainingCount - item.baseCount;
        if (diff !== 0) {
          newCarriedOverDifferences[item.id] = diff;
        }
      }

      this.cashFloatSettings.lastRemainingCounts = newLastRemainingCounts;
      this.cashFloatSettings.carriedOverDifferences = newCarriedOverDifferences;
      this.saveCashFloatSettings();
      this.dispatchExternalOp('upsert_setting', {
        key: 'cash_float_settings',
        value: this.cashFloatSettings
      });
    }

    delete this.activeSession.draftNotes;
    delete this.activeSession.draftPerkProductId;
    delete this.activeSession.draftCashCounts;

    this.sessions.unshift({ ...this.activeSession });
    this.saveSessions();

    const closedSession = { ...this.activeSession };
    this.dispatchExternalOp('upsert_session', closedSession);
    const volName = this.activeSession.volunteerName;

    const withdrawalLog = cashWithdrawal
      ? ` - Décaisse: ${cashWithdrawal.totalWithdrawn.toFixed(2)}€ (Fond restant: ${cashWithdrawal.totalRemainingFloat.toFixed(2)}€, Écart: ${cashWithdrawal.cashDiscrepancy >= 0 ? '+' : ''}${cashWithdrawal.cashDiscrepancy.toFixed(2)}€)`
      : '';

    this.logActivity('SESSION', `Clôture séance par ${volName}. Ventes: ${closedSession.totalSales.toFixed(2)}€ (${closedSession.salesCount} ventes). Notes: ${incidentNotes || 'Aucun incident'}${perkResult?.success ? ` - Conso offerte: ${perkResult.message}` : ''}${withdrawalLog}`);

    const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const backupName = `openmdl_cloture_${dateStr}.mdlb`;
    this.createAutomaticBackup(`cloture_${dateStr}`);

    this.activeSession = null;
    this.currentVolunteer = null;
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_SESSION);
    }

    import('./syncService').then(m => {
      const cfg = m.syncService.getConfig();
      if (cfg.mode === 'usb' && cfg.usb.autoSyncOnClose && cfg.usb.filePath) {
        m.syncService.exportToUsbFile();
      }
    }).catch(() => {});

    this.notify();
    return { session: closedSession, backupName, perkResult };
  }

  public getSessions(): Session[] {
    return [...this.sessions];
  }

  // --- Sauvegardes ---
  public createAutomaticBackup(tag: string): string {
    const fileName = backupService.createAutomaticBackup(tag, () => this.exportData(), {
      sales: this.sales.length,
      products: this.products.length
    });
    this.logActivity('BACKUP', `Sauvegarde automatique créée: ${fileName}`);
    return fileName;
  }

  public getBackupsList(): Array<{ fileName: string; date: string; salesCount: number; productsCount: number }> {
    return backupService.getBackupsList();
  }

  // --- Produits & Catalogue ---
  public getProducts(): Product[] {
    return [...this.products];
  }

  public getProductById(id: string): Product | undefined {
    return this.products.find(p => p.id === id);
  }

  public updateProduct(updated: Product): void {
    if (this.currentVolunteer && !this.hasPermission('canEditCatalog')) {
      this.logActivity('WARNING', `Accès refusé : tentative de modification du catalogue/tarifs par @${this.currentVolunteer.username}`);
      return;
    }
    const index = this.products.findIndex(p => p.id === updated.id);
    if (index !== -1) {
      const old = this.products[index];
      this.products[index] = { ...updated };
      this.saveProducts();
      this.dispatchExternalOp('upsert_product', this.products[index]);
      this.logActivity('INFO', `Mise à jour produit "${updated.name}" (Prix: ${old.price}€ -> ${updated.price}€, Stock: ${updated.stock})`);
      this.notify();
    }
  }

  public addProduct(product: Omit<Product, 'id'>): Product {
    if (this.currentVolunteer && !this.hasPermission('canEditCatalog')) {
      this.logActivity('WARNING', `Accès refusé : tentative de création de produit par @${this.currentVolunteer.username}`);
      return { ...product, id: 'unauthorized' };
    }
    const newProduct: Product = {
      ...product,
      id: 'prod-' + Date.now()
    };
    this.products.push(newProduct);
    this.saveProducts();
    this.dispatchExternalOp('upsert_product', newProduct);
    this.logActivity('INFO', `Création nouveau produit "${newProduct.name}" (Prix: ${newProduct.price}€)`);
    this.notify();
    return newProduct;
  }

  public deleteProduct(id: string): void {
    if (this.currentVolunteer && !this.hasPermission('canEditCatalog')) {
      this.logActivity('WARNING', `Accès refusé : tentative de suppression de produit par @${this.currentVolunteer.username}`);
      return;
    }
    const prod = this.products.find(p => p.id === id);
    if (prod) {
      this.products = this.products.filter(p => p.id !== id);
      this.saveProducts();
      this.dispatchExternalOp('delete_product', { id });
      this.logActivity('WARNING', `Suppression du produit "${prod.name}"`);
      this.notify();
    }
  }

  public applyRestock(productId: string, quantityToAdd: number, newPrice?: number, costPrice?: number): void {
    if (this.currentVolunteer && !this.hasPermission('canRestock')) {
      this.logActivity('WARNING', `Accès refusé : tentative de restock par @${this.currentVolunteer.username}`);
      return;
    }
    const prod = this.products.find(p => p.id === productId);
    if (!prod) return;

    const previousStock = prod.stock;
    prod.stock += quantityToAdd;
    if (newPrice !== undefined && newPrice > 0) {
      prod.price = newPrice;
    }
    if (costPrice !== undefined && costPrice > 0) {
      prod.costPrice = costPrice;
    }

    const restockLog: RestockLog = {
      id: 'restock-' + Date.now(),
      productId: prod.id,
      productName: prod.name,
      quantityAdded: quantityToAdd,
      previousStock,
      newStock: prod.stock,
      newPrice: prod.price,
      costPrice: prod.costPrice,
      timestamp: new Date().toISOString(),
      volunteerName: this.currentVolunteer?.name || 'Inconnu'
    };

    this.restocks.unshift(restockLog);
    this.saveRestocks();
    this.saveProducts();
    this.dispatchExternalOp('apply_restock', {
      restockLog,
      newPrice: newPrice !== undefined && newPrice > 0 ? newPrice : null,
      costPrice: costPrice !== undefined && costPrice > 0 ? costPrice : null
    });

    this.logActivity('RESTOCK', `Restock +${quantityToAdd} sur "${prod.name}" (Stock: ${previousStock} -> ${prod.stock})`);
    this.notify();
  }

  public getRestocks(): RestockLog[] {
    return [...this.restocks];
  }

  // --- Ventes ---
  public recordSale(saleData: Omit<Sale, 'id' | 'timestamp' | 'volunteerId' | 'volunteerName' | 'sessionId'>): Sale {
    const volunteer = this.currentVolunteer || { id: 'unknown', name: 'Bénévole' };
    const sessionId = this.activeSession?.id || 'default-session';

    const sale: Sale = {
      id: 'sale-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      timestamp: new Date().toISOString(),
      volunteerId: volunteer.id,
      volunteerName: volunteer.name,
      sessionId,
      ...saleData
    };

    for (const item of sale.items) {
      const prod = this.products.find(p => p.id === item.productId);
      if (prod) {
        prod.stock = Math.max(0, prod.stock - item.quantity);
      }
    }
    this.saveProducts();

    this.sales.unshift(sale);
    this.saveSales();

    if (this.activeSession) {
      this.activeSession.totalSales += sale.totalAmount;
      this.activeSession.salesCount += 1;
      if (sale.paymentMethod === 'especes') {
        this.activeSession.totalCash += sale.totalAmount;

        if (!this.activeSession.draftCashCounts) {
          this.activeSession.draftCashCounts = {};
        }
        const givenBreakdown = sale.cashBreakdown?.given || decomposeCashAmount(sale.cashReceived || sale.totalAmount);
        for (const [denomId, count] of Object.entries(givenBreakdown)) {
          if (count > 0) {
            this.activeSession.draftCashCounts[denomId] = (this.activeSession.draftCashCounts[denomId] || 0) + count;
          }
        }
        if (sale.cashBreakdown?.returned) {
          for (const [denomId, count] of Object.entries(sale.cashBreakdown.returned)) {
            if (count > 0) {
              this.activeSession.draftCashCounts[denomId] = Math.max(0, (this.activeSession.draftCashCounts[denomId] || 0) - count);
            }
          }
        }
      } else {
        this.activeSession.totalTpe += sale.totalAmount;
      }
      this.saveActiveSession();
    }

    this.dispatchExternalOp('record_sale', {
      sale,
      draftCashCounts: this.activeSession?.draftCashCounts || null
    });

    const itemsSummary = sale.items.map(i => `${i.quantity}x ${i.productName}`).join(', ');
    this.logActivity('SALE', `Vente encaissée (${sale.paymentMethod.toUpperCase()}): ${sale.totalAmount.toFixed(2)}€ [${itemsSummary}]`);

    this.notify();
    return sale;
  }

  public cancelSale(saleId: string, restoreStock = true): { success: boolean; message: string } {
    const sale = this.sales.find(s => s.id === saleId);
    if (!sale) return { success: false, message: 'Vente introuvable' };
    if (sale.isCancelled) return { success: false, message: 'Vente déjà annulée' };

    if (restoreStock && sale.items) {
      for (const it of sale.items) {
        const prod = this.products.find(p => p.id === it.productId);
        if (prod) {
          prod.stock += it.quantity;
        }
      }
      this.saveProducts();
    }

    const cancelledAt = new Date().toISOString();
    sale.isCancelled = true;
    sale.cancelledAt = cancelledAt;
    this.saveSales();
    this.dispatchExternalOp('cancel_sale', { saleId, restoreStock, cancelledAt });
    this.logActivity('WARNING', `Annulation vente ${saleId} (${sale.totalAmount.toFixed(2)}€)`);
    this.notify();
    return { success: true, message: 'Vente annulée avec succès' };
  }

  public getSales(): Sale[] {
    return [...this.sales];
  }

  public getLogs(): ActivityLog[] {
    return [...this.logs];
  }

  // --- Consommations Offertes (Perks) ---
  public getPerkSettings(): PerkSettings {
    return { ...this.perkSettings };
  }

  public updatePerkSettings(updates: Partial<PerkSettings>): void {
    this.perkSettings = { ...this.perkSettings, ...updates };
    this.savePerkSettings();
    this.dispatchExternalOp('upsert_setting', {
      key: 'perk_settings',
      value: this.perkSettings
    });
    const statusTxt = this.perkSettings.enabled ? 'Activée' : 'Désactivée';
    const ruleTxt = this.perkSettings.rule === 'items_sold'
      ? `${this.perkSettings.threshold} articles vendus`
      : this.perkSettings.rule === 'sales_count'
        ? `${this.perkSettings.threshold} ventes`
        : 'Toujours offerte';
    this.logActivity('INFO', `Règles de collation bénévole mises à jour (${statusTxt}, règle: ${ruleTxt})`);
    this.notify();
  }

  public getVolunteerPerks(): VolunteerPerk[] {
    return [...this.volunteerPerks];
  }

  public getSessionSalesCount(sessionId?: string): number {
    return perkService.getSessionSalesCount(this.sales, sessionId || this.activeSession?.id);
  }

  public getSessionItemsSoldCount(sessionId?: string): number {
    return perkService.getSessionItemsSoldCount(this.sales, sessionId || this.activeSession?.id);
  }

  public getTodaySalesForVolunteer(volunteerId: string): number {
    return perkService.getTodaySalesForVolunteer(this.sales, volunteerId);
  }

  public getTodayItemsSoldForVolunteer(volunteerId: string): number {
    return perkService.getTodayItemsSoldForVolunteer(this.sales, volunteerId);
  }

  public hasVolunteerClaimedPerkToday(volunteerId: string): boolean {
    return perkService.hasVolunteerClaimedPerkToday(this.volunteerPerks, volunteerId);
  }

  public canClaimVolunteerPerk(volunteerId: string, sessionId?: string): {
    allowed: boolean;
    reason?: string;
    salesToday: number;
    requiredSales: number;
    current: number;
    required: number;
    rule: PerkEligibilityRule;
    enabled: boolean;
    policyMode: VolunteerPerkMode;
    maxPerSession: number;
    claimedInSession: number;
    remainingInSession: number;
    everyNSessions: number;
    sessionsUntilEligible: number;
  } {
    const resolvedSessionId = sessionId || this.activeSession?.id;
    const volunteer =
      this.volunteers.find(v => v.id === volunteerId) ||
      (this.currentVolunteer?.id === volunteerId ? this.currentVolunteer : null);
    const allSessions = [
      ...this.sessions,
      ...(this.activeSession ? [this.activeSession] : [])
    ];
    return perkService.canClaimVolunteerPerk(
      this.perkSettings,
      this.sales,
      this.volunteerPerks,
      volunteerId,
      resolvedSessionId,
      volunteer,
      allSessions
    );
  }

  public claimVolunteerPerk(volunteerId: string, productId: string, sessionId?: string): { success: boolean; message: string; perk?: VolunteerPerk } {
    const resolvedSessionId = sessionId || this.activeSession?.id;
    const allSessions = [
      ...this.sessions,
      ...(this.activeSession ? [this.activeSession] : [])
    ];
    const res = perkService.claimVolunteerPerk(
      this.perkSettings,
      this.sales,
      this.volunteerPerks,
      this.products,
      this.volunteers,
      this.currentVolunteer,
      volunteerId,
      productId,
      resolvedSessionId,
      allSessions
    );
    if (res.success && res.perk) {
      this.saveProducts();
      this.saveVolunteerPerks();
      this.dispatchExternalOp('claim_perk', { perk: res.perk });
      this.logActivity('INFO', `Conso offerte bénévole : "${res.perk.productName}" attribuée à ${res.perk.volunteerName} (Coût foyer : ${res.perk.costPrice.toFixed(2)}€)`);
      this.notify();
    }
    return res;
  }

  // --- Monnaie, Tiroir-Caisse & Décaisse ---
  public getCashFloatSettings(): CashFloatSettings {
    return {
      autoCalculationEnabled: true,
      ...this.cashFloatSettings,
      baseCounts: { ...this.cashFloatSettings.baseCounts },
      lastRemainingCounts: { ...(this.cashFloatSettings.lastRemainingCounts || {}) },
      carriedOverDifferences: { ...(this.cashFloatSettings.carriedOverDifferences || {}) }
    };
  }

  public getCurrentDrawerState(incomingCash?: Record<string, number>): DrawerCashState {
    return cashService.getCurrentDrawerState(
      this.getCashFloatSettings(),
      this.activeSession?.draftCashCounts,
      incomingCash
    );
  }

  public updateCashFloatSettings(updates: Partial<CashFloatSettings>): void {
    this.cashFloatSettings = {
      ...this.cashFloatSettings,
      ...updates,
      baseCounts: updates.baseCounts ? { ...updates.baseCounts } : this.cashFloatSettings.baseCounts,
      lastRemainingCounts: updates.lastRemainingCounts ? { ...updates.lastRemainingCounts } : this.cashFloatSettings.lastRemainingCounts,
      carriedOverDifferences: updates.carriedOverDifferences ? { ...updates.carriedOverDifferences } : this.cashFloatSettings.carriedOverDifferences,
      updatedAt: new Date().toISOString()
    };
    this.saveCashFloatSettings();
    this.dispatchExternalOp('upsert_setting', {
      key: 'cash_float_settings',
      value: this.cashFloatSettings
    });
    const baseTotal = this.calculateBaseCashFloatTotal();
    this.logActivity('INFO', `Paramètres du fond de caisse de référence mis à jour (Base: ${baseTotal.toFixed(2)} €)`);
    this.notify();
  }

  public calculateBaseCashFloatTotal(baseCounts?: Record<string, number>): number {
    return cashService.calculateBaseCashFloatTotal(baseCounts, this.cashFloatSettings.baseCounts);
  }

  public visaCashWithdrawal(sessionId: string, visaBy: string, visaNotes?: string): boolean {
    if (this.currentVolunteer && !this.hasPermission('canVisaDecaisse')) {
      this.logActivity('SECURITY', `Tentative non autorisée de visa de décaisse par @${this.currentVolunteer.username}`);
      return false;
    }
    const session = this.sessions.find(s => s.id === sessionId);
    if (!session || !session.cashWithdrawal) return false;

    const visaDate = new Date().toISOString();
    session.cashWithdrawal.visaBy = visaBy;
    session.cashWithdrawal.visaDate = visaDate;
    session.cashWithdrawal.visaNotes = visaNotes || '';

    this.saveSessions();
    this.dispatchExternalOp('visa_session', {
      sessionId,
      visaBy,
      visaDate,
      visaNotes: visaNotes || ''
    });
    this.logActivity('INFO', `Visa de remise d'espèces validé par ${visaBy} pour la séance de ${session.volunteerName}`);
    import('./syncService')
      .then(m => m.syncService.pushSessionVisa(sessionId, visaBy, visaDate, visaNotes || ''))
      .catch(() => {});
    this.notify();
    return true;
  }

  public applyRemoteSessionVisa(sessionId: string, visaBy: string, visaDate: string, visaNotes = ''): boolean {
    const session = this.sessions.find(s => s.id === sessionId);
    if (!session || !session.cashWithdrawal) return false;

    session.cashWithdrawal.visaBy = visaBy;
    session.cashWithdrawal.visaDate = visaDate || new Date().toISOString();
    session.cashWithdrawal.visaNotes = visaNotes;

    this.saveSessions();
    this.dispatchExternalOp('visa_session', {
      sessionId,
      visaBy,
      visaDate: session.cashWithdrawal.visaDate,
      visaNotes
    });
    this.logActivity('INFO', `Visa LAN reçu de ${visaBy} pour la séance de ${session.volunteerName}`);
    this.notify();
    return true;
  }

  public getCashWithdrawals(): EnrichedCashWithdrawal[] {
    return cashService.getCashWithdrawals(this.sessions);
  }

  // --- TPE & Terminal SumUp ---
  public getTpeSettings(): TpeSettings {
    return { ...this.tpeSettings };
  }

  public updateTpeSettings(settings: Partial<TpeSettings>): void {
    if (this.currentVolunteer && !this.hasPermission('canViewTpe')) {
      console.warn('Action refusée: modification TPE réservée aux administrateurs.');
      this.logActivity('SECURITY', `Tentative non autorisée de modification TPE par ${this.currentVolunteer.name}`);
      return;
    }
    this.tpeSettings = { ...this.tpeSettings, ...settings };
    this.saveTpeSettings();
    this.dispatchExternalOp('upsert_setting', {
      key: 'tpe_settings',
      value: this.tpeSettings
    });
    this.notify();
  }

  public connectTpe(account: {
    merchantName?: string;
    merchantEmail?: string;
    merchantCode?: string;
    apiKey?: string;
    serialNumber?: string;
    readerId?: string;
    readerModel?: 'SumUp Solo' | 'SumUp Air';
  }): void {
    if (this.currentVolunteer && !this.hasPermission('canViewTpe')) {
      console.warn('Action refusée: connexion TPE réservée aux administrateurs.');
      this.logActivity('SECURITY', `Tentative non autorisée de connexion TPE par ${this.currentVolunteer.name}`);
      return;
    }
    this.tpeSettings = {
      ...this.tpeSettings,
      isConnected: true,
      merchantName: account.merchantName || this.tpeSettings.merchantName || 'Maison des Lycéens',
      merchantEmail: account.merchantEmail || this.tpeSettings.merchantEmail || '',
      merchantCode: account.merchantCode || this.tpeSettings.merchantCode || '',
      apiKey: account.apiKey ?? this.tpeSettings.apiKey ?? '',
      readerId: account.readerId ?? this.tpeSettings.readerId ?? '',
      serialNumber: account.serialNumber || this.tpeSettings.serialNumber || `SOLO-MDL-${Math.floor(1000 + Math.random() * 9000)}`,
      readerModel: account.readerModel || 'SumUp Solo',
      readerName: `${account.readerModel || 'SumUp Solo'} (${account.merchantName || 'Foyer MDL'})`,
      batteryLevel: 98
    };
    this.saveTpeSettings();
    this.dispatchExternalOp('upsert_setting', {
      key: 'tpe_settings',
      value: this.tpeSettings
    });
    this.logActivity('INFO', `Terminal ${this.tpeSettings.readerModel} configuré (${this.tpeSettings.merchantName})`);
    this.notify();
  }

  public disconnectTpe(): void {
    if (this.currentVolunteer && !this.hasPermission('canViewTpe')) {
      console.warn('Action refusée: déconnexion TPE réservée aux administrateurs.');
      this.logActivity('SECURITY', `Tentative non autorisée de déconnexion TPE par ${this.currentVolunteer.name}`);
      return;
    }
    this.tpeSettings.isConnected = false;
    this.tpeSettings.apiKey = '';
    this.tpeSettings.merchantCode = '';
    this.saveTpeSettings();
    this.dispatchExternalOp('upsert_setting', {
      key: 'tpe_settings',
      value: this.tpeSettings
    });
    this.logActivity('WARNING', `Terminal ${this.tpeSettings.readerName} déconnecté`);
    this.notify();
  }

  public recordTpePayment(payment: {
    amount: number;
    cardBrand?: string;
    last4?: string;
    status?: 'SUCCESS' | 'FAILED';
  }): TpePaymentLog {
    const log: TpePaymentLog = {
      id: 'tpe-tx-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      timestamp: new Date().toISOString(),
      amount: payment.amount,
      currency: 'EUR',
      status: payment.status || 'SUCCESS',
      readerName: this.tpeSettings.readerName,
      cardBrand: payment.cardBrand || 'Sans-Contact / CB',
      last4: payment.last4 || `${Math.floor(1000 + Math.random() * 9000)}`,
      transactionCode: `TX-${Date.now().toString(36).toUpperCase()}`,
      volunteerName: this.currentVolunteer?.name || 'Inconnu'
    };
    this.tpeLogs.unshift(log);
    if (this.tpeLogs.length > 200) this.tpeLogs.pop();
    this.saveTpeLogs();
    this.dispatchExternalOp('insert_tpe_log', log);
    this.notify();
    return log;
  }

  public getTpeLogs(): TpePaymentLog[] {
    return [...this.tpeLogs];
  }

  // --- Scores (Pacman / Snake) ---
  public getPacmanScores(): PacmanScore[] {
    const fakeNames = ['jérémy', 'jeremy', 'thomas m.', 'thomas'];
    return this.snakeScores
      .filter(s =>
        s && typeof s === 'object' &&
        s.playerName &&
        !fakeNames.includes(String(s.playerName).toLowerCase().trim()) &&
        !['s1', 's2', 's3'].includes(s.id) &&
        !(s.score === 140 && String(s.playerName).includes('Jér')) &&
        !(s.score === 90 && String(s.playerName).includes('Thom')) &&
        !(s.score === 80 && String(s.playerName).includes('Adri'))
      )
      .map(s => {
        if (s.volunteerId) {
          const vol = this.volunteers.find(v => v.id === s.volunteerId);
          if (vol && vol.name) {
            return { ...s, playerName: vol.name };
          }
        }
        return s;
      })
      .sort((a, b) => b.score - a.score);
  }

  public addPacmanScore(playerName: string, score: number, volunteerId?: string): PacmanScore {
    const volId = volunteerId || this.currentVolunteer?.id;
    const vol = volId ? this.volunteers.find(v => v.id === volId) : null;
    const resolvedName = vol ? vol.name : (playerName.trim() || 'Anonyme');

    const entry: PacmanScore = {
      id: 'score-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      volunteerId: volId,
      playerName: resolvedName,
      score,
      timestamp: new Date().toISOString()
    };
    this.snakeScores.push(entry);
    this.snakeScores.sort((a, b) => b.score - a.score);
    if (this.snakeScores.length > 50) this.snakeScores.pop();
    this.saveSnakeScores();
    this.dispatchExternalOp('insert_pacman_score', entry);
    this.notify();
    return entry;
  }

  public getSnakeScores(): SnakeScore[] {
    return this.getPacmanScores();
  }

  public addSnakeScore(playerName: string, score: number): SnakeScore {
    return this.addPacmanScore(playerName, score);
  }

  public clearPacmanScores(): void {
    this.snakeScores = [];
    this.saveSnakeScores();
    this.dispatchExternalOp('clear_pacman_scores', {});
    this.notify();
  }

  // --- Analytiques & Prédictions de stock ---
  public getProductStockTimeline(
    productId: string,
    year: number,
    month: number | 'all' = 'all'
  ): ProductStockEvolution {
    return catalogService.getProductStockTimeline(this.products, this.sales, this.restocks, productId, year, month);
  }

  public getMultiProductSalesPrediction(
    year: number,
    month: number | 'all' = 'all'
  ) {
    return catalogService.getMultiProductSalesPrediction(this.products, this.sales, this.restocks, year, month);
  }

  // --- Données de démonstration ---
  public seedDemoSessions(): void {
    this.sessions = demoDataService.seedDemoSessions(this.activeSession);
    this.saveSessions();
    this.notify();
  }

  public seedDemoData(): void {
    const data = demoDataService.generateDemoDataset();
    this.volunteers = data.volunteers;
    this.saveVolunteers();
    this.currentVolunteer = data.currentVolunteer;
    this.products = data.products;
    this.saveProducts();
    this.sales = data.sales;
    this.saveSales();
    this.volunteerPerks = data.volunteerPerks;
    this.saveVolunteerPerks();
    this.restocks = data.restocks;
    this.saveRestocks();
    this.tpeLogs = data.tpeLogs;
    this.saveTpeLogs();

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('OPENMDL_DEMO_ACTIVE', 'true');
    }
    if (!this.suppressExternalSync && externalDbService.isExternalEnabled(this.databaseConfig)) {
      void this.migrateLocalToExternalDatabase();
    }
    this.notify();
  }

  public clearAllTestData(resetProducts = true, resetVolunteers = true): void {
    this.sales = [];
    this.sessions = [];
    this.restocks = [];
    this.volunteerPerks = [];
    this.tpeLogs = [];
    this.logs = [];
    this.activeSession = null;
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('OPENMDL_DEMO_ACTIVE');
      localStorage.removeItem('OPENMDL_SEED_V');
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_SESSION);
    }
    this.saveSales();
    this.saveSessions();
    this.saveRestocks();
    this.saveVolunteerPerks();
    this.saveTpeLogs();
    this.saveLogs();
    if (resetProducts) {
      this.products = [];
      this.saveProducts();
    }
    if (resetVolunteers) {
      this.volunteers = JSON.parse(JSON.stringify(INITIAL_VOLUNTEERS));
      this.saveVolunteers();
      this.currentVolunteer = this.volunteers[0];
    }
    this.dispatchExternalOp('reset_operational_data', { resetProducts, resetVolunteers });
    if (resetVolunteers) {
      for (const v of this.volunteers) {
        this.dispatchExternalOp('upsert_volunteer', v);
      }
    }
    this.notify();
  }

  public isDemoMode(): boolean {
    return localStorage.getItem('OPENMDL_DEMO_ACTIVE') === 'true';
  }

  // --- Export / Import & Profil d'application ---
  public exportData(): Record<string, any> {
    return {
      version: typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.0.10',
      exportDate: new Date().toISOString(),
      products: this.products,
      sales: this.sales,
      sessions: this.sessions,
      volunteers: this.volunteers,
      restocks: this.restocks,
      logs: this.logs,
      perkSettings: this.perkSettings,
      tpeSettings: this.tpeSettings,
      cashFloatSettings: this.cashFloatSettings,
      chatMessages: this.chatMessages,
      chatChannels: this.chatChannels,
      chatSettings: this.chatSettings
    };
  }

  public importData(data: any): void {
    if (!data || typeof data !== 'object') {
      throw new Error('Données d\'import invalides');
    }
    if (Array.isArray(data.products)) {
      this.products = data.products;
      this.saveProducts();
    }
    if (Array.isArray(data.sales)) {
      this.sales = data.sales;
      this.saveSales();
    }
    if (Array.isArray(data.sessions)) {
      const localVisaBySessionId = new Map<string, { visaBy: string; visaDate?: string; visaNotes?: string }>();
      for (const localSess of this.sessions) {
        if (localSess.cashWithdrawal?.visaBy) {
          localVisaBySessionId.set(localSess.id, {
            visaBy: localSess.cashWithdrawal.visaBy,
            visaDate: localSess.cashWithdrawal.visaDate,
            visaNotes: localSess.cashWithdrawal.visaNotes
          });
        }
      }

      this.sessions = data.sessions.map((remoteSess: Session) => {
        if (remoteSess?.cashWithdrawal && !remoteSess.cashWithdrawal.visaBy) {
          const localVisa = localVisaBySessionId.get(remoteSess.id);
          if (localVisa) {
            return {
              ...remoteSess,
              cashWithdrawal: {
                ...remoteSess.cashWithdrawal,
                ...localVisa
              }
            };
          }
        }
        return remoteSess;
      });
      this.saveSessions();
    }
    if (Array.isArray(data.volunteers)) {
      this.volunteers = data.volunteers;
      this.saveVolunteers();
    }
    if (Array.isArray(data.restocks)) {
      this.restocks = data.restocks;
      this.saveRestocks();
    }
    if (Array.isArray(data.chatMessages)) {
      this.mergeIncomingChatMessages(data.chatMessages);
    }
    if (Array.isArray(data.chatChannels)) {
      data.chatChannels.forEach((ch: ChatChannel) => {
        if (!this.chatChannels.some(existing => existing.id === ch.id)) {
          this.chatChannels.push(ch);
        }
      });
      this.saveChatChannels();
    }
    if (data.chatSettings) {
      this.chatSettings = { ...DEFAULT_CHAT_SETTINGS, ...data.chatSettings };
      storageService.safeSetItem(STORAGE_KEYS.CHAT_SETTINGS, JSON.stringify(this.chatSettings));
    }
    if (Array.isArray(data.logs)) {
      this.logs = data.logs;
      this.saveLogs();
    }
    if (data.perkSettings) {
      this.perkSettings = { ...DEFAULT_PERK_SETTINGS, ...data.perkSettings };
      this.savePerkSettings();
    }
    if (data.tpeSettings) {
      this.tpeSettings = data.tpeSettings;
      this.saveTpeSettings();
    }
    if (data.cashFloatSettings) {
      this.cashFloatSettings = { ...DEFAULT_CASH_FLOAT_SETTINGS, ...data.cashFloatSettings };
      this.saveCashFloatSettings();
    }
    if (!this.suppressExternalSync && externalDbService.isExternalEnabled(this.databaseConfig)) {
      void this.migrateLocalToExternalDatabase();
    }
    this.notify();
  }

  public getAppProfile(): AppProfile {
    return (localStorage.getItem(STORAGE_KEYS.APP_PROFILE) as AppProfile) || 'foyer';
  }

  public setAppProfile(profile: AppProfile): void {
    storageService.safeSetItem(STORAGE_KEYS.APP_PROFILE, profile);
    this.logActivity('INFO', `Profil de l'application basculé sur "${profile === 'visco' ? 'Vie Scolaire' : 'Foyer'}"`);
    this.notify();
  }

  public getDatabaseHash(): string {
    const payload = {
      p: this.products,
      s: this.sales,
      se: this.sessions,
      v: this.volunteers,
      r: this.restocks,
      c: this.cashFloatSettings,
      t: this.tpeSettings
    };
    return computeCrc32Hex(JSON.stringify(payload));
  }

  // --- Chat & Messagerie ---
  public getChatSettings(): ChatSettings {
    return { ...this.chatSettings };
  }

  public updateChatSettings(settings: Partial<ChatSettings>): void {
    this.chatSettings = {
      ...this.chatSettings,
      ...settings
    };
    storageService.safeSetItem(STORAGE_KEYS.CHAT_SETTINGS, JSON.stringify(this.chatSettings));
    this.dispatchExternalOp('upsert_setting', {
      key: 'chat_settings',
      value: this.chatSettings
    });
    if (this.chatSettings.retentionDays > 0) {
      this.purgeExpiredChatMessages();
    }
    this.logActivity('INFO', `Paramètres de la messagerie mis à jour (Actif: ${this.chatSettings.enabled ? 'Oui' : 'Non'}, Rétention: ${this.chatSettings.retentionDays}j)`);
    this.notify();
  }

  public getChatChannels(forVolunteer?: Volunteer | null): ChatChannel[] {
    return chatService.getChatChannels(this.chatChannels, this.currentVolunteer, this.getAppProfile(), forVolunteer);
  }

  public createChatChannel(name: string, description: string, isPrivate: boolean, memberIds?: string[]): { success: boolean; message: string; channel?: ChatChannel } {
    const cleanName = name.trim();
    if (!cleanName) {
      return { success: false, message: 'Le nom du groupe ne peut pas être vide' };
    }

    const channelId = 'chan-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
    const newChan: ChatChannel = {
      id: channelId,
      name: cleanName,
      description: description.trim() || undefined,
      isPrivate,
      memberIds: memberIds && memberIds.length > 0 ? memberIds : undefined,
      createdAt: new Date().toISOString(),
      createdBy: this.currentVolunteer?.name || 'Inconnu'
    };

    this.chatChannels.push(newChan);
    this.saveChatChannels();
    this.dispatchExternalOp('upsert_chat_channel', newChan);
    chatService.broadcastChatUpdate();
    this.notify();
    return { success: true, message: `Groupe "${cleanName}" créé`, channel: newChan };
  }

  public getOrCreateDirectMessageChannel(targetVolunteerId: string): ChatChannel {
    const me = this.currentVolunteer;
    if (!me) {
      throw new Error('Vous devez être connecté pour ouvrir une conversation privée');
    }
    const target = this.volunteers.find(v => v.id === targetVolunteerId);
    if (!target) {
      throw new Error('Destinataire introuvable');
    }

    const pairIds = [me.id, target.id].sort();
    const dmChannelId = `dm-${pairIds.join('-')}`;

    let channel = this.chatChannels.find(c => c.id === dmChannelId);
    if (!channel) {
      channel = {
        id: dmChannelId,
        name: `@${target.name}`,
        description: `Message privé entre @${me.username} et @${target.username}`,
        isPrivate: true,
        isDirectMessage: true,
        dmTargetVolunteerId: target.id,
        memberIds: pairIds,
        createdAt: new Date().toISOString(),
        createdBy: me.name
      };
      this.chatChannels.push(channel);
      this.saveChatChannels();
      this.dispatchExternalOp('upsert_chat_channel', channel);
      chatService.broadcastChatUpdate();
      this.notify();
    }
    return channel;
  }

  public getUnreadDirectMessagesCount(): number {
    return chatService.getUnreadDirectMessagesCount(
      this.chatChannels,
      this.chatMessages,
      this.chatSettings,
      this.currentVolunteer
    );
  }

  public markChannelAsRead(channelId: string): void {
    chatService.markChannelAsRead(channelId, this.currentVolunteer);
  }

  public getDatabaseConfig(): DatabaseConnectionConfig {
    return {
      ...this.databaseConfig,
      external: this.databaseConfig.external ? { ...this.databaseConfig.external } : undefined
    };
  }

  public updateDatabaseConfig(config: Partial<DatabaseConnectionConfig>): { success: boolean; message: string } {
    const nextEngine = config.engine ?? this.databaseConfig.engine ?? 'sqlite';
    const nextExternal: ExternalDatabaseConfig = {
      ...DEFAULT_DATABASE_CONFIG.external!,
      ...(this.databaseConfig.external || {}),
      ...(config.external || {})
    };

    this.databaseConfig = {
      ...this.databaseConfig,
      ...config,
      engine: nextEngine,
      external: nextExternal,
      status: config.status || (nextEngine === 'sqlite' ? 'connected' : this.databaseConfig.status || 'connected'),
      lastPing: config.lastPing || new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      format: nextEngine === 'mysql' ? 'MySQL / MariaDB (Externe + Cache SQLite)' : 'SQLite (.db / .mdlb)'
    };
    storageService.safeSetItem(STORAGE_KEYS.DATABASE_CONFIG, JSON.stringify(this.databaseConfig));
    this.configureExternalAutoSync();
    this.notify();
    return {
      success: true,
      message: nextEngine === 'mysql'
        ? 'Configuration MySQL / MariaDB enregistrée (cache SQLite conservé).'
        : 'Moteur SQLite embarqué activé.'
    };
  }

  public configureExternalAutoSync(): void {
    const ext = this.databaseConfig.external;
    const hasEndpoint = Boolean(ext && ((ext.url || '').trim() || (ext.host || '').trim()));
    if (externalDbService.isExternalEnabled(this.databaseConfig) && ext && hasEndpoint) {
      const intervalSec = Number(ext.syncIntervalSec) || 15;
      externalDbService.startAutoSync(intervalSec, async () => {
        await this.syncFromExternalDatabase();
      });
    } else {
      externalDbService.stopAutoSync();
    }
  }

  public async testExternalDatabase(external?: ExternalDatabaseConfig): Promise<{
    success: boolean;
    serverVersion: string;
    message: string;
  }> {
    const target = external || this.databaseConfig.external || DEFAULT_DATABASE_CONFIG.external!;
    const res = await externalDbService.testConnection(target);
    if (this.databaseConfig.engine === 'mysql') {
      this.databaseConfig = {
        ...this.databaseConfig,
        status: res.success ? 'connected' : 'error',
        serverVersion: res.serverVersion || this.databaseConfig.serverVersion,
        lastError: res.success ? undefined : res.message,
        lastPing: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      };
      storageService.safeSetItem(STORAGE_KEYS.DATABASE_CONFIG, JSON.stringify(this.databaseConfig));
    }
    return res;
  }

  private buildExternalSnapshotPayload(): Record<string, unknown> {
    return {
      ...this.exportData(),
      volunteerPerks: this.volunteerPerks,
      tpeLogs: this.tpeLogs,
      snakeScores: this.snakeScores,
      activeSession: this.activeSession
    };
  }

  public applyExternalSnapshot(snapshot: any): { applied: boolean; emptyRemote: boolean } {
    if (!snapshot || typeof snapshot !== 'object') {
      return { applied: false, emptyRemote: true };
    }

    const remoteProducts = Array.isArray(snapshot.products) ? snapshot.products : [];
    const remoteSales = Array.isArray(snapshot.sales) ? snapshot.sales : [];
    const remoteSessions = Array.isArray(snapshot.sessions) ? snapshot.sessions : [];
    const remoteVolunteers = Array.isArray(snapshot.volunteers) ? snapshot.volunteers : [];

    // Garde anti-wipe : ne jamais écraser le cache SQLite local si la base MySQL distante est encore vierge
    if (
      remoteProducts.length === 0 &&
      remoteSales.length === 0 &&
      remoteSessions.length === 0 &&
      remoteVolunteers.length === 0
    ) {
      return { applied: false, emptyRemote: true };
    }

    const beforeSig = JSON.stringify({
      h: this.getDatabaseHash(),
      m: this.chatMessages.length,
      c: this.chatChannels.length,
      p: this.volunteerPerks.length,
      t: this.tpeLogs.length,
      sc: this.snakeScores.length
    });

    this.suppressExternalSync = true;
    try {
      if (Array.isArray(snapshot.products)) {
        this.products = snapshot.products;
        this.saveProducts();
      }
      if (Array.isArray(snapshot.sales)) {
        this.sales = snapshot.sales;
        this.saveSales();
      }
      if (Array.isArray(snapshot.sessions)) {
        this.sessions = snapshot.sessions.filter((s: Session) => s.status === 'closed');
        const matchingActive = this.activeSession
          ? snapshot.sessions.find((s: Session) => s.id === this.activeSession!.id)
          : null;
        if (matchingActive && matchingActive.status === 'active') {
          this.activeSession = {
            ...this.activeSession!,
            ...matchingActive,
            draftNotes: this.activeSession!.draftNotes ?? matchingActive.draftNotes,
            draftPerkProductId: this.activeSession!.draftPerkProductId ?? matchingActive.draftPerkProductId
          };
          this.saveActiveSession();
        }
        this.saveSessions();
      }
      if (Array.isArray(snapshot.volunteers)) {
        this.volunteers = snapshot.volunteers;
        if (this.currentVolunteer) {
          this.currentVolunteer = this.volunteers.find(v => v.id === this.currentVolunteer!.id) || this.currentVolunteer;
        }
        this.saveVolunteers();
      }
      if (Array.isArray(snapshot.restocks)) {
        this.restocks = snapshot.restocks;
        this.saveRestocks();
      }
      if (Array.isArray(snapshot.volunteerPerks)) {
        this.volunteerPerks = snapshot.volunteerPerks;
        this.saveVolunteerPerks();
      }
      if (Array.isArray(snapshot.logs)) {
        this.logs = snapshot.logs;
        this.saveLogs();
      }
      if (Array.isArray(snapshot.tpeLogs)) {
        this.tpeLogs = snapshot.tpeLogs;
        this.saveTpeLogs();
      }
      if (Array.isArray(snapshot.snakeScores)) {
        this.snakeScores = snapshot.snakeScores;
        this.saveSnakeScores();
      }
      if (Array.isArray(snapshot.chatChannels)) {
        this.chatChannels = snapshot.chatChannels;
        if (!this.chatChannels.some(c => c.id === 'all')) {
          this.chatChannels.unshift({
            id: 'all',
            name: 'Général (Tous)',
            description: 'Canal d\'échange commun pour tous les bénévoles et membres connectés',
            isPrivate: false,
            createdAt: new Date().toISOString(),
            createdBy: 'system'
          });
        }
        if (!this.chatChannels.some(c => c.id === 'admins')) {
          this.chatChannels.push({
            id: 'admins',
            name: 'Admins & Vie Scolaire',
            description: 'Canal privé sécurisé réservé aux membres du bureau, administrateurs et vie scolaire',
            isPrivate: true,
            createdAt: new Date().toISOString(),
            createdBy: 'system'
          });
        }
        this.saveChatChannels();
      }
      if (Array.isArray(snapshot.chatMessages)) {
        this.chatMessages = snapshot.chatMessages;
        this.saveChatMessages();
      }
      if (snapshot.perkSettings) {
        this.perkSettings = { ...DEFAULT_PERK_SETTINGS, ...snapshot.perkSettings };
        this.savePerkSettings();
      }
      if (snapshot.cashFloatSettings) {
        this.cashFloatSettings = { ...DEFAULT_CASH_FLOAT_SETTINGS, ...snapshot.cashFloatSettings };
        this.saveCashFloatSettings();
      }
      if (snapshot.tpeSettings) {
        this.tpeSettings = { ...DEFAULT_TPE_SETTINGS, ...snapshot.tpeSettings };
        this.saveTpeSettings();
      }
      if (snapshot.chatSettings) {
        this.chatSettings = { ...DEFAULT_CHAT_SETTINGS, ...snapshot.chatSettings };
        storageService.safeSetItem(STORAGE_KEYS.CHAT_SETTINGS, JSON.stringify(this.chatSettings));
      }
    } finally {
      this.suppressExternalSync = false;
    }

    const afterSig = JSON.stringify({
      h: this.getDatabaseHash(),
      m: this.chatMessages.length,
      c: this.chatChannels.length,
      p: this.volunteerPerks.length,
      t: this.tpeLogs.length,
      sc: this.snakeScores.length
    });

    if (beforeSig !== afterSig) {
      this.notify();
      return { applied: true, emptyRemote: false };
    }
    return { applied: false, emptyRemote: false };
  }

  public async syncFromExternalDatabase(): Promise<{
    success: boolean;
    emptyRemote?: boolean;
    pendingCount?: number;
    message: string;
  }> {
    if (!externalDbService.isExternalEnabled(this.databaseConfig) || !this.databaseConfig.external) {
      return { success: false, message: 'Moteur externe MySQL/MariaDB non activé.' };
    }

    const prevStatus = this.databaseConfig.status;
    const prevPending = this.databaseConfig.pendingOpsCount || 0;
    const prevError = this.databaseConfig.lastError;
    const prevVersion = this.databaseConfig.serverVersion;

    try {
      const snapshot = await externalDbService.pullSnapshot(this.databaseConfig.external);
      const { applied, emptyRemote } = this.applyExternalSnapshot(snapshot);
      const nextVersion = snapshot.serverVersion || this.databaseConfig.serverVersion;

      this.databaseConfig = {
        ...this.databaseConfig,
        status: 'connected',
        serverVersion: nextVersion,
        pendingOpsCount: 0,
        lastError: undefined,
        lastPing: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      };
      storageService.safeSetItem(STORAGE_KEYS.DATABASE_CONFIG, JSON.stringify(this.databaseConfig));

      const metaChanged =
        prevStatus !== 'connected' ||
        prevPending !== 0 ||
        prevError !== undefined ||
        prevVersion !== nextVersion;

      if (!applied && metaChanged) {
        this.notify();
      }

      if (emptyRemote) {
        return {
          success: true,
          emptyRemote: true,
          pendingCount: 0,
          message: 'Base MySQL/MariaDB connectée (vierge : cache SQLite local conservé).'
        };
      }
      return {
        success: true,
        emptyRemote: false,
        pendingCount: 0,
        message: applied
          ? 'Données synchronisées depuis MySQL/MariaDB vers le cache SQLite.'
          : 'Base MySQL/MariaDB déjà à jour.'
      };
    } catch (err: any) {
      const errMsg = typeof err === 'string' ? err : err?.message || String(err);
      const pending = await externalDbService.getPendingCount();
      this.databaseConfig = {
        ...this.databaseConfig,
        status: 'offline_cache',
        pendingOpsCount: pending,
        lastError: errMsg
      };
      storageService.safeSetItem(STORAGE_KEYS.DATABASE_CONFIG, JSON.stringify(this.databaseConfig));

      const metaChanged =
        prevStatus !== 'offline_cache' ||
        prevPending !== pending ||
        prevError !== errMsg;

      if (metaChanged) {
        this.notify();
      }

      return {
        success: false,
        pendingCount: pending,
        message: `Mode cache SQLite hors-ligne actif (${pending} opération(s) en attente) : ${errMsg}`
      };
    }
  }

  public async clearPendingExternalSyncOps(): Promise<void> {
    await externalDbService.clearPendingOps();
    this.databaseConfig = {
      ...this.databaseConfig,
      pendingOpsCount: 0,
      lastError: undefined
    };
    storageService.safeSetItem(STORAGE_KEYS.DATABASE_CONFIG, JSON.stringify(this.databaseConfig));
    this.notify();
  }

  public async migrateLocalToExternalDatabase(external?: ExternalDatabaseConfig): Promise<{
    success: boolean;
    message: string;
  }> {
    const target = external || this.databaseConfig.external;
    if (!target) {
      return { success: false, message: 'Configuration MySQL/MariaDB manquante.' };
    }

    try {
      const res = await externalDbService.pushSnapshot(target, this.buildExternalSnapshotPayload());
      this.databaseConfig = {
        ...this.databaseConfig,
        status: 'connected',
        pendingOpsCount: 0,
        lastError: undefined,
        lastPing: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      };
      storageService.safeSetItem(STORAGE_KEYS.DATABASE_CONFIG, JSON.stringify(this.databaseConfig));
      this.logActivity('INFO', `Migration SQLite -> MySQL/MariaDB réussie (${res.message})`);
      this.notify();
      return { success: res.success, message: res.message };
    } catch (err: any) {
      const errMsg = typeof err === 'string' ? err : err?.message || String(err);
      return { success: false, message: `Échec migration MySQL/MariaDB : ${errMsg}` };
    }
  }

  public getChatMessages(channelId: string): ChatMessage[] {
    return chatService.getChatMessages(this.chatMessages, this.chatSettings, channelId);
  }

  public sendChatMessage(channelId: string, content: string): { success: boolean; message: string; chatMessage?: ChatMessage } {
    if (!this.chatSettings.enabled) {
      return { success: false, message: 'La messagerie est actuellement désactivée dans les paramètres' };
    }

    const cleanContent = content.trim();
    if (!cleanContent) {
      return { success: false, message: 'Le message est vide' };
    }

    const user = this.currentVolunteer;
    if (!user) {
      return { success: false, message: 'Vous devez être connecté pour envoyer un message' };
    }

    const timestamp = new Date().toISOString();
    const signaturePayload = `${user.id}:${user.username}:${cleanContent}:${timestamp}:${user.password}`;
    const signature = computeCrc32Hex(signaturePayload);

    const msgId = 'msg-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);
    const newMsg: ChatMessage = {
      id: msgId,
      channelId,
      authorId: user.id,
      authorName: user.name,
      authorRole: user.role,
      authorAvatarColor: user.avatarColor,
      authorBubbleColor: user.themeSettings?.bubbleColor,
      content: cleanContent,
      timestamp,
      signature
    };

    this.chatMessages.push(newMsg);
    this.saveChatMessages();
    this.dispatchExternalOp('insert_chat_message', newMsg);
    this.markChannelAsRead(channelId);
    chatService.broadcastChatUpdate();
    import('./syncService')
      .then(m => m.syncService.pushLocalChatMessages([newMsg]))
      .catch(() => {});
    this.notify();

    return { success: true, message: 'Message envoyé', chatMessage: newMsg };
  }

  public mergeIncomingChatMessages(incoming: ChatMessage[]): number {
    const { addedCount, mergedMessages } = chatService.mergeIncomingChatMessages(
      this.chatMessages,
      incoming,
      this.chatSettings,
      this.volunteers,
      msg => this.logActivity('SECURITY', msg)
    );

    if (addedCount > 0) {
      const existingIds = new Set(this.chatMessages.map(m => m.id));
      const newOnes = mergedMessages.filter(m => !existingIds.has(m.id));
      this.chatMessages = mergedMessages;
      this.purgeExpiredChatMessages();
      this.saveChatMessages();
      if (newOnes.length > 0) {
        this.dispatchExternalOp('insert_chat_message', newOnes);
      }
      this.notify();
    }

    return addedCount;
  }

  public purgeExpiredChatMessages(): number {
    const { purged, remaining } = chatService.purgeExpiredChatMessages(this.chatMessages, this.chatSettings.retentionDays);
    if (purged > 0) {
      this.chatMessages = remaining;
      this.saveChatMessages();
      if (this.chatSettings.retentionDays > 0) {
        const cutoffIso = new Date(Date.now() - this.chatSettings.retentionDays * 24 * 60 * 60 * 1000).toISOString();
        this.dispatchExternalOp('purge_chat_messages', { cutoffIso });
      }
    }
    return purged;
  }

  public getAllChatMessages(): ChatMessage[] {
    return [...this.chatMessages];
  }

  private saveVolunteerPerks(): void {
    perkService.saveVolunteerPerks(this.volunteerPerks);
  }

  public resetAll(): void {
    this.products = [];
    this.sales = [];
    this.sessions = [];
    this.activeSession = null;
    this.restocks = [];
    this.volunteerPerks = [];
    this.tpeLogs = [];
    this.snakeScores = [];
    this.logs = [];
    this.saveProducts();
    this.saveSales();
    this.saveSessions();
    this.saveRestocks();
    this.saveVolunteerPerks();
    this.saveTpeLogs();
    this.saveSnakeScores();
    this.saveLogs();
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_SESSION);
    }
    this.dispatchExternalOp('reset_operational_data', { resetProducts: true, resetVolunteers: false });
    this.logActivity('SECURITY', 'Réinitialisation complète des données effectuée');
    this.notify();
  }
}

export const db = new DatabaseService();
