/**
 * Utilitaires de sécurité et d'assainissement pour OpenMDL
 */

/**
 * Neutralise les caractères spéciaux HTML afin de prévenir toute injection XSS
 * lors de l'insertion dans innerHTML.
 */
export function escapeHtml(str: unknown): string {
  if (str === null || str === undefined) return '';
  const s = String(str);
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Nettoie une chaîne de caractères pour les identifiants ou libellés :
 * supprime les espaces superflus et les caractères de contrôle.
 */
export function sanitizeText(str: string): string {
  if (!str) return '';
  return str.replace(/[\u0000-\u001F\u007F-\u009F]/g, '').trim();
}

/**
 * Ouvre une URL dans le navigateur par défaut du système (Edge, Chrome, Firefox, etc.)
 * Compatible Tauri (Linux xdg-open, Windows start, macOS open) et Fallback Web.
 */
export async function openExternalUrl(url: string): Promise<void> {
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('open_external_url', { url });
  } catch (err) {
    try {
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      window.location.href = url;
    }
  }
}

