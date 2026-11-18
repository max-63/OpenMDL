import { STORAGE_KEYS, type ActivityLog } from './constants.ts';
import type { ChatMessage } from '../../types';

export class StorageService {
  private pendingWrites: Set<Promise<void>> = new Set();

  public persistToSqlite(key: string, value: string): Promise<void> {
    const task = (async () => {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('sqlite_set_key', { key, value });
      } catch {
        // Ignorer si Tauri non disponible (ex: environnement test ou web pur)
      }
    })();

    this.pendingWrites.add(task);
    task.finally(() => {
      this.pendingWrites.delete(task);
    });
    return task;
  }

  public async flushPendingWrites(): Promise<void> {
    if (this.pendingWrites.size === 0) return;
    await Promise.allSettled(Array.from(this.pendingWrites));
  }

  public setLocalCacheOnly(key: string, value: string): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, value);
      }
    } catch {
      // Ignorer si quota dépassé : SQLite conserve la donnée
    }
  }

  public safeSetItem(key: string, value: string, cleanQuotaCallback?: () => void): void {
    // 1. Persistance native SQLite prioritaire et permanente
    this.persistToSqlite(key, value);

    // 2. Cache LocalStorage synchrone pour lecture instantanée
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, value);
      }
    } catch (err: any) {
      if (err?.name === 'QuotaExceededError' || err?.code === 22 || err?.message?.includes('quota')) {
        console.warn(`QuotaExceededError sur ${key} en LocalStorage (la base SQLite conserve déjà la donnée en sécurité), nettoyage d'urgence du cache LocalStorage...`);
        if (cleanQuotaCallback) {
          cleanQuotaCallback();
        } else {
          this.cleanLocalStorageQuota();
        }
        try {
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem(key, value);
          }
        } catch {
          // Si le cache LocalStorage sature malgré la purge, SQLite a déjà reçu la donnée !
        }
      } else {
        throw err;
      }
    }
  }

  public cleanLocalStorageQuota(context?: { logs?: ActivityLog[]; tpeLogs?: any[]; chatMessages?: ChatMessage[] }): void {
    if (typeof localStorage === 'undefined') return;
    try {
      // 1. Éliminer toutes les sauvegardes stockées en cache local (backup_data_*)
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (k.startsWith('backup_data_') || k.startsWith('openmdl_temp_') || k.startsWith('temp_'))) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));

      // 2. Réduire l'index des sauvegardes à 10 max
      const backupsListKey = 'openmdl_backups_index';
      const storedBackups = localStorage.getItem(backupsListKey);
      if (storedBackups) {
        try {
          const list = JSON.parse(storedBackups);
          if (Array.isArray(list) && list.length > 10) {
            localStorage.setItem(backupsListKey, JSON.stringify(list.slice(0, 10)));
          }
        } catch {}
      }

      // 3. Tronquer les logs d'activité à 100 max
      if (context?.logs && context.logs.length > 100) {
        context.logs.splice(100);
        try {
          localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(context.logs));
        } catch {}
      }

      // 4. Tronquer les logs TPE à 100 max
      if (context?.tpeLogs && context.tpeLogs.length > 100) {
        context.tpeLogs.splice(100);
        try {
          localStorage.setItem(STORAGE_KEYS.TPE_LOGS, JSON.stringify(context.tpeLogs));
        } catch {}
      }

      // 5. Tronquer les messages de chat (garder les 60 derniers) et supprimer les avatars base64
      if (context?.chatMessages && context.chatMessages.length > 0) {
        if (context.chatMessages.length > 60) {
          context.chatMessages.splice(0, context.chatMessages.length - 60);
        }
        context.chatMessages.forEach(m => {
          if (m.authorAvatarUrl) delete m.authorAvatarUrl;
        });
        try {
          localStorage.setItem(STORAGE_KEYS.CHAT_MESSAGES, JSON.stringify(context.chatMessages));
        } catch {}
      }
    } catch (e) {
      console.error('Erreur lors du nettoyage d\'urgence de quota:', e);
    }
  }
}

export const storageService = new StorageService();
