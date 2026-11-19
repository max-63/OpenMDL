import type {
  Product,
  Volunteer,
  TpeSettings,
  CashFloatSettings,
  PerkSettings,
  ChatSettings,
  DatabaseConnectionConfig,
  CashDenomination
} from '../../types';

export const CRC32_TABLE: number[] = (() => {
  const table: number[] = [];
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table.push(c);
  }
  return table;
})();

export function computeCrc32Hex(data: string | Uint8Array): string {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  let crc = 0 ^ -1;
  for (let i = 0; i < bytes.length; i++) {
    crc = (crc >>> 8) ^ CRC32_TABLE[(crc ^ bytes[i]) & 0xff];
  }
  return ((crc ^ -1) >>> 0).toString(16).padStart(8, '0');
}

export const EURO_DENOMINATIONS: CashDenomination[] = [
  { id: '50', name: 'Billet 50 €', label: '50 €', value: 50, type: 'bill' },
  { id: '20', name: 'Billet 20 €', label: '20 €', value: 20, type: 'bill' },
  { id: '10', name: 'Billet 10 €', label: '10 €', value: 10, type: 'bill' },
  { id: '5', name: 'Billet 5 €', label: '5 €', value: 5, type: 'bill' },
  { id: '2', name: 'Pièce 2 €', label: '2 €', value: 2, type: 'coin' },
  { id: '1', name: 'Pièce 1 €', label: '1 €', value: 1, type: 'coin' },
  { id: '0.50', name: 'Pièce 0,50 €', label: '0,50 €', value: 0.5, type: 'coin' },
  { id: '0.20', name: 'Pièce 0,20 €', label: '0,20 €', value: 0.2, type: 'coin' },
  { id: '0.10', name: 'Pièce 0,10 €', label: '0,10 €', value: 0.1, type: 'coin' },
  { id: '0.05', name: 'Pièce 0,05 €', label: '0,05 €', value: 0.05, type: 'coin' },
  { id: '0.02', name: 'Pièce 0,02 €', label: '0,02 €', value: 0.02, type: 'coin' },
  { id: '0.01', name: 'Pièce 0,01 €', label: '0,01 €', value: 0.01, type: 'coin' },
];

export function decomposeCashAmount(amount: number): Record<string, number> {
  let centsRemaining = Math.round(amount * 100);
  const result: Record<string, number> = {};
  for (const denom of EURO_DENOMINATIONS) {
    const denomCents = Math.round(denom.value * 100);
    if (centsRemaining >= denomCents) {
      const count = Math.floor(centsRemaining / denomCents);
      if (count > 0) {
        result[denom.id] = count;
        centsRemaining -= count * denomCents;
      }
    }
  }
  return result;
}

export const STORAGE_KEYS = {
  PRODUCTS: 'openmdl_products',
  SALES: 'openmdl_sales',
  SESSIONS: 'openmdl_sessions',
  ACTIVE_SESSION: 'openmdl_active_session',
  VOLUNTEERS: 'openmdl_volunteers',
  RESTOCKS: 'openmdl_restocks',
  LOGS: 'openmdl_activity_logs',
  THEME: 'openmdl_theme',
  PERKS: 'openmdl_volunteer_perks',
  PERK_SETTINGS: 'openmdl_perk_settings',
  TPE_SETTINGS: 'openmdl_tpe_settings',
  TPE_LOGS: 'openmdl_tpe_logs',
  SNAKE_SCORES: 'openmdl_snake_scores',
  PACMAN_SCORES: 'openmdl_pacman_scores',
  CASH_FLOAT_SETTINGS: 'openmdl_cash_float_settings',
  APP_PROFILE: 'openmdl_app_profile',
  CHAT_MESSAGES: 'openmdl_chat_messages',
  CHAT_CHANNELS: 'openmdl_chat_channels',
  CHAT_SETTINGS: 'openmdl_chat_settings',
  DATABASE_CONFIG: 'openmdl_database_config',
  CHAT_READ_STATE: 'openmdl_chat_read_state'
} as const;

export const DEFAULT_DATABASE_CONFIG: DatabaseConnectionConfig = {
  engine: 'sqlite',
  external: {
    url: '',
    host: '127.0.0.1',
    port: 3306,
    database: 'openmdl',
    username: 'openmdl',
    password: '',
    dialect: 'mysql',
    ssl: false,
    acceptInvalidCerts: false,
    syncIntervalSec: 15
  },
  status: 'connected',
  lastPing: 'Local (Intégré Tauri SQLite ultra-rapide)',
  pendingOpsCount: 0,
  format: 'SQLite (.db / .mdlb)'
};

export const DEFAULT_CHAT_SETTINGS: ChatSettings = {
  enabled: true,
  retentionDays: 30
};

export const DEFAULT_PERK_SETTINGS: PerkSettings = {
  enabled: true,
  rule: 'items_sold',
  threshold: 10,
  allowMultiplePerDay: false
};

export const DEFAULT_CASH_FLOAT_SETTINGS: CashFloatSettings = {
  enabled: true,
  autoCalculationEnabled: true,
  baseCounts: {
    '20': 1,
    '10': 2,
    '5': 4,
    '2': 10,
    '1': 20,
    '0.50': 20,
    '0.20': 20,
    '0.10': 10
  },
  lastRemainingCounts: {},
  carriedOverDifferences: {}
};

export interface ActivityLog {
  id: string;
  timestamp: string;
  type: 'INFO' | 'SALE' | 'RESTOCK' | 'SESSION' | 'BACKUP' | 'WARNING' | 'SECURITY';
  message: string;
  author: string;
}

export const INITIAL_PRODUCTS: Product[] = [];

