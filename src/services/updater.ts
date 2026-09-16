import { check, Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

export type UpdateStatus = 
  | 'idle' 
  | 'checking' 
  | 'up-to-date' 
  | 'available' 
  | 'downloading' 
  | 'ready-to-restart' 
  | 'error';

export interface UpdateState {
  status: UpdateStatus;
  currentVersion: string;
  availableVersion?: string;
  releaseNotes?: string;
  progressPercent: number;
  downloadedBytes: number;
  totalBytes: number;
  errorMessage?: string;
}

export class UpdaterService {
  private static instance: UpdaterService;
  private state: UpdateState = {
    status: 'idle',
    currentVersion: '1.0.4',
    progressPercent: 0,
    downloadedBytes: 0,
    totalBytes: 0
  };
  private activeUpdate: Update | null = null;
  private listeners: Set<(state: UpdateState) => void> = new Set();

  public static getInstance(): UpdaterService {
    if (!UpdaterService.instance) {
      UpdaterService.instance = new UpdaterService();
    }
    return UpdaterService.instance;
  }

  public getState(): UpdateState {
    return { ...this.state };
  }

  public subscribe(listener: (state: UpdateState) => void): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  private setState(partial: Partial<UpdateState>): void {
    this.state = { ...this.state, ...partial };
    this.listeners.forEach(fn => fn(this.getState()));
  }

  public async checkForUpdates(): Promise<void> {
    this.setState({ status: 'checking', errorMessage: undefined });
    try {
      const update = await check();
      if (update) {
        this.activeUpdate = update;
        this.setState({
          status: 'available',
          availableVersion: update.version,
          releaseNotes: update.body || 'Nouvelle version disponible avec correctifs et améliorations.',
          progressPercent: 0,
          downloadedBytes: 0,
          totalBytes: 0
        });
      } else {
        this.activeUpdate = null;
        this.setState({ status: 'up-to-date' });
      }
    } catch (err: any) {
      console.warn('Vérification des mises à jour:', err);
      const rawError = typeof err === 'string' ? err : (err?.message ? String(err.message) : String(err || ''));
      const msg = rawError.toLowerCase();
      // Si l'endpoint GitHub renvoie un code d'erreur (ex: 404 car latest.json n'est pas encore généré),
      // cela signifie qu'aucune mise à jour n'est disponible.
      if (
        msg.includes('status code') ||
        msg.includes('404') ||
        msg.includes('not found') ||
        msg.includes('successful status') ||
        msg.includes('network error')
      ) {
        this.activeUpdate = null;
        this.setState({ status: 'up-to-date' });
      } else {
        this.setState({
          status: 'error',
          errorMessage: rawError || 'Impossible de vérifier les mises à jour (vérifiez la connexion Internet).'
        });
      }
    }
  }

  public async downloadAndApply(): Promise<void> {
    if (!this.activeUpdate) return;

    this.setState({
      status: 'downloading',
      progressPercent: 0,
      downloadedBytes: 0,
      totalBytes: 0,
      errorMessage: undefined
    });

    try {
      let downloaded = 0;
      let total = 0;

      await this.activeUpdate.downloadAndInstall((event) => {
        if (event.event === 'Started') {
          total = event.data.contentLength || 0;
          this.setState({ totalBytes: total });
        } else if (event.event === 'Progress') {
          downloaded += event.data.chunkLength;
          const percent = total > 0 ? Math.min(100, Math.round((downloaded / total) * 100)) : 0;
          this.setState({
            downloadedBytes: downloaded,
            progressPercent: percent
          });
        } else if (event.event === 'Finished') {
          this.setState({
            progressPercent: 100,
            status: 'ready-to-restart'
          });
        }
      });

      this.setState({ status: 'ready-to-restart' });
    } catch (err: any) {
      console.error('Erreur téléchargement mise à jour:', err);
      this.setState({
        status: 'error',
        errorMessage: err?.message || 'Erreur lors du téléchargement de la mise à jour.'
      });
    }
  }

  public async restartApp(): Promise<void> {
    try {
      await relaunch();
    } catch (err) {
      console.error('Erreur redémarrage:', err);
    }
  }
}

export const updater = UpdaterService.getInstance();
