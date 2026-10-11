import { getCurrentWindow } from '@tauri-apps/api/window';

type ResizeDirection = 'East' | 'North' | 'NorthEast' | 'NorthWest' | 'South' | 'SouthEast' | 'SouthWest' | 'West';

interface HandleConfig {
  dir: ResizeDirection;
  classes: string;
  cursor: string;
}

const HANDLES: HandleConfig[] = [
  // Coins (prioritaires en z-index)
  { dir: 'NorthWest', classes: 'top-0 left-0 w-3 h-3 z-[9999]', cursor: 'nwse-resize' },
  { dir: 'NorthEast', classes: 'top-0 right-0 w-3 h-3 z-[9999]', cursor: 'nesw-resize' },
  { dir: 'SouthWest', classes: 'bottom-0 left-0 w-3 h-3 z-[9999]', cursor: 'nesw-resize' },
  { dir: 'SouthEast', classes: 'bottom-0 right-0 w-3 h-3 z-[9999]', cursor: 'nwse-resize' },
  // Côtés
  { dir: 'North', classes: 'top-0 left-3 right-3 h-1.5 z-[9998]', cursor: 'ns-resize' },
  { dir: 'South', classes: 'bottom-0 left-3 right-3 h-1.5 z-[9998]', cursor: 'ns-resize' },
  { dir: 'West', classes: 'left-0 top-3 bottom-3 w-1.5 z-[9998]', cursor: 'ew-resize' },
  { dir: 'East', classes: 'right-0 top-3 bottom-3 w-1.5 z-[9998]', cursor: 'ew-resize' },
];

/**
 * Installe des poignées transparentes en bordure d'écran pour permettre
 * de redimensionner la fenêtre frameless sur Linux / WebKitGTK / Windows.
 */
export function setupWindowResizeHandles(): void {
  // S'assurer de n'exécuter qu'une seule fois
  if (document.getElementById('window-resize-handles')) return;

  const container = document.createElement('div');
  container.id = 'window-resize-handles';
  container.className = 'fixed inset-0 pointer-events-none z-[9997] select-none';

  let isMaximized = false;

  const checkMaximized = async () => {
    try {
      const appWindow = getCurrentWindow();
      isMaximized = await appWindow.isMaximized();
      if (isMaximized) {
        container.style.display = 'none';
      } else {
        container.style.display = 'block';
      }
    } catch {
      // Pas dans l'environnement Tauri ou fallback
      container.style.display = 'none';
    }
  };

  // Création des 8 poignées
  HANDLES.forEach(({ dir, classes, cursor }) => {
    const handle = document.createElement('div');
    handle.className = `fixed pointer-events-auto transition-colors ${classes}`;
    handle.style.cursor = cursor;
    handle.setAttribute('data-resize-handle', dir);

    handle.addEventListener('mousedown', async (e) => {
      // Clic gauche uniquement
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();

      try {
        const appWindow = getCurrentWindow();
        await appWindow.startResizeDragging(dir);
      } catch (err) {
        console.warn(`[Tauri Resize] Erreur startResizeDragging(${dir}):`, err);
      }
    });

    container.appendChild(handle);
  });

  document.body.appendChild(container);

  // Vérifier l'état maximisé au chargement et lors du redimensionnement de la fenêtre
  checkMaximized();
  window.addEventListener('resize', () => {
    checkMaximized();
  });

  // Écouter également les événements Tauri si disponibles
  try {
    const appWindow = getCurrentWindow();
    appWindow.onResized(() => checkMaximized());
  } catch {
    // ignoré si non tauri
  }
}
