import { openExternalUrl } from '../utils/security';

/**
 * Service de gestion des widgets de soutien Ko-fi.
 * Ne charge les scripts et n'affiche les boutons que si une connexion Internet active est détectée.
 */

declare global {
  interface Window {
    kofiWidgetOverlay?: {
      draw: (id: string, config: Record<string, string>) => void;
    };
    kofiwidget2?: {
      init: (text: string, color: string, id: string) => void;
      draw: () => void;
      getHTML?: () => string;
    };
  }
}

class KofiService {
  private overlayLoaded = false;
  private widget2Loaded = false;
  private currentContext: 'login' | 'settings' | 'none' = 'none';

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        if (this.currentContext === 'login') {
          this.showOverlay();
        } else if (this.currentContext === 'settings') {
          this.showOverlay();
        }
      });
      window.addEventListener('offline', () => {
        this.hideOverlay();
      });
    }
  }

  public checkOnline(): boolean {
    return typeof navigator !== 'undefined' && navigator.onLine;
  }

  /**
   * Charge le script Ko-fi Floating Chat Overlay
   */
  public async loadOverlayWidget(): Promise<boolean> {
    if (!this.checkOnline()) return false;
    if (this.overlayLoaded && window.kofiWidgetOverlay) return true;

    return new Promise((resolve) => {
      const existingScript = document.querySelector('script[src*="overlay-widget.js"]');
      if (existingScript && window.kofiWidgetOverlay) {
        this.overlayLoaded = true;
        resolve(true);
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://storage.ko-fi.com/cdn/scripts/overlay-widget.js';
      script.async = true;
      script.onload = () => {
        this.overlayLoaded = true;
        resolve(true);
      };
      script.onerror = () => {
        console.warn('[Ko-fi] Impossible de charger overlay-widget.js');
        resolve(false);
      };
      document.head.appendChild(script);
    });
  }

  /**
   * Charge le script Ko-fi Widget 2
   */
  public async loadWidget2(): Promise<boolean> {
    if (!this.checkOnline()) return false;
    if (this.widget2Loaded && window.kofiwidget2) return true;

    return new Promise((resolve) => {
      const existingScript = document.querySelector('script[src*="Widget_2.js"]');
      if (existingScript && window.kofiwidget2) {
        this.widget2Loaded = true;
        resolve(true);
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://storage.ko-fi.com/cdn/widget/Widget_2.js';
      script.async = true;
      script.onload = () => {
        this.widget2Loaded = true;
        resolve(true);
      };
      script.onerror = () => {
        console.warn('[Ko-fi] Impossible de charger Widget_2.js');
        resolve(false);
      };
      document.head.appendChild(script);
    });
  }

  /**
   * Affiche l'overlay flottant Ko-fi officiel en orange OpenMDL
   */
  public async showOverlay(context: 'login' | 'settings' = 'login'): Promise<void> {
    this.currentContext = context;
    if (!this.checkOnline()) {
      this.hideOverlay();
      return;
    }

    const loaded = await this.loadOverlayWidget();
    if (!loaded || !window.kofiWidgetOverlay) return;

    try {
      const floatingBtn = document.querySelector('.floatingchat-container-wrap');
      if (floatingBtn) {
        (floatingBtn as HTMLElement).style.display = 'block';
        return;
      }

      window.kofiWidgetOverlay.draw('adriencourault', {
        'type': 'floating-chat',
        'floating-chat.donateButton.text': 'Support me',
        'floating-chat.donateButton.background-color': '#ea580c',
        'floating-chat.donateButton.text-color': '#fff'
      });
    } catch (err) {
      console.warn('[Ko-fi] Erreur affichage overlay:', err);
    }
  }

  /**
   * Masque l'overlay flottant
   */
  public hideOverlay(): void {
    this.currentContext = 'none';
    const containers = document.querySelectorAll('.floatingchat-container-wrap, .floating-chat-kofi-popup-iframe');
    containers.forEach((el) => {
      (el as HTMLElement).style.display = 'none';
    });
  }

  /**
   * Rend le bouton Ko-fi Widget 2 officiel dans la hotbar
   */
  public async renderHotbarWidget(targetEl: HTMLElement): Promise<void> {
    if (!this.checkOnline()) {
      targetEl.innerHTML = '';
      return;
    }

    // Conteneur bouton hotbar responsive
    targetEl.innerHTML = `
      <button 
        type="button" 
        id="btn-hotbar-kofi"
        class="hidden 2xl:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-500 active:scale-95 text-white text-xs font-bold shadow-xs hover:shadow-orange-600/30 transition-all cursor-pointer group select-none"
        title="Soutenir le développement du projet OpenMDL sur Ko-fi"
      >
        <svg class="w-3.5 h-3.5 fill-current text-white group-hover:scale-110 transition-transform" viewBox="0 0 24 24">
          <path d="M23.881 8.948c-.773-4.085-4.859-4.593-4.859-4.593H.723c-.604 0-.679.798-.679.798s-.082 7.324-.022 11.822c.164 2.424 2.586 2.672 2.586 2.672s8.267-.023 11.966-.049c2.438-.426 2.683-2.566 2.658-3.734 4.352.24 7.422-2.831 6.649-6.916zm-11.062 3.511c-1.246 1.453-4.047 3.974-4.047 3.974s-2.8-2.521-4.047-3.974c-1.333-1.556-1.077-3.65.486-4.567 1.563-.917 3.561.047 3.561.047s1.998-.964 3.561-.047c1.563.917 1.819 3.011.486 4.567zm5.418 1.482c-.389 1.046-1.299 1.454-2.43 1.454h-.688V7.127h.688c1.131 0 2.041.408 2.43 1.454.412 1.11.412 3.253 0 4.363z"/>
        </svg>
        <span class="font-extrabold tracking-tight">Soutenir</span>
      </button>
    `;

    targetEl.querySelector('#btn-hotbar-kofi')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openExternalUrl('https://ko-fi.com/adriencourault');
    });

    // Chargement de Widget_2 en tâche de fond si souhaité
    this.loadWidget2().catch(() => {});
  }
}

export const kofiService = new KofiService();
