import type { DatabaseConnectionConfig, ExternalDatabaseConfig } from '../../types';

export interface MysqlTestResponse {
  success: boolean;
  serverVersion: string;
  message: string;
}

export interface MysqlOpResponse {
  synced: boolean;
  queued: boolean;
  pendingCount: number;
  error?: string | null;
}

export interface MysqlFlushResponse {
  flushedCount: number;
  remainingCount: number;
  error?: string | null;
}

export interface MysqlMigrateResponse {
  success: boolean;
  counts: Record<string, number>;
  message: string;
}

export function parseDatabaseUrl(rawUrl: string): Partial<ExternalDatabaseConfig> | null {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) return null;

  const lower = trimmed.toLowerCase();
  let dialect: 'mysql' | 'mariadb' = 'mysql';
  let rest = '';

  if (lower.startsWith('mariadb://')) {
    dialect = 'mariadb';
    rest = trimmed.slice('mariadb://'.length);
  } else if (lower.startsWith('mysql://')) {
    dialect = 'mysql';
    rest = trimmed.slice('mysql://'.length);
  } else {
    return null;
  }

  try {
    const parsed = new URL(`http://${rest}`);
    const host = parsed.hostname.replace(/^\[(.*)\]$/, '$1');
    const port = parsed.port ? parseInt(parsed.port, 10) : 3306;
    const database = decodeURIComponent(parsed.pathname.replace(/^\/+/, ''));
    const username = decodeURIComponent(parsed.username || '');
    const password = decodeURIComponent(parsed.password || '');

    const sslParam = (parsed.searchParams.get('ssl') || '').toLowerCase();
    const sslMode = (parsed.searchParams.get('sslmode') || parsed.searchParams.get('ssl-mode') || '').toLowerCase();
    const dangerInvalid = (parsed.searchParams.get('danger_accept_invalid_certs') || parsed.searchParams.get('acceptInvalidCerts') || '').toLowerCase();
    let ssl: boolean | undefined;
    if (sslParam === 'true' || sslParam === '1' || ['require', 'required', 'verify_ca', 'verify_full'].includes(sslMode)) {
      ssl = true;
    } else if (sslParam === 'false' || sslParam === '0' || sslMode === 'disable') {
      ssl = false;
    }

    let acceptInvalidCerts: boolean | undefined;
    if (dangerInvalid === 'true' || dangerInvalid === '1') {
      acceptInvalidCerts = true;
    } else if (dangerInvalid === 'false' || dangerInvalid === '0') {
      acceptInvalidCerts = false;
    }

    const result: Partial<ExternalDatabaseConfig> = {
      url: trimmed,
      dialect,
      host: host || '127.0.0.1',
      port: Number.isFinite(port) && port > 0 ? port : 3306,
      database: database || 'openmdl',
      username,
      password
    };
    if (ssl !== undefined) {
      result.ssl = ssl;
    }
    if (acceptInvalidCerts !== undefined) {
      result.acceptInvalidCerts = acceptInvalidCerts;
    }
    return result;
  } catch {
    return null;
  }
}

export function buildDatabaseUrl(cfg: ExternalDatabaseConfig): string {
  const scheme = cfg.dialect === 'mariadb' ? 'mariadb' : 'mysql';
  const userPart = cfg.username
    ? `${encodeURIComponent(cfg.username)}${cfg.password ? `:${encodeURIComponent(cfg.password)}` : ''}@`
    : '';
  const cleanHost = (cfg.host || '127.0.0.1').trim() || '127.0.0.1';
  const hostPart = cleanHost.includes(':') ? `[${cleanHost}]` : cleanHost;
  const portPart = Number(cfg.port) > 0 ? Number(cfg.port) : 3306;
  const dbPart = encodeURIComponent((cfg.database || 'openmdl').trim() || 'openmdl');
  const queryParams: string[] = [];
  if (cfg.ssl) {
    queryParams.push('ssl=true');
    if (cfg.acceptInvalidCerts) {
      queryParams.push('danger_accept_invalid_certs=true');
    }
  }
  const queryStr = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';
  return `${scheme}://${userPart}${hostPart}:${portPart}/${dbPart}${queryStr}`;
}

export class ExternalDbService {
  private opQueue: Promise<void> = Promise.resolve();
  private inFlightOps: Set<Promise<void>> = new Set();
  private autoSyncTimer: ReturnType<typeof setInterval> | null = null;
  private isAutoSyncRunning = false;

