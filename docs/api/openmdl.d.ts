/**
 * OpenMDL Addon API - Définition TypeScript Officielle
 * Logiciel de caisse et de gestion pour Maisons des Lycéens (MDL / CVL)
 * 100% Libre, Gratuit et Hors-ligne
 */

interface Product {
  id: string;
  name: string;
  category: 'boissons' | 'snacks' | 'fournitures' | 'goodies' | 'evenements' | string;
  price: number;
  costPrice: number;
  stock: number;
  minStockAlert: number;
  imageUrl?: string;
  color?: string;
  barcode?: string;
  isActive: boolean;
  isFavorite?: boolean;
}

interface SaleItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  costPrice?: number;
}

interface Sale {
  id: string;
  sessionId: string;
  volunteerId: string;
  volunteerName: string;
  items: SaleItem[];
  totalAmount: number;
  paymentMethod: 'especes' | 'tpe' | 'cash' | 'card';
  cashReceived?: number;
  cashReturned?: number;
  timestamp: string;
  cancelled?: boolean;
  cancelReason?: string;
}

interface Session {
  id: string;
  volunteerId: string;
  volunteerName: string;
  openedAt: string;
  closedAt?: string;
  initialCash?: number;
  expectedCash?: number;
  actualCash?: number;
  cashDifference?: number;
  totalCard?: number;
  totalSales?: number;
  commentary?: string;
  volunteerPerkClaimed?: boolean;
  perkProductId?: string;
}

interface Volunteer {
  id: string;
  username: string;
  name: string;
  role?: string;
  isAdmin?: boolean;
}

interface CartItem {
  product: Product;
  quantity: number;
}

interface PerkSettings {
  enabled: boolean;
  maxPerksPerSession: number;
  eligibleCategories: string[];
}

interface RegisteredTab {
  id: string;
  label: string;
  icon: string;
  addonId: string;
  render: (container: HTMLElement) => void;
}

interface RegisteredWidget {
  id: string;
  title: string;
  addonId: string;
  render: (container: HTMLElement) => void;
}

type OpenMdlEventType =
  | 'sale:completed'
  | 'sale:cancelled'
  | 'session:opened'
  | 'session:closed'
  | 'cart:updated'
  | 'product:updated'
  | 'product:deleted'
  | 'stock:updated'
  | 'theme:changed'
  | 'volunteer:login'
  | 'volunteer:logout'
  | 'perk:claimed';

type OpenMdlEventListener = (payload: any) => void;

interface IOpenMdlApi {
  readonly version: string;
  readonly appName: string;
  readonly author: string;
  readonly authorUrl: string;

  /**
   * Navigation et onglets de l'application
   */
  readonly navigation: {
    /** Enregistre un nouvel onglet principal dans la barre de navigation */
    registerTab: (tab: {
      id: string;
      label: string;
      icon?: string;
      render: (container: HTMLElement) => void;
    }) => void;
    /** Retire un onglet personnalisé */
    unregisterTab: (tabId: string) => void;
    /** Ouvre un onglet spécifique */
    goTo: (tabId: string) => void;
    /** Identifiant de l'onglet actif */
    getCurrentTab: () => string;
    /** Liste des onglets personnalisés enregistrés */
    getRegisteredTabs: () => RegisteredTab[];
    /** Rafraîchit l'affichage courant */
    refresh: () => void;
  };

  /**
   * Tableau de bord et widgets d'accueil
   */
  readonly dashboard: {
    /** Enregistre un widget personnalisé sur l'écran d'accueil */
    registerWidget: (widget: {
      id: string;
      title: string;
      render: (container: HTMLElement) => void;
    }) => void;
    /** Retire un widget personnalisé */
    unregisterWidget: (widgetId: string) => void;
    /** Liste des widgets enregistrés */
    getRegisteredWidgets: () => RegisteredWidget[];
  };

