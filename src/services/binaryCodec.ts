import { AddonPackage } from '../types/addon';

export interface DiskBackupInfo {
  fileName: string;
  path: string;
  sizeBytes: number;
  isBinary: boolean;
  modifiedSecs: number;
}

// Magic signatures:
// "MDLX" = [0x4D, 0x44, 0x4C, 0x58]
// "MDLB" = [0x4D, 0x44, 0x4C, 0x42]
const MDLX_MAGIC = [0x4d, 0x44, 0x4c, 0x58];
const MDLB_MAGIC = [0x4d, 0x44, 0x4c, 0x42];

function hasMagic(bytes: Uint8Array, magic: number[]): boolean {
  if (bytes.length < magic.length) return false;
  return magic.every((byte, i) => bytes[i] === byte);
}

/**
 * Compresse et encode un AddonPackage au format binaire OpenMDL Extension (.mdlx).
 */
export async function packAddonBinary(pkg: AddonPackage): Promise<Uint8Array> {
  const jsonStr = JSON.stringify(pkg);

  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const bytes = await invoke<number[]>('pack_addon_binary', { addonJson: jsonStr });
    return new Uint8Array(bytes);
  } catch (err) {
    console.warn('Tauri non disponible pour pack_addon_binary, fallback UTF-8 :', err);
    return new TextEncoder().encode(jsonStr);
  }
}

/**
 * Décode un fichier AddonPackage depuis un binaire .mdlx ou du JSON textuel (.json).
 */
export async function unpackAddonBinary(input: ArrayBuffer | Uint8Array | string): Promise<AddonPackage> {
  // Cas chaîne JSON directe
  if (typeof input === 'string') {
    const parsed = JSON.parse(input);
    if (!parsed.manifest || !parsed.manifest.id) {
      throw new Error('Format d\'addon invalide (manifest manquant).');
    }
    return parsed as AddonPackage;
  }

  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);

  // Si format binaire OpenMDL (MDLX)
  if (hasMagic(bytes, MDLX_MAGIC)) {
    const { invoke } = await import('@tauri-apps/api/core');
    const jsonStr = await invoke<string>('unpack_addon_binary', { bytes: Array.from(bytes) });
    const parsed = JSON.parse(jsonStr);
    if (!parsed.manifest || !parsed.manifest.id) {
      throw new Error('Format de package addon corrompu ou incomplet.');
    }
    return parsed as AddonPackage;
  }

  // Fallback : tentative de lecture texte UTF-8 si fichier JSON renommé ou import brut
  const text = new TextDecoder().decode(bytes);
  const parsed = JSON.parse(text);
  if (!parsed.manifest || !parsed.manifest.id) {
    throw new Error('Fichier non reconnu comme un addon OpenMDL valide (.mdlx ou .json).');
  }
  return parsed as AddonPackage;
}

/**
 * Compresse et encode un backup de la base de données au format binaire OpenMDL (.mdlb).
 */
export async function packBackupBinary(data: Record<string, any>): Promise<Uint8Array> {
  const jsonStr = JSON.stringify(data);

  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const bytes = await invoke<number[]>('pack_backup_binary', { backupJson: jsonStr });
    return new Uint8Array(bytes);
  } catch (err) {
    console.warn('Tauri non disponible pour pack_backup_binary, fallback UTF-8 :', err);
    return new TextEncoder().encode(jsonStr);
  }
}

/**
 * Décode un backup de la base de données depuis un binaire .mdlb ou un fichier JSON.
 */
export async function unpackBackupBinary(input: ArrayBuffer | Uint8Array | string): Promise<Record<string, any>> {
  if (typeof input === 'string') {
    return JSON.parse(input);
  }

  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);

  // Si format binaire OpenMDL (MDLB)
  if (hasMagic(bytes, MDLB_MAGIC)) {
    const { invoke } = await import('@tauri-apps/api/core');
    const jsonStr = await invoke<string>('unpack_backup_binary', { bytes: Array.from(bytes) });
    return JSON.parse(jsonStr);
  }

  // Fallback : décodage UTF-8 si JSON legacy
  const text = new TextDecoder().decode(bytes);
  return JSON.parse(text);
}

/**
 * Enregistre une sauvegarde binaire (.mdlb) directement dans le dossier backups de l'application.
 */
export async function saveBackupBinaryOnDisk(tag: string, data: Record<string, any>): Promise<string> {
  const jsonStr = JSON.stringify(data);
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<string>('save_backup_binary', { tag, data: jsonStr });
  } catch (err) {
    console.warn('Erreur lors de save_backup_binary :', err);
    throw err;
  }
}

/**
 * Liste les sauvegardes disponibles dans le dossier applicatif.
 */
export async function listDiskBackups(): Promise<DiskBackupInfo[]> {
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<DiskBackupInfo[]>('list_backups');
  } catch (err) {
    console.warn('Impossible de lister les backups depuis le disque :', err);
    return [];
  }
}

/**
 * Lit et décompresse un fichier de backup (.mdlb ou .json) depuis le disque.
 */
export async function readBackupFromDisk(filePath: string): Promise<Record<string, any>> {
  const { invoke } = await import('@tauri-apps/api/core');
  const jsonStr = await invoke<string>('read_backup_file', { filePath });
  return JSON.parse(jsonStr);
}

/**
 * Déclenche le téléchargement direct dans le navigateur / WebView d'un fichier binaire ou texte.
 */
export function triggerFileDownload(content: Uint8Array | string, filename: string, mimeType: string = 'application/octet-stream'): void {
  const blob = typeof content === 'string'
    ? new Blob([content], { type: mimeType })
    : new Blob([content as any], { type: mimeType });

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