  public isExternalEnabled(config?: DatabaseConnectionConfig): boolean {
    return config?.engine === 'mysql' && Boolean(config.external);
  }

  private toRustConfig(external: ExternalDatabaseConfig) {
    return {
      url: (external.url || '').trim() || null,
      host: (external.host || '127.0.0.1').trim(),
      port: Number(external.port) || 3306,
      database: (external.database || 'openmdl').trim(),
      username: (external.username || '').trim(),
      password: external.password || '',
      dialect: external.dialect || 'mysql',
      ssl: Boolean(external.ssl),
      acceptInvalidCerts: Boolean(external.acceptInvalidCerts)
    };
  }

  public async testConnection(external: ExternalDatabaseConfig): Promise<MysqlTestResponse> {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke<MysqlTestResponse>('mysql_test_connection', {
        config: this.toRustConfig(external)
      });
    } catch (err: any) {
      return {
        success: false,
        serverVersion: '',
        message: typeof err === 'string' ? err : err?.message || 'Backend Tauri indisponible pour MySQL/MariaDB.'
      };
    }
  }

  public executeOp(
    config: DatabaseConnectionConfig,
    opType: string,
    payload: unknown,
    onStatusUpdate?: (status: {
      status: 'connected' | 'offline_cache' | 'error';
      pendingOpsCount: number;
      lastError?: string;
    }) => void
  ): Promise<void> {
    if (!this.isExternalEnabled(config) || !config.external) {
      return Promise.resolve();
    }

    const external = { ...config.external };
    const serializedPayload = JSON.stringify(payload ?? {});

    const run = async () => {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const res = await invoke<MysqlOpResponse>('mysql_execute_op', {
          config: this.toRustConfig(external),
          opType,
          payload: serializedPayload
        });

        if (onStatusUpdate) {
          onStatusUpdate({
            status: res.synced ? 'connected' : 'offline_cache',
            pendingOpsCount: res.pendingCount || 0,
            lastError: res.error || undefined
          });
        }
      } catch (err: any) {
        const msg = typeof err === 'string' ? err : err?.message || String(err);
        if (onStatusUpdate && !msg.includes('__TAURI_INTERNALS__')) {
          onStatusUpdate({
            status: 'offline_cache',
            pendingOpsCount: config.pendingOpsCount || 0,
            lastError: msg
          });
        }
      }
    };

    const chained = this.opQueue.then(run, run);
    this.opQueue = chained;
    this.inFlightOps.add(chained);
    chained.finally(() => {
      this.inFlightOps.delete(chained);
    });
    return chained;
  }

  public async flushInFlight(): Promise<void> {
    if (this.inFlightOps.size === 0) return;
    await Promise.allSettled(Array.from(this.inFlightOps));
  }

  public async flushPending(external: ExternalDatabaseConfig): Promise<MysqlFlushResponse> {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<MysqlFlushResponse>('mysql_flush_pending_ops', {
      config: this.toRustConfig(external)
    });
  }

  public async pullSnapshot(external: ExternalDatabaseConfig): Promise<Record<string, any>> {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<Record<string, any>>('mysql_pull_snapshot', {
      config: this.toRustConfig(external)
    });
  }

  public async pushSnapshot(external: ExternalDatabaseConfig, snapshot: Record<string, any>): Promise<MysqlMigrateResponse> {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<MysqlMigrateResponse>('mysql_push_snapshot', {
      config: this.toRustConfig(external),
      snapshot
    });
  }

  public async getPendingCount(): Promise<number> {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke<number>('sqlite_pending_sync_count');
    } catch {
      return 0;
    }
  }

  public async clearPendingOps(): Promise<void> {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke<void>('sqlite_clear_pending_sync_ops');
  }

  public startAutoSync(intervalSec: number, callback: () => void | Promise<void>): void {
    this.stopAutoSync();
    const sec = Math.max(5, Number(intervalSec) || 15);
    this.autoSyncTimer = setInterval(async () => {
      if (this.isAutoSyncRunning) return;
      this.isAutoSyncRunning = true;
      try {
        await callback();
      } catch {
        // Ignorer les erreurs réseau temporaires lors du polling
      } finally {
        this.isAutoSyncRunning = false;
      }
    }, sec * 1000);
  }

  public stopAutoSync(): void {
    if (this.autoSyncTimer) {
      clearInterval(this.autoSyncTimer);
      this.autoSyncTimer = null;
    }
  }
}

export const externalDbService = new ExternalDbService();