  /**
   * Catalogue des produits et gestion des stocks
   */
  readonly products: {
    /** Liste tous les produits du catalogue */
    list: () => Product[];
    /** Récupère un produit par son identifiant unique */
    get: (id: string) => Product | undefined;
    /** Filtre les produits par catégorie */
    getByCategory: (category: string) => Product[];
    /** Recherche textuelle dans le catalogue (nom, catégorie, code-barres) */
    search: (query: string) => Product[];
    /** Crée un nouveau produit */
    create: (product: Omit<Product, 'id'>) => { success: boolean; message: string; product?: Product };
    /** Met à jour les propriétés d'un produit */
    update: (id: string, updates: Partial<Product>) => { success: boolean; message: string };
    /** Supprime un produit du catalogue */
    delete: (id: string) => { success: boolean; message: string };
    /** Ajoute de la quantité au stock avec motif optionnel */
    restock: (id: string, quantityToAdd: number, reason?: string) => { success: boolean; message: string };
    /** Définit directement la quantité exacte en stock */
    setStock: (id: string, newStock: number) => { success: boolean; message: string };
    /** Liste toutes les catégories disponibles */
    getCategories: () => string[];
    /** Liste des produits favoris en accès rapide */
    getFavorites: () => Product[];
    /** Bascule l'état favori d'un produit */
    toggleFavorite: (id: string) => boolean;
    /** Exporte tous les produits au format tableau */
    export: () => Product[];
    /** Importe un lot de produits */
    import: (products: Product[]) => { success: boolean; count: number };
  };

  /**
   * Historique des ventes et statistiques de caisse
   */
  readonly sales: {
    /** Liste toutes les ventes enregistrées */
    list: () => Sale[];
    /** Récupère une vente par son identifiant unique */
    get: (id: string) => Sale | undefined;
    /** Liste les ventes enregistrées aujourd'hui */
    getTodaySales: () => Sale[];
    /** Liste les ventes associées à une séance spécifique */
    getSessionSales: (sessionId: string) => Sale[];
    /** Récupère les ventes dans un intervalle de dates ISO */
    getByDateRange: (startDate: string, endDate: string) => Sale[];
    /** Enregistre manuellement une vente en base de données */
    record: (saleData: {
      items: Array<{ product: Product; quantity: number } | SaleItem>;
      paymentMethod: 'especes' | 'tpe' | 'cash' | 'card';
      cashReceived?: number;
      cashReturned?: number;
    }) => { success: boolean; sale?: Sale; message: string };
    /** Annule une vente et restaure optionnellement les stocks */
    cancel: (saleId: string, restoreStock?: boolean) => { success: boolean; message: string };
    /** Calcule les indicateurs financiers et statistiques de vente */
    getStats: (timeframe?: 'day' | 'week' | 'month' | 'all') => {
      totalRevenue: number;
      totalItems: number;
      salesCount: number;
      averageBasket: number;
      topProducts: { id: string; name: string; quantity: number; revenue: number }[];
      paymentMethods: { cash: number; card: number };
    };
    /** Exporte les ventes au format CSV */
    exportCsv: () => string;
  };

  /**
   * Panier d'encaissement en direct
   */
  readonly cart: {
    /** Liste les articles actuellement dans le panier */
    getItems: () => CartItem[];
    /** Récupère la ligne d'un produit dans le panier */
    getItem: (productId: string) => CartItem | undefined;
    /** Ajoute un produit au panier */
    add: (product: Product | string, quantity?: number) => void;
    /** Retire une quantité ou supprime la ligne si quantité <= 0 */
    remove: (productId: string, quantity?: number) => void;
    /** Fixe la quantité exacte d'un article dans le panier */
    setQuantity: (productId: string, quantity: number) => void;
    /** Vide l'intégralité du panier */
    clear: () => void;
    /** Calcule le montant total du panier en euros */
    getTotal: () => number;
    /** Nombre total d'articles dans le panier */
    getItemCount: () => number;
    /** Valide le panier en cours et crée la vente correspondante */
    checkout: (options: {
      paymentMethod: 'especes' | 'tpe' | 'cash' | 'card';
    }) => Promise<{ success: boolean; message: string; sale?: Sale }>;
  };

