import { Product, Sale, Session, Volunteer, CartItem, PerkSettings, SaleItem } from './index';

export type AddonCategory = 'caisse' | 'marketing' | 'utilitaire' | 'jeu' | 'autre';

export interface AddonManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  authorUrl?: string;
  category: AddonCategory;
  icon: string; // Nom de l'icône dans Icons (ex: 'gift', 'puzzle', 'calculator', 'sparkles')
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AddonFile {
  name: string;
  path: string;
  content: string;
  language: 'typescript' | 'javascript' | 'json' | 'css' | 'markdown';
}

export interface AddonPackage {
  manifest: AddonManifest;
  files: AddonFile[];
}

export interface RegisteredTab {
  id: string;
  label: string;
  icon: string;
  addonId: string;
  render: (container: HTMLElement) => void;
}

export interface RegisteredWidget {
  id: string;
  title: string;
  addonId: string;
  render: (container: HTMLElement) => void;
}

export type OpenMdlEventType = 
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

export type OpenMdlEventListener = (payload: any) => void;

// Interface exhaustive et universelle de l'API globale OpenMDL
export interface IOpenMdlApi {
  version: string;
  appName: string;
  author: string;
  authorUrl: string;

  // 1. Navigation & Onglets
  navigation: {
    registerTab: (tab: { id: string; label: string; icon?: string; render: (container: HTMLElement) => void }) => void;
    unregisterTab: (tabId: string) => void;
    goTo: (tabId: string) => void;
    getCurrentTab: () => string;
    getRegisteredTabs: () => RegisteredTab[];
    refresh: () => void;
  };

  // 2. Dashboard & Widgets
  dashboard: {
    registerWidget: (widget: { id: string; title: string; render: (container: HTMLElement) => void }) => void;
    unregisterWidget: (widgetId: string) => void;
    getRegisteredWidgets: () => RegisteredWidget[];
  };

  // 3. Produits & Catalogue
  products: {
    list: () => Product[];
    get: (id: string) => Product | undefined;
    getByCategory: (category: string) => Product[];
    search: (query: string) => Product[];
    create: (product: Omit<Product, 'id'>) => { success: boolean; message: string; product?: Product };
    update: (id: string, updates: Partial<Product>) => { success: boolean; message: string };
    delete: (id: string) => { success: boolean; message: string };
    restock: (id: string, quantityToAdd: number, reason?: string) => { success: boolean; message: string };
    setStock: (id: string, newStock: number) => { success: boolean; message: string };
    getCategories: () => string[];
    getFavorites: () => Product[];
    toggleFavorite: (id: string) => boolean;
    export: () => Product[];
    import: (products: Product[]) => { success: boolean; count: number };
  };

  // 4. Caisse & Ventes
  sales: {
    list: () => Sale[];
    get: (id: string) => Sale | undefined;
    getTodaySales: () => Sale[];
    getSessionSales: (sessionId: string) => Sale[];
    getByDateRange: (startDate: string, endDate: string) => Sale[];
    record: (saleData: {
      items: Array<{ product: Product; quantity: number } | SaleItem>;
      paymentMethod: 'especes' | 'tpe' | 'cash' | 'card';
      cashReceived?: number;
      cashReturned?: number;
    }) => { success: boolean; sale?: Sale; message: string };
    cancel: (saleId: string, restoreStock?: boolean) => { success: boolean; message: string };
    getStats: (timeframe?: 'day' | 'week' | 'month' | 'all') => {
      totalRevenue: number;
      totalItems: number;
      salesCount: number;
      averageBasket: number;
      topProducts: { id: string; name: string; quantity: number; revenue: number }[];
      paymentMethods: { cash: number; card: number };
    };
    exportCsv: () => string;
  };

  // 5. Panier en direct
  cart: {
    getItems: () => CartItem[];
    getItem: (productId: string) => CartItem | undefined;
    add: (product: Product | string, quantity?: number) => void;
    remove: (productId: string, quantity?: number) => void;
    setQuantity: (productId: string, quantity: number) => void;
    clear: () => void;
    getTotal: () => number;
    getItemCount: () => number;
    checkout: (options: {
      paymentMethod: 'especes' | 'tpe' | 'cash' | 'card';
    }) => Promise<{ success: boolean; message: string; sale?: Sale }>;
  };

