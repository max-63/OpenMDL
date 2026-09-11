import './style.css';
import { db } from './services/db';
import { CartComponent } from './components/Cart';
import { HeaderComponent } from './components/Header';
import { CheckoutModalComponent } from './components/CheckoutModal';
import { LoginView } from './pages/LoginView';
import { DashboardView } from './pages/DashboardView';
import { CatalogView } from './pages/CatalogView';
import { RestockView } from './pages/RestockView';
import { StatsView } from './pages/StatsView';
import { SettingsView } from './pages/SettingsView';

class App {
  private appRoot: HTMLElement;
  private currentTab = 'dashboard';
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

    // Écouter les changements de la base de données
    db.subscribe(() => {
      this.render();
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
        this.currentTab = 'dashboard';
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
        const dashboard = new DashboardView(this.cart);
        pageContainer.appendChild(dashboard.render());
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
      case 'settings': {
        if (currentVolunteer.isAdmin) {
          const settings = new SettingsView();
          pageContainer.appendChild(settings.render());
        } else {
          this.currentTab = 'dashboard';
          const dashboard = new DashboardView(this.cart);
          pageContainer.appendChild(dashboard.render());
        }
        break;
      }
      default: {
        const dashboard = new DashboardView(this.cart);
        pageContainer.appendChild(dashboard.render());
        break;
      }
    }

    this.appRoot.appendChild(pageContainer);
  }
}

// Démarrage de l'application
new App();
