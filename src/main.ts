import './style.css';
import { db } from './services/db';
import { storageService } from './services/db/storageService';
import { externalDbService } from './services/db/externalDbService';
import { CartComponent } from './components/Cart';
import { HeaderComponent } from './components/Header';
import { CheckoutModalComponent } from './components/CheckoutModal';
import { LoginView } from './pages/LoginView';
import { DashboardView } from './pages/DashboardView';
import { CatalogView } from './pages/CatalogView';
import { RestockView } from './pages/RestockView';
import { StatsView } from './pages/StatsView';
import { SettingsView } from './pages/SettingsView';
import { SystemView } from './pages/SystemView';
import { TpeView } from './pages/TpeView';
import { PlanningView } from './pages/PlanningView';
import { CreditsView } from './pages/CreditsView';
import { DecaisseView } from './pages/DecaisseView';
import { ChatView } from './pages/ChatView';
import { ProfileView } from './pages/ProfileView';
import { SnakeModalComponent } from './components/SnakeModal';
import { TerminalPosComponent } from './components/TerminalPos';
import { syncService } from './services/syncService';
import { AppDialog } from './components/AppDialog';
import { PaymentMethod } from './types';
import { setupWindowResizeHandles } from './utils/windowResize';
import { kofiService } from './services/kofiService';
import { openExternalUrl } from './utils/security';

class App {
  private appRoot: HTMLElement;
  private currentTab = db.getAppProfile() === 'visco' ? 'decaisse' : 'dashboard';
  private cart: CartComponent;
  private activeChatView: ChatView | null = null;
  private pendingRender = false;
  private lastRenderedTab: string | null = null;