  /**
   * Séances de caisse et états de service
   */
  readonly sessions: {
    /** Séance actuellement ouverte (ou null) */
    getActive: () => Session | null;
    /** Indique si une séance de caisse est active */
    isOpen: () => boolean;
    /** Historique complet des séances */
    getHistory: () => Session[];
    /** Récupère une séance par son identifiant unique */
    get: (id: string) => Session | undefined;
    /** Ouvre une nouvelle séance de caisse */
    open: (options?: { notes?: string }) => { success: boolean; session?: Session; message: string };
    /** Clôture la séance de caisse en cours */
    close: (options: {
      commentary?: string;
      volunteerPerkClaimed?: boolean;
      perkProductId?: string;
    }) => { success: boolean; session?: Session; message: string };
    /** Récupère le brouillon de clôture temporaire */
    getDraftClosing: () => { commentary: string; volunteerPerkClaimed: boolean } | null;
    /** Enregistre un brouillon de clôture sans fermer la séance */
    saveDraftClosing: (draft: { commentary: string; volunteerPerkClaimed: boolean }) => void;
    /** Efface le brouillon de clôture */
    clearDraftClosing: () => void;
    /** Vérifie si un bénévole a le droit de consommer sa collation */
    canClaimPerk: (volunteerId: string, sessionId: string) => boolean;
  };

  /**
   * Bénévoles et comptes utilisateurs
   */
  readonly volunteers: {
    /** Bénévole actuellement connecté */
    getCurrent: () => Volunteer | null;
    /** Liste tous les bénévoles enregistrés */
    list: () => Volunteer[];
    /** Récupère un bénévole par son identifiant unique */
    get: (id: string) => Volunteer | undefined;
    /** Crée un nouveau compte bénévole */
    create: (volunteer: { username: string; name: string; password?: string; role?: string; isAdmin?: boolean }) => { success: boolean; volunteer?: Volunteer; message: string };
    /** Met à jour un compte bénévole */
    update: (id: string, updates: Partial<Volunteer>) => { success: boolean; message: string };
    /** Supprime un compte bénévole */
    delete: (id: string) => { success: boolean; message: string };
    /** Connecte un bénévole par son code PIN ou mot de passe */
    login: (pinOrPassword: string) => { success: boolean; volunteer?: Volunteer; message: string };
    /** Déconnecte la session bénévole en cours */
    logout: () => void;
    /** Indique si l'utilisateur courant dispose des droits administrateur */
    isAdmin: () => boolean;
  };

  /**
   * Configuration de la collation des bénévoles
   */
  readonly perk: {
    getConfig: () => PerkSettings;
    updateConfig: (updates: Partial<PerkSettings>) => void;
    isEligible: (volunteerId?: string, sessionId?: string) => boolean;
  };

  /**
   * Gestionnaire des addons et extensions
   */
  readonly addons: {
    list: () => any[];
    get: (id: string) => any | undefined;
    isEnabled: (id: string) => boolean;
    toggle: (id: string, enabled?: boolean) => boolean;
    save: (pkg: any) => void;
    delete: (id: string) => boolean;
    export: (id: string) => string;
    import: (pkgJson: string) => { success: boolean; message: string; addonId?: string };
  };

  /**
   * Système d'événements temps-réel
   */
  readonly events: {
    /** Écoute un événement système */
    on: (event: OpenMdlEventType, listener: OpenMdlEventListener) => () => void;
    /** Écoute un événement une seule fois */
    once: (event: OpenMdlEventType, listener: OpenMdlEventListener) => () => void;
    /** Retire un écouteur d'événement */
    off: (event: OpenMdlEventType, listener: OpenMdlEventListener) => void;
    /** Émet un événement personnalisé */
    emit: (event: OpenMdlEventType, payload?: any) => void;
  };

  /**
   * Stockage persistant isolé pour chaque addon
   */
  readonly storage: {
    /** Récupère une valeur stockée (avec valeur par défaut optionnelle) */
    get: <T = any>(key: string, defaultValue?: T) => T;
    /** Enregistre une valeur dans l'espace de stockage isolé */
    set: <T = any>(key: string, value: T) => void;
    /** Supprime une clé spécifique */
    remove: (key: string) => void;
    /** Supprime toutes les données enregistrées par l'addon */
    clear: () => void;
    /** Liste toutes les clés existantes */
    keys: () => string[];
    /** Renvoie l'intégralité du dictionnaire de stockage */
    getAll: () => Record<string, any>;
  };

