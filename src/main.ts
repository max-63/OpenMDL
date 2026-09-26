import './style.css';
import { db } from './services/db';
import { addonManager } from './services/addonManager';
import { CartComponent } from './components/Cart';
import { HeaderComponent } from './components/Header';
import { CheckoutModalComponent } from './components/CheckoutModal';
import { LoginView } from './pages/LoginView';
import { DashboardView } from './pages/DashboardView';
import { CatalogView } from './pages/CatalogView';
import { RestockView } from './pages/RestockView';
import { StatsView } from './pages/StatsView';
import { SettingsView } from './pages/SettingsView';
import { TpeView } from './pages/TpeView';
import { PlanningView } from './pages/PlanningView';
import { AddonsView } from './pages/AddonsView';
import { CreditsView } from './pages/CreditsView';
import { DecaisseView } from './pages/DecaisseView';
import { SnakeModalComponent } from './components/SnakeModal';
import { syncService } from './services/syncService';
import { AppDialog } from './components/AppDialog';

class App {
  private appRoot: HTMLElement;
  private currentTab = db.getAppProfile() === 'visco' ? 'decaisse' : 'dashboard';
  private cart: CartComponent;

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

    // Instanciation du panier
    this.cart = new CartComponent(
      () => this.openCheckout(),
      () => this.render()
    );
    (window as any).__OPENMDL_CART__ = this.cart;

    // Écouter les changements de la base de données
    db.subscribe(() => {
      this.render();
    });

    // Écouter les changements du gestionnaire d'addons
    addonManager.subscribe(() => {
      this.render();
    });
    addonManager.setNavigationCallback((tabId: string) => {
      this.currentTab = tabId;
      this.render();
    });

    // Démarrer les addons actifs au lancement
    addonManager.initActiveAddons();

    // Écouter les alertes de fermeture du poste Foyer (pour clients Vie Scolaire)
    syncService.onShutdownAlert((msg) => {
      AppDialog.alert({
        title: 'Fermeture du Poste Foyer',
        message: msg,
        type: 'warning'
      });
      this.render();
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

    // Easter Egg: Haut Haut Bas Bas Droite Droite A A (Sauf Trésorier et Secrétaire)
    const SECRET_CODE = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowRight', 'ArrowRight', 'a', 'a'];
    let inputSequence: string[] = [];
    let sequenceTimer: any = null;

    window.addEventListener('keydown', (e) => {
      // Ignorer si l'utilisateur saisit dans un champ de texte
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }

      // Vérifier restriction : la modal ne marche QUE si un bénévole est connecté
      const user = db.getCurrentVolunteer();
      if (!user) {
        return;
      }
      const textToCheck = `${user.role} ${user.name} ${user.username}`.toLowerCase();
      const isExcluded = textToCheck.includes('tresor') || textToCheck.includes('trésor')
        || textToCheck.includes('secret') || textToCheck.includes('secrét');
      if (isExcluded) {
        return;
      }

      const key = e.key.toLowerCase() === 'a' ? 'a' : e.key;
      inputSequence.push(key);

      if (sequenceTimer) clearTimeout(sequenceTimer);
      sequenceTimer = setTimeout(() => {
        inputSequence = [];
      }, 3000);

      if (inputSequence.length > SECRET_CODE.length) {
        inputSequence.shift();
      }

      const match = inputSequence.length === SECRET_CODE.length && SECRET_CODE.every((val, idx) => inputSequence[idx] === val);
      if (match) {
        inputSequence = [];
        const snakeModal = new SnakeModalComponent();
        snakeModal.show();
      }
    });

    this.render();
  }

  private openCheckout(): void {
    const items = this.cart.getItems();
    if (items.length === 0) return;

    const checkoutModal = new CheckoutModalComponent(items, () => {
      this.cart.clear();
      this.render();
    });
    checkoutModal.show();
  }

  public render(): void {
    this.appRoot.innerHTML = '';

    const currentVolunteer = db.getCurrentVolunteer();

    // 1. Si aucun bénévole n'est connecté -> Afficher l'écran de Login
    if (!currentVolunteer) {
      this.appRoot.className = 'min-h-screen flex flex-col bg-slate-100 dark:bg-[#0b0f19]';
      const loginView = new LoginView(() => {
        this.currentTab = db.getAppProfile() === 'visco' ? 'decaisse' : 'dashboard';
        this.render();
      });
      this.appRoot.appendChild(loginView.render());
      return;
    }

    // 2. Si connecté -> Layout moderne plein écran avec îlots flottants (style IDE / VS Code)
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

    switch (this.currentTab) {
      case 'dashboard': {
        if (db.getAppProfile() === 'visco') {
          this.currentTab = 'decaisse';
          const decaisse = new DecaisseView();
          pageContainer.appendChild(decaisse.render());
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
      case 'addons': {
        if (currentVolunteer.isAdmin) {
          const addons = new AddonsView();
          pageContainer.appendChild(addons.render());
        } else {
          this.currentTab = db.getAppProfile() === 'visco' ? 'decaisse' : 'dashboard';
          this.render();
        }
        break;
      }
      case 'settings': {
        if (currentVolunteer.isAdmin || db.getAppProfile() === 'visco') {
          const settings = new SettingsView();
          pageContainer.appendChild(settings.render());
        } else {
          this.currentTab = db.getAppProfile() === 'visco' ? 'decaisse' : 'dashboard';
          this.render();
        }
        break;
      }
      case 'credits': {
        const credits = new CreditsView();
        pageContainer.appendChild(credits.render());
        break;
      }
      default: {
        // Vérifier si un onglet d'addon dynamique actif correspond
        const registeredTab = addonManager.getRegisteredTabs().find(t => t.id === this.currentTab);
        if (registeredTab) {
          const tabContainer = document.createElement('div');
          tabContainer.className = 'w-full h-full flex flex-col min-h-0 overflow-hidden animate-enter';
          registeredTab.render(tabContainer);
          pageContainer.appendChild(tabContainer);
          break;
        }

        if (db.getAppProfile() === 'visco') {
          const decaisse = new DecaisseView();
          pageContainer.appendChild(decaisse.render());
        } else {
          const dashboard = new DashboardView(this.cart);
          pageContainer.appendChild(dashboard.render());
        }
        break;
      }
    }

    this.appRoot.appendChild(pageContainer);
  }
}

// Démarrage de l'application
new App();