  private isUiBusy(): boolean {
    if (document.querySelector('.fixed.inset-0.z-50, .fixed.inset-0.z-\\[10000\\]')) {
      return true;
    }
    const active = document.activeElement as HTMLElement | null;
    if (active && this.appRoot.contains(active)) {
      const tag = active.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || active.isContentEditable) {
        return true;
      }
    }
    return false;
  }

  private flushPendingRenderIfIdle(): void {
    if (!this.pendingRender) return;
    setTimeout(() => {
      if (this.pendingRender && !this.isUiBusy()) {
        this.pendingRender = false;
        this.render();
      }
    }, 50);
  }

  constructor() {
    const root = document.getElementById('app');
    if (!root) throw new Error('App root element not found');
    this.appRoot = root;

    // Initialisation du thème
    const savedTheme = localStorage.getItem('openmdl_theme') || 'dark';
    if (savedTheme === 'light') {
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
    }

    // Instanciation du panier avec support du mode de paiement direct
    this.cart = new CartComponent(
      (method: PaymentMethod) => this.openCheckout(method),
      () => this.render()
    );
    if (!(window as any).OpenMDL) {
      (window as any).OpenMDL = {};
    }
    (window as any).OpenMDL.previewImage = (src: string) => {
      const overlay = document.createElement('div');
      overlay.className = 'fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-enter cursor-pointer';
      overlay.innerHTML = `
        <div class="relative max-w-4xl max-h-[90vh] flex flex-col items-center">
          <img src="${src}" class="max-w-full max-h-[85vh] rounded-2xl object-contain shadow-2xl border border-white/10" />
          <button class="mt-3 px-4 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold backdrop-blur-md transition-all">
            Fermer l'aperçu
          </button>
        </div>
      `;
      overlay.addEventListener('click', () => overlay.remove());
      document.body.appendChild(overlay);
    };

    // Écouter les changements de la base de données
    db.subscribe(() => {
      // Si l'utilisateur est sur le chat, ne PAS détruire et recharger toute la page
      // Mettre à jour uniquement les badges du header et laisser ChatView actualiser son flux de messages en douceur
      if (this.currentTab === 'chat' && this.activeChatView) {
        this.updateHeaderChatBadge();
        this.activeChatView.refreshMessages();
      } else if (this.isUiBusy()) {
        // Éviter de détruire le DOM pendant une saisie active ou lorsqu'une modale est ouverte
        this.pendingRender = true;
        this.updateHeaderChatBadge();
      } else {
        this.pendingRender = false;
        this.render();
      }
    });

    this.appRoot.addEventListener('focusout', () => this.flushPendingRenderIfIdle());
    window.addEventListener('click', () => this.flushPendingRenderIfIdle());
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.flushPendingRenderIfIdle();
    });
    window.addEventListener('beforeunload', () => {
      void storageService.flushPendingWrites();
      void externalDbService.flushInFlight();
    });

    // Écouter les alertes de fermeture du poste Foyer (pour clients Vie Scolaire)
    syncService.onShutdownAlert((msg) => {
      AppDialog.alert({
        title: 'Fermeture du Poste Foyer',
        message: msg,
        type: 'warning'
      });
      this.render();
    });

    // Interception globale des liens externes (target="_blank" ou http/https) pour ouverture dans le navigateur système par défaut
    window.addEventListener('click', (e) => {
      const target = (e.target as HTMLElement).closest('a');
      if (target && target.href && (target.href.startsWith('http://') || target.href.startsWith('https://'))) {
        e.preventDefault();
        openExternalUrl(target.href);
      }
    });

    // Support touche F11 pour basculer en plein écran Kiosque immersif
    window.addEventListener('keydown', (e) => {
      if (e.key === 'F11') {
        e.preventDefault();
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
        } else {
          document.exitFullscreen().catch(() => {});
        }
      }
    });

    // Easter Egg Snake/Pacman: Haut Haut Bas Bas Droite Droite A A (Sauf Trésorier et Secrétaire)
    const SECRET_CODE = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowRight', 'ArrowRight', 'a', 'a'];
    // Mode Console Terminal POS : Droite Droite Bas Bas M D L
    const TERMINAL_CODE = ['ArrowRight', 'ArrowRight', 'ArrowDown', 'ArrowDown', 'm', 'd', 'l'];
    
    let inputSequence: string[] = [];
    let sequenceTimer: any = null;
    let terminalPosComponent: TerminalPosComponent | null = null;

    window.addEventListener('keydown', (e) => {
      // Ignorer si l'utilisateur saisit dans un champ de texte classique
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }

      // Normalisation de la touche (ex: M -> m)
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      inputSequence.push(key);

      if (sequenceTimer) clearTimeout(sequenceTimer);
      sequenceTimer = setTimeout(() => {
        inputSequence = [];
      }, 3000);

      // Limiter la taille du buffer au max des 2 séquences
      const maxLen = Math.max(SECRET_CODE.length, TERMINAL_CODE.length);
      if (inputSequence.length > maxLen) {
        inputSequence.shift();
      }

      // 1. Détection du code Terminal POS (Droite Droite Bas Bas M D L)
      const lastTerminalSeq = inputSequence.slice(-TERMINAL_CODE.length);
      const matchTerminal = lastTerminalSeq.length === TERMINAL_CODE.length && TERMINAL_CODE.every((val, idx) => lastTerminalSeq[idx] === val);
      if (matchTerminal) {
        inputSequence = [];
        if (!terminalPosComponent) {
          terminalPosComponent = new TerminalPosComponent(() => {
            this.render();
          });
        }
        terminalPosComponent.toggle();
        return;
      }

      // 2. Détection Easter Egg Pacman / Snake
      const user = db.getCurrentVolunteer();
      if (user) {
        const textToCheck = `${user.role} ${user.name} ${user.username}`.toLowerCase();
        const isExcluded = textToCheck.includes('tresor') || textToCheck.includes('trésor')
          || textToCheck.includes('secret') || textToCheck.includes('secrét');
        
        if (!isExcluded) {
          const lastSnakeSeq = inputSequence.slice(-SECRET_CODE.length);
          const matchSnake = lastSnakeSeq.length === SECRET_CODE.length && SECRET_CODE.every((val, idx) => lastSnakeSeq[idx] === val);
          if (matchSnake) {
            inputSequence = [];
            const snakeModal = new SnakeModalComponent();
            snakeModal.show();
            return;
          }
        }
      }

      // Raccourcis caisse Dashboard en plein rush (quand aucune modale n'est ouverte)
      if (this.currentTab === 'dashboard' && this.cart.getItems().length > 0 && !document.querySelector('.fixed.inset-0.z-50')) {
        if (e.key === 'F1') {
          e.preventDefault();
          this.openCheckout('especes');
        } else if (e.key === 'F2') {
          e.preventDefault();
          this.openCheckout('tpe');
        } else if (e.key === 'Enter') {
          e.preventDefault();
          this.openCheckout('especes');
        }
      }
    });

    this.render();
  }

  private openCheckout(defaultMethod: PaymentMethod = 'especes'): void {
    const items = this.cart.getItems();
    if (items.length === 0) return;

    const checkoutModal = new CheckoutModalComponent(items, () => {
      this.cart.clear();
      this.render();
    }, defaultMethod);
    checkoutModal.show();
  }

  private getDefaultTab(volunteer: ReturnType<typeof db.getCurrentVolunteer>): string {
    const perms = db.getEffectivePermissions(volunteer);
    if (db.getAppProfile() === 'visco') {
      if (perms.canViewDecaisse) return 'decaisse';
      if (perms.canViewStats) return 'stats';
      return 'agenda';
    }
    if (perms.canSell) return 'dashboard';
    if (perms.canViewCatalog) return 'catalog';
    if (perms.canViewStats) return 'stats';
    if (perms.canViewDecaisse) return 'decaisse';
    if (perms.canViewTpe) return 'tpe';
    if (perms.canManageUsers) return 'settings';
    return 'agenda';
  }

  public render(): void {
    const prevScrollEl = this.appRoot.querySelector('main > *') as HTMLElement | null;
    const savedScrollTop = this.lastRenderedTab === this.currentTab && prevScrollEl ? prevScrollEl.scrollTop : 0;

    this.appRoot.innerHTML = '';

    const currentVolunteer = db.getCurrentVolunteer();

    // 1. Si aucun bénévole n'est connecté -> Afficher l'écran de Login
    if (!currentVolunteer) {
      this.appRoot.className = 'min-h-screen flex flex-col bg-slate-100 dark:bg-[#0b0f19]';
      const loginView = new LoginView(() => {
        this.currentTab = this.getDefaultTab(db.getCurrentVolunteer());
        this.render();
      });
      this.appRoot.appendChild(loginView.render());
      return;
    }

    const perms = db.getEffectivePermissions(currentVolunteer);
    const isTabAllowed = (tab: string): boolean => {
      switch (tab) {
        case 'dashboard': return db.getAppProfile() !== 'visco' && perms.canSell;
        case 'decaisse': return perms.canViewDecaisse;
        case 'catalog': return perms.canViewCatalog;
        case 'restock': return perms.canRestock;
        case 'stats': return perms.canViewStats;
        case 'tpe': return perms.canViewTpe;
        case 'settings': return perms.canManageUsers;
        case 'system': return perms.canAccessSystem;
        case 'agenda':
        case 'credits':
        case 'chat':
        case 'profile':
          return true;
        default:
          return false;
      }
    };

    if (!isTabAllowed(this.currentTab)) {
      this.currentTab = this.getDefaultTab(currentVolunteer);
    }

    // 2. Si connecté -> Layout moderne plein écran avec îlots flottants (style IDE / VS Code)
    kofiService.hideOverlay();
    this.appRoot.className = 'h-screen w-screen flex flex-col overflow-hidden bg-slate-200/60 dark:bg-[#090d16] p-3 gap-3 antialiased';

    const activeSession = db.getActiveSession();
    const header = new HeaderComponent(
      this.currentTab,
      (tab: string) => {
        this.currentTab = tab;
        this.render();
      },
      () => {
        this.cart.clear();
        this.render();
      }
    );

    this.appRoot.appendChild(header.render(currentVolunteer, activeSession));

    // Conteneur principal de page (îlot 100% hauteur restant)
    const pageContainer = document.createElement('main');
    pageContainer.className = 'flex-1 flex flex-col min-h-0 overflow-hidden';
    pageContainer.setAttribute('data-active-tab', this.currentTab);

    switch (this.currentTab) {
      case 'dashboard': {
        if (db.getAppProfile() === 'visco') {
          this.currentTab = this.getDefaultTab(currentVolunteer);
          const agendaFallback = this.currentTab === 'decaisse' ? new DecaisseView() : new PlanningView(() => this.render());
          pageContainer.appendChild(agendaFallback.render());
        } else {
          const dashboard = new DashboardView(this.cart);
          pageContainer.appendChild(dashboard.render());
        }
        break;
      }
      case 'decaisse': {
        const decaisse = new DecaisseView();
        pageContainer.appendChild(decaisse.render());
        break;
      }
      case 'catalog': {
        const catalog = new CatalogView(() => this.render());
        pageContainer.appendChild(catalog.render());
        break;
      }
      case 'restock': {
        const restock = new RestockView(() => this.render());
        pageContainer.appendChild(restock.render());
        break;
      }
      case 'stats': {
        const stats = new StatsView();
        pageContainer.appendChild(stats.render());
        break;
      }
      case 'agenda': {
        const planning = new PlanningView(() => this.render());
        pageContainer.appendChild(planning.render());
        break;
      }
      case 'tpe': {
        const tpeView = new TpeView(() => this.render());
        pageContainer.appendChild(tpeView.render());
        break;
      }
      case 'settings': {
        const settings = new SettingsView(
          () => this.render(),
          (tab) => {
            this.currentTab = tab;
            this.render();
          }
        );
        pageContainer.appendChild(settings.render());
        setTimeout(() => {
          kofiService.showOverlay('settings');
        }, 100);
        break;
      }
      case 'system': {
        const systemView = new SystemView(
          () => this.render(),
          (tab) => {
            this.currentTab = tab;
            this.render();
          }
        );
        pageContainer.appendChild(systemView.render());
        break;
      }
      case 'credits': {
        const credits = new CreditsView();
        pageContainer.appendChild(credits.render());
        break;
      }
      case 'chat': {
        this.activeChatView = new ChatView();
        pageContainer.appendChild(this.activeChatView.render());
        break;
      }
      case 'profile': {
        this.activeChatView = null;
        const profileView = new ProfileView(() => this.render());
        pageContainer.appendChild(profileView.render());
        break;
      }
      default: {
        this.activeChatView = null;
        const planning = new PlanningView(() => this.render());
        pageContainer.appendChild(planning.render());
        break;
      }
    }

    this.appRoot.appendChild(pageContainer);
    this.lastRenderedTab = this.currentTab;
    if (savedScrollTop > 0) {
      const nextScrollEl = pageContainer.firstElementChild as HTMLElement | null;
      if (nextScrollEl) {
        nextScrollEl.scrollTop = savedScrollTop;
      }
    }
  }

  private updateHeaderChatBadge(): void {
    if (!db.getChatSettings().enabled) return;
    const unread = db.getUnreadDirectMessagesCount();
    const dot = document.getElementById('chat-badge-dot');
    const count = document.getElementById('chat-badge-count');
    if (dot) {
      if (unread > 0) dot.classList.remove('hidden');
      else dot.classList.add('hidden');
    }
    if (count) {
      if (unread > 0) {
        count.textContent = String(unread);
        count.classList.remove('hidden');
      } else {
        count.classList.add('hidden');
      }
    }
  }
}

// Démarrage de l'application avec persistance native SQLite
(async () => {
  try {
    await db.initSqlitePersistence();
  } catch (err) {
    console.warn('Initialisation SQLite Tauri :', err);
  }
  setupWindowResizeHandles();
  new App();
})();