  /**
   * Composants d'interface, modales, dialogues et notifications
   */
  readonly ui: {
    /** Affiche une notification toast */
    notify: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
    /** Alias pour notify */
    toast: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
    /** Ouvre une boîte de confirmation avec boutons */
    confirm: (options: {
      title: string;
      message: string;
      confirmText?: string;
      cancelText?: string;
      onConfirm: () => void;
    }) => void;
    /** Ouvre une boîte de saisie de texte */
    prompt: (options: {
      title: string;
      message?: string;
      placeholder?: string;
      defaultValue?: string;
      confirmText?: string;
      cancelText?: string;
      onConfirm: (val: string) => void;
      onCancel?: () => void;
    }) => void;
    /** Affiche une boîte modale personnalisée */
    modal: (options: {
      title: string;
      content: HTMLElement | string;
      onClose?: () => void;
    }) => void;
    /** Ferme la boîte modale active */
    closeModal: () => void;
    /** Convertit du texte Markdown standard en HTML sécurisé */
    renderMarkdown: (md: string) => string;
    /** Émet un signal sonore standard */
    playSound: (sound: 'beep' | 'success' | 'warning' | 'error' | 'cash') => void;
    /** Bascule le mode plein écran */
    toggleFullscreen: () => void;
  };

  /**
   * Synthétiseur audio WebAudio autonome 100% hors-ligne
   */
  readonly audio: {
    play: (sound: 'beep' | 'success' | 'warning' | 'error' | 'cash') => void;
    beep: (freq?: number, durationMs?: number, type?: OscillatorType) => void;
    isMuted: () => boolean;
    setMuted: (muted: boolean) => void;
  };

  /**
   * Gestion du thème sombre / clair et injection de styles CSS
   */
  readonly theme: {
    getTheme: () => 'dark' | 'light';
    setTheme: (theme: 'dark' | 'light') => void;
    toggleTheme: () => 'dark' | 'light';
    injectCss: (css: string, id?: string) => void;
    removeInjectedCss: (id: string) => void;
  };

  /**
   * Informations système, journalisation et sauvegardes
   */
  readonly system: {
    readonly version: string;
    readonly appName: string;
    readonly author: string;
    readonly portfolioUrl: string;
    getInfo: () => {
      version: string;
      totalSales: number;
      totalProducts: number;
      hasActiveSession: boolean;
      theme: string;
      installedAddonsCount: number;
    };
    exportBackup: () => string;
    importBackup: (jsonData: string) => { success: boolean; message: string };
    resetData: () => void;
    getActivityLogs: () => any[];
    logActivity: (type: 'INFO' | 'SALE' | 'RESTOCK' | 'SESSION' | 'BACKUP' | 'WARNING' | 'SECURITY', message: string) => void;
  };

  /**
   * Boîte à outils et fonctions utilitaires
   */
  readonly utils: {
    /** Formate un montant en euros (ex: "1,50 €") */
    formatPrice: (amount: number) => string;
    /** Formate une date en chaîne française */
    formatDate: (date: string | Date) => string;
    /** Formate une heure en chaîne française (ex: "14:30") */
    formatTime: (date: string | Date) => string;
    /** Échappe les caractères HTML sensibles */
    escapeHtml: (str: string) => string;
    /** Génère un identifiant unique aléatoire */
    generateId: (prefix?: string) => string;
    /** Déclenche le téléchargement d'un fichier texte dans le navigateur */
    downloadFile: (filename: string, content: string, mimeType?: string) => void;
    /** Copie un texte dans le presse-papiers */
    copyToClipboard: (text: string) => Promise<boolean>;
  };
}

/**
 * Objet global OpenMDL accessible depuis n'importe quel addon
 */
declare const OpenMDL: IOpenMdlApi;

/**
 * Alias global rapide "api" équivalent à "OpenMDL"
 */
declare const api: IOpenMdlApi;

declare global {
  interface Window {
    OpenMDL: IOpenMdlApi;
    api: IOpenMdlApi;
  }
}
