import type { Product, Sale, Session, Volunteer, CartItem, PerkSettings, SaleItem } from './index';
import type { ActivityLog } from '../services/db/constants';

export type AddonCategory = 'caisse' | 'marketing' | 'utilitaire' | 'jeu' | 'autre';

export type PublicVolunteer = Omit<Volunteer, 'password' | 'pinCode'>;

export interface AddonManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  authorUrl?: string;
  category: AddonCategory;
  icon: string; // Nom de l'icône dans Icons (ex: 'gift', 'puzzle', 'calculator', 'sparkles')
  entryPoint?: string; // Chemin optionnel du fichier d'entrée (ex: '/src/index.ts')
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AddonFile {
  name: string;
  path: string;
  content: string;
  language: 'typescript' | 'javascript' | 'json' | 'css' | 'markdown' | 'html' | 'plaintext';
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

export interface OpenMdlEventMap {
  'sale:completed': Sale;
  'sale:cancelled': { saleId: string; restoredStock: boolean };
  'session:opened': Session;
  'session:closed': Session;
  'cart:updated': CartItem[];
  'product:updated': Product;
  'product:deleted': { id: string };
  'stock:updated': { id: string; quantityAdded?: number; newStock?: number; reason?: string };
  'theme:changed': 'dark' | 'light';
  'volunteer:login': PublicVolunteer;
  'volunteer:logout': PublicVolunteer | null;
  'perk:claimed': { volunteerId: string; productId: string };
}

export type OpenMdlEventType = keyof OpenMdlEventMap;

export type OpenMdlEventListener<K extends OpenMdlEventType = OpenMdlEventType> = (
  payload: OpenMdlEventMap[K]
) => void;

// Interface exhaustive et universelle de l'API globale OpenMDL
export interface IOpenMdlApi {
  readonly version: string;
  readonly appName: string;
  readonly author: string;
  readonly authorUrl: string;

  // 1. Navigation & Onglets
  readonly navigation: {
    registerTab: (tab: { id: string; label: string; icon?: string; render: (container: HTMLElement) => void }) => void;
    unregisterTab: (tabId: string) => void;
    goTo: (tabId: string) => void;
    getCurrentTab: () => string;
    getRegisteredTabs: () => RegisteredTab[];
    refresh: () => void;
  };

  // 2. Dashboard & Widgets
  readonly dashboard: {
    registerWidget: (widget: { id: string; title: string; render: (container: HTMLElement) => void }) => void;
    unregisterWidget: (widgetId: string) => void;
    getRegisteredWidgets: () => RegisteredWidget[];
  };

  // 3. Produits & Catalogue
  readonly products: {
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
  readonly sales: {
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
  readonly cart: {
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
  readonly sessions: {
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
  readonly volunteers: {
    getCurrent: () => PublicVolunteer | null;
    list: () => PublicVolunteer[];
    get: (id: string) => PublicVolunteer | undefined;
    create: (volunteer: { username: string; name: string; password?: string; role?: string; isAdmin?: boolean }) => { success: boolean; volunteer?: PublicVolunteer; message: string };
    update: (id: string, updates: Partial<Volunteer>) => { success: boolean; message: string };
    delete: (id: string) => { success: boolean; message: string };
    login: (pinOrPassword: string) => { success: boolean; volunteer?: PublicVolunteer; message: string };
    logout: () => void;
    isAdmin: () => boolean;
  };

  // 8. Collation Bénévole (Perk)
  readonly perk: {
    getConfig: () => PerkSettings;
    updateConfig: (updates: Partial<PerkSettings>) => void;
    isEligible: (volunteerId?: string, sessionId?: string) => boolean;
  };

  // 9. Addons & Extensions
  readonly addons: {
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
  readonly events: {
    on: <K extends OpenMdlEventType>(event: K, listener: OpenMdlEventListener<K>) => () => void;
    once: <K extends OpenMdlEventType>(event: K, listener: OpenMdlEventListener<K>) => () => void;
    off: <K extends OpenMdlEventType>(event: K, listener: OpenMdlEventListener<K>) => void;
    emit: <K extends OpenMdlEventType>(event: K, payload?: OpenMdlEventMap[K]) => void;
  };

  // 11. Stockage persistant isolé
  readonly storage: {
    get: <T = unknown>(key: string, defaultValue?: T) => T;
    set: <T = unknown>(key: string, value: T) => void;
    remove: (key: string) => void;
    clear: () => void;
    keys: () => string[];
    getAll: () => Record<string, unknown>;
  };

  // 12. Interface & Modales & Notifications
  readonly ui: {
    notify: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
    /** @deprecated Utiliser `OpenMDL.ui.notify()` */
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
    /** @deprecated Utiliser `OpenMDL.audio.play()` */
    playSound: (sound: 'beep' | 'success' | 'warning' | 'error' | 'cash') => void;
    toggleFullscreen: () => void;
  };

  // 13. Synthétiseur Audio WebAudio (100% hors-ligne)
  readonly audio: {
    play: (sound: 'beep' | 'success' | 'warning' | 'error' | 'cash') => void;
    beep: (freq?: number, durationMs?: number, type?: OscillatorType) => void;
    isMuted: () => boolean;
    setMuted: (muted: boolean) => void;
  };

  // 14. Thème & Styles
  readonly theme: {
    getTheme: () => 'dark' | 'light';
    setTheme: (theme: 'dark' | 'light') => void;
    toggleTheme: () => 'dark' | 'light';
    injectCss: (css: string, id?: string) => void;
    removeInjectedCss: (id: string) => void;
  };

  // 15. Système & Sauvegardes
  readonly system: {
    readonly version: string;
    readonly appName: string;
    readonly author: string;
    /** @deprecated Utiliser `OpenMDL.authorUrl` */
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
    getActivityLogs: () => ActivityLog[];
    logActivity: (type: 'INFO' | 'SALE' | 'RESTOCK' | 'SESSION' | 'BACKUP' | 'WARNING' | 'SECURITY', message: string) => void;
  };

  // 16. Utilitaires universels
  readonly utils: {
    formatPrice: (amount: number) => string;
    formatDate: (date: string | Date) => string;
    formatTime: (date: string | Date) => string;
    escapeHtml: (str: string) => string;
    generateId: (prefix?: string) => string;
    downloadFile: (filename: string, content: string, mimeType?: string) => void;
    copyToClipboard: (text: string) => Promise<boolean>;
  };
}
