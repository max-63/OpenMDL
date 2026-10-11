import { storageService } from './storageService.ts';
import type { DatabaseConnectionConfig } from '../../types';

export class BackupService {
  public createAutomaticBackup(tag: string, exportDataFn: () => Record<string, any>, counts: { sales: number; products: number }): string {
    const backupPayload = exportDataFn();
    const fileName = `backup_${tag}_${new Date().toISOString().slice(0, 10)}.mdlb`;

    // Sauvegarde binaire sur disque via Tauri
    import('../binaryCodec').then(codec => {
      codec.saveBackupBinaryOnDisk(tag, backupPayload).catch(err => {
        console.warn('Sauvegarde disque échouée :', err);
      });
    }).catch(() => {});

    // Stockage dans l'historique des backups locaux (métadonnées uniquement)
    try {
      const jsonStr = JSON.stringify(backupPayload);
      const backupsListKey = 'openmdl_backups_index';
      const existing = JSON.parse(localStorage.getItem(backupsListKey) || '[]');
      existing.unshift({
        fileName,
        date: new Date().toISOString(),
        salesCount: counts.sales,
        productsCount: counts.products,
        size: jsonStr.length
      });
      storageService.safeSetItem(backupsListKey, JSON.stringify(existing.slice(0, 20)));
    } catch (e) {
      console.warn('Erreur indexation backup local:', e);
    }

    return fileName;
  }

  public getBackupsList(): Array<{ fileName: string; date: string; salesCount: number; productsCount: number }> {
    try {
      return JSON.parse(localStorage.getItem('openmdl_backups_index') || '[]');
    } catch {
      return [];
    }
  }

  public async exportDatabaseBlob(exportDataFn: () => Record<string, any>): Promise<Blob> {
    const data = exportDataFn();
    try {
      const { packBackupBinary } = await import('../binaryCodec.ts');
      const bin = await packBackupBinary(data);
      return new Blob([bin as any], { type: 'application/octet-stream' });
    } catch {
      const jsonStr = JSON.stringify(data, null, 2);
      return new Blob([jsonStr], { type: 'application/json' });
    }
  }
}

export const backupService = new BackupService();
