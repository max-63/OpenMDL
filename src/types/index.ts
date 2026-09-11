export interface Product {
  id: string;
  name: string;
  category: 'boissons' | 'snacks' | 'bonbons' | 'chaud' | 'autre';
  price: number; // en euros
  costPrice: number; // prix d'achat fournisseur en euros
  stock: number;
  minStockAlert: number;
  imageUrl: string;
  isActive: boolean;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export type PaymentMethod = 'especes' | 'tpe';

export interface SaleItem {
  productId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  totalPrice: number;
}

export interface Sale {
  id: string;
  timestamp: string; // ISO date
  items: SaleItem[];
  totalAmount: number;
  paymentMethod: PaymentMethod;
  cashReceived?: number;
  cashReturned?: number;
  volunteerId: string;
  volunteerName: string;
  sessionId: string;
}

export interface Volunteer {
  id: string;
  username: string; // ex: 'admin', 'jeremy'
  password: string; // mot de passe de connexion
  name: string;
  role: string;
  avatarColor: string;
  isAdmin: boolean;
  isSuspended?: boolean;
  createdAt?: string;
  pinCode?: string;
}

export interface Session {
  id: string;
  startTime: string;
  endTime?: string;
  volunteerId: string;
  volunteerName: string;
  totalSales: number;
  totalCash: number;
  totalTpe: number;
  salesCount: number;
  incidentNotes?: string;
  status: 'active' | 'closed';
}

export interface RestockLog {
  id: string;
  productId: string;
  productName: string;
  quantityAdded: number;
  previousStock: number;
  newStock: number;
  newPrice?: number;
  costPrice?: number;
  timestamp: string;
  volunteerName: string;
}

export interface StockVelocity {
  productId: string;
  productName: string;
  currentStock: number;
  totalSold: number;
  salesPerHour: number;
  daysUntilOut: number | null; // null si 0 vente
  recommendation: 'urgent_restock' | 'normal' | 'overstock';
  suggestedRestockQty: number;
}

export interface VolunteerPerk {
  id: string;
  volunteerId: string;
  volunteerName: string;
  productId: string;
  productName: string;
  costPrice: number;
  sellingPrice: number;
  date: string; // YYYY-MM-DD
  timestamp: string;
}

export interface ProductStockHistoryPoint {
  label: string; // ex: "12 sept" ou "Avril"
  dateKey: string;
  stockLevel: number;
  minStockAlert: number;
  soldCount: number;
  restockCount: number;
  isRestockEvent: boolean;
  isAlertEvent: boolean;
}

export interface ProductStockEvolution {
  product: Product;
  timeframe: 'month' | 'year';
  year: number;
  month?: number | 'all';
  dataPoints: ProductStockHistoryPoint[];
  summary: {
    currentStock: number;
    initialStock: number;
    totalSold: number;
    totalRestocked: number;
    dailyVelocity: number;
    daysUntilOut: number | null;
    recommendedRestockQty: number;
    urgentStatus: 'urgent' | 'warning' | 'ok';
  };
}