  // 6. Séances de caisse
  sessions: {
    getActive: () => Session | null;
    isOpen: () => boolean;
    getHistory: () => Session[];
    get: (id: string) => Session | undefined;
    open: (options?: { notes?: string }) => { success: boolean; session?: Session; message: string };
    close: (options: { commentary?: string; volunteerPerkClaimed?: boolean; perkProductId?: string }) => { success: boolean; session?: Session; message: string };
    getDraftClosing: () => { commentary: string; volunteerPerkClaimed: boolean } | null;
    saveDraftClosing: (draft: { commentary: string; volunteerPerkClaimed: boolean }) => void;
    clearDraftClosing: () => void;
    canClaimPerk: (volunteerId: string, sessionId: string) => boolean;
  };

  // 7. Bénévoles & Utilisateurs
  volunteers: {
    getCurrent: () => Volunteer | null;
    list: () => Volunteer[];
    get: (id: string) => Volunteer | undefined;
    create: (volunteer: { username: string; name: string; password?: string; role?: string; isAdmin?: boolean }) => { success: boolean; volunteer?: Volunteer; message: string };
    update: (id: string, updates: Partial<Volunteer>) => { success: boolean; message: string };
    delete: (id: string) => { success: boolean; message: string };
    login: (pinOrPassword: string) => { success: boolean; volunteer?: Volunteer; message: string };
    logout: () => void;
    isAdmin: () => boolean;
  };

  // 8. Collation Bénévole (Perk)
  perk: {
    getConfig: () => PerkSettings;
    updateConfig: (updates: Partial<PerkSettings>) => void;
    isEligible: (volunteerId?: string, sessionId?: string) => boolean;
  };

  // 9. Addons & Extensions
  addons: {
    list: () => AddonPackage[];
    get: (id: string) => AddonPackage | undefined;
    isEnabled: (id: string) => boolean;
    toggle: (id: string, enabled?: boolean) => boolean;
    save: (pkg: AddonPackage) => void;
    delete: (id: string) => boolean;
    export: (id: string) => string;
    import: (pkgJson: string) => { success: boolean; message: string; addonId?: string };
  };

  // 10. Événements en temps réel
  events: {
    on: (event: OpenMdlEventType, listener: OpenMdlEventListener) => () => void;
    once: (event: OpenMdlEventType, listener: OpenMdlEventListener) => () => void;
    off: (event: OpenMdlEventType, listener: OpenMdlEventListener) => void;
    emit: (event: OpenMdlEventType, payload?: any) => void;
  };

  // 11. Stockage persistant isolé
  storage: {
    get: <T = any>(key: string, defaultValue?: T) => T;
    set: <T = any>(key: string, value: T) => void;
    remove: (key: string) => void;
    clear: () => void;
    keys: () => string[];
    getAll: () => Record<string, any>;
  };

  // 12. Interface & Modales & Notifications
  ui: {
    notify: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
    toast: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
    confirm: (options: { title: string; message: string; confirmText?: string; cancelText?: string; onConfirm: () => void }) => void;
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
    modal: (options: {
      title: string;
      content: HTMLElement | string;
      onClose?: () => void;
      size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
    }) => void;
    closeModal: () => void;
    renderMarkdown: (md: string) => string;
    playSound: (sound: 'beep' | 'success' | 'warning' | 'error' | 'cash') => void;
    toggleFullscreen: () => void;
  };

  // 13. Synthétiseur Audio WebAudio (100% hors-ligne)
  audio: {
    play: (sound: 'beep' | 'success' | 'warning' | 'error' | 'cash') => void;
    beep: (freq?: number, durationMs?: number, type?: OscillatorType) => void;
    isMuted: () => boolean;
    setMuted: (muted: boolean) => void;
  };

  // 14. Thème & Styles
  theme: {
    getTheme: () => 'dark' | 'light';
    setTheme: (theme: 'dark' | 'light') => void;
    toggleTheme: () => 'dark' | 'light';
    injectCss: (css: string, id?: string) => void;
    removeInjectedCss: (id: string) => void;
  };

  // 15. Système & Sauvegardes
  system: {
    version: string;
    appName: string;
    author: string;
    portfolioUrl: string;
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

  // 16. Utilitaires universels
  utils: {
    formatPrice: (amount: number) => string;
    formatDate: (date: string | Date) => string;
    formatTime: (date: string | Date) => string;
    escapeHtml: (str: string) => string;
    generateId: (prefix?: string) => string;
    downloadFile: (filename: string, content: string, mimeType?: string) => void;
    copyToClipboard: (text: string) => Promise<boolean>;
  };
}