export const DEMO_PRODUCTS: Product[] = [
  {
    id: 'prod-1',
    name: 'Kinder Bueno',
    category: 'snacks',
    price: 1.20,
    costPrice: 0.70,
    stock: 24,
    minStockAlert: 8,
    imageUrl: '/products/kinder_bueno.jpeg',
    isActive: true
  },
  {
    id: 'prod-2',
    name: 'Coca-Cola 33cl',
    category: 'boissons',
    price: 1.00,
    costPrice: 0.50,
    stock: 36,
    minStockAlert: 12,
    imageUrl: '/products/coca.jpg',
    isActive: true
  },
  {
    id: 'prod-3',
    name: 'Oasis Tropical 33cl',
    category: 'boissons',
    price: 1.00,
    costPrice: 0.48,
    stock: 18,
    minStockAlert: 10,
    imageUrl: '/products/oasis.webp',
    isActive: true
  },
  {
    id: 'prod-4',
    name: 'Fuze Tea Pêche 33cl',
    category: 'boissons',
    price: 1.00,
    costPrice: 0.49,
    stock: 6,
    minStockAlert: 10,
    imageUrl: '/products/ice_tea.jpeg',
    isActive: true
  },
  {
    id: 'prod-5',
    name: 'KitKat 4 barres',
    category: 'snacks',
    price: 1.00,
    costPrice: 0.55,
    stock: 15,
    minStockAlert: 6,
    imageUrl: '/products/kitkat.webp',
    isActive: true
  },
  {
    id: 'prod-6',
    name: 'M&M\'s Peanut 45g',
    category: 'bonbons',
    price: 1.20,
    costPrice: 0.65,
    stock: 20,
    minStockAlert: 8,
    imageUrl: '/products/m&m.jpg',
    isActive: true
  },
  {
    id: 'prod-7',
    name: 'Haribo Dragibus 40g',
    category: 'bonbons',
    price: 0.80,
    costPrice: 0.40,
    stock: 30,
    minStockAlert: 10,
    imageUrl: '/products/dragibus.webp',
    isActive: true
  },
  {
    id: 'prod-8',
    name: 'Capri-Sun Multivitamin',
    category: 'boissons',
    price: 0.80,
    costPrice: 0.35,
    stock: 4,
    minStockAlert: 12,
    imageUrl: '/products/caprisun.jpg',
    isActive: true
  },
  {
    id: 'prod-9',
    name: 'Café Expresso',
    category: 'chaud',
    price: 0.50,
    costPrice: 0.15,
    stock: 100,
    minStockAlert: 20,
    imageUrl: '/products/cafe-expresso.jpg',
    isActive: true
  },
  {
    id: 'prod-10',
    name: 'Chocolat Chaud',
    category: 'chaud',
    price: 0.80,
    costPrice: 0.25,
    stock: 50,
    minStockAlert: 15,
    imageUrl: '/products/chocolat-chaud.jpg',
    isActive: true
  }
];

export const INITIAL_VOLUNTEERS: Volunteer[] = [
  {
    id: 'vol-admin',
    username: 'admin',
    password: 'admin',
    name: 'Administrateur',
    role: 'Administrateur',
    avatarColor: '#ea580c',
    isAdmin: true,
    isSuspended: false,
    createdAt: new Date().toISOString()
  }
];

export const DEMO_VOLUNTEERS: Volunteer[] = [
  {
    id: 'vol-admin',
    username: 'admin',
    password: 'admin',
    name: 'Adrien (Responsable MDL)',
    role: 'Administrateur',
    avatarColor: '#ea580c',
    isAdmin: true,
    isSuspended: false,
    createdAt: new Date().toISOString()
  },
  {
    id: 'vol-2',
    username: 'sarah',
    password: 'password123',
    name: 'Sarah L. (Trésorière)',
    role: 'Bureau MDL',
    avatarColor: '#8b5cf6',
    isAdmin: true,
    isSuspended: false,
    createdAt: new Date().toISOString()
  },
  {
    id: 'vol-3',
    username: 'thomas',
    password: 'password123',
    name: 'Thomas M. (Bénévole)',
    role: 'Permanence Foyer',
    avatarColor: '#10b981',
    isAdmin: false,
    isSuspended: false,
    createdAt: new Date().toISOString()
  },
  {
    id: 'vol-4',
    username: 'lucas',
    password: 'password123',
    name: 'Lucas D. (Bénévole)',
    role: 'Permanence Foyer',
    avatarColor: '#06b6d4',
    isAdmin: false,
    isSuspended: false,
    createdAt: new Date().toISOString()
  },
  {
    id: 'vol-5',
    username: 'emma',
    password: 'password123',
    name: 'Emma R. (Secrétaire)',
    role: 'Bureau MDL',
    avatarColor: '#ec4899',
    isAdmin: true,
    isSuspended: false,
    createdAt: new Date().toISOString()
  },
  {
    id: 'vol-6',
    username: 'hugo',
    password: 'password123',
    name: 'Hugo B. (Bénévole)',
    role: 'Permanence Foyer',
    avatarColor: '#f59e0b',
    isAdmin: false,
    isSuspended: false,
    createdAt: new Date().toISOString()
  }
];

export const DEFAULT_TPE_SETTINGS: TpeSettings = {
  isConnected: false,
  readerModel: 'SumUp Solo',
  readerName: 'SumUp Solo (Foyer MDL)',
  serialNumber: 'SOLO-MDL-8492',
  batteryLevel: 95,
  merchantName: 'Maison des Lycéens (MDL)',
  merchantEmail: '',
  apiKey: '',
  merchantCode: '',
  readerId: '',
  commissionRate: 1.75,
  soundEnabled: true,
  autoValidate: true
};
