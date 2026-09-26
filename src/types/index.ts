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
  cashBreakdown?: {
    given: Record<string, number>;
    returned?: Record<string, number>;
  };
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
  draftNotes?: string;
  draftPerkProductId?: string;
  draftCashCounts?: Record<string, number>;
  cashWithdrawal?: SessionCashWithdrawal;
  status: 'active' | 'closed';
}

export type PerkEligibilityRule = 'always' | 'sales_count' | 'items_sold';

export interface PerkSettings {
  enabled: boolean;
  rule: PerkEligibilityRule;
  threshold: number;
  allowMultiplePerDay: boolean;
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

export interface TpeSettings {
  isConnected: boolean;
  readerModel: 'SumUp Solo' | 'SumUp Air' | 'Manuel';
  readerName: string;
  serialNumber: string;
  batteryLevel: number;
  merchantName: string;
  merchantEmail: string;
  apiKey?: string;
  merchantCode?: string;
  readerId?: string;
  commissionRate: number; // ex: 1.75 %
  soundEnabled: boolean;
  autoValidate: boolean;
}

export interface TpePaymentLog {
  id: string;
  timestamp: string;
  amount: number;
  currency: string;
  status: 'SUCCESS' | 'FAILED' | 'PENDING';
  readerName: string;
  cardBrand?: string;
  last4?: string;
  transactionCode: string;
  volunteerName: string;
}

export interface PacmanScore {
  id: string;
  volunteerId?: string;
  playerName: string;
  score: number;
  timestamp: string;
}

export type SnakeScore = PacmanScore;

export interface CashDenomination {
  id: string; // e.g. "50", "20", "10", "5", "2", "1", "0.50", "0.20", "0.10", "0.05", "0.02", "0.01"
  name: string;
  label: string;
  value: number;
  type: 'bill' | 'coin';
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

export interface DrawerCashState {
  available: Record<string, number>;
  base: Record<string, number>;
  surplus?: Record<string, number>;
}

/**
 * Calcul intelligent du rendu de monnaie :
 * 1. Priorise le déstockage des pièces en SURPLUS (au-dessus du fond de caisse)
 * 2. Préserve les pièces rares / en déficit (pour éviter de forcer la Vie Scolaire à restocker)
 * 3. Ne propose jamais de rendre des pièces que le tiroir ne possède pas
 * 4. Règle de bon sens anti-absurdité : ne rend JAMAIS 1€ en 20 pièces de 5 centimes
 */
export function decomposeSmartCashChange(
  amount: number,
  drawerState?: DrawerCashState
): Record<string, number> {
  const targetCents = Math.round(amount * 100);
  if (targetCents <= 0) return {};

  if (!drawerState || !drawerState.available) {
    return decomposeCashAmount(amount);
  }

  const { available, base } = drawerState;

  // Limites strictes de bon sens pour un rendu pratique en main propre
  const maxReasonable: Record<string, number> = {
    '50': 2, '20': 2, '10': 2, '5': 2,
    '2': 5,
    '1': 4,
    '0.50': 2,
    '0.20': 2,
    '0.10': 2,
    '0.05': 1,
    '0.02': 2,
    '0.01': 2
  };

  const denoms = EURO_DENOMINATIONS.map(d => ({
    id: d.id,
    cents: Math.round(d.value * 100)
  }));

  let bestSolution: Record<string, number> | null = null;
  let bestScore = Infinity;

  function search(
    denomIdx: number,
    remainingCents: number,
    currentCounts: Record<string, number>,
    centsFromSmallCoins: number
  ) {
    if (remainingCents === 0) {
      let score = 0;
      for (const [dId, cnt] of Object.entries(currentCounts)) {
        if (!cnt || cnt <= 0) continue;
        const avail = available[dId] || 0;
        const b = base[dId] || 0;

        // Préférence générale pour limiter le nombre total de pièces
        score += cnt * 2;

        const surplus = Math.max(0, avail - b);
        const fromSurplus = Math.min(cnt, surplus);
        const fromBase = cnt - fromSurplus;

        // Forte récompense si on écoule le SURPLUS de caisse
        score -= fromSurplus * 20;

        // Pénalité si on entame le fond de caisse garanti
        score += fromBase * 30;

        // Pénalité très lourde si la coupure est déjà en situation de pénurie (< 50% du fond)
        if (avail < b * 0.5) {
          score += fromBase * 80;
        }
      }

      if (score < bestScore) {
        bestScore = score;
        bestSolution = { ...currentCounts };
      }
      return;
    }

    if (denomIdx >= denoms.length) return;

    const denom = denoms[denomIdx];
    const availCount = available[denom.id] || 0;
    const maxLimit = Math.min(
      maxReasonable[denom.id] ?? 4,
      availCount,
      Math.floor(remainingCents / denom.cents)
    );

    for (let cnt = maxLimit; cnt >= 0; cnt--) {
      const addedCents = cnt * denom.cents;
      const newSmallCents = centsFromSmallCoins + (denom.cents < 50 ? addedCents : 0);

      // Règle de bon sens : pièces < 0,50€ ne doivent pas servir à fabriquer 1,00€ ou plus
      if (newSmallCents >= 100) {
        continue;
      }

      if (cnt > 0) {
        currentCounts[denom.id] = cnt;
      } else {
        delete currentCounts[denom.id];
      }

      search(denomIdx + 1, remainingCents - addedCents, currentCounts, newSmallCents);
      delete currentCounts[denom.id];
    }
  }

  search(0, targetCents, {}, 0);

  if (bestSolution) {
    const cleaned: Record<string, number> = {};
    for (const [id, cnt] of Object.entries(bestSolution as Record<string, number>)) {
      if (typeof cnt === 'number' && cnt > 0) {
        cleaned[id] = cnt;
      }
    }
    return cleaned;
  }

  return decomposeCashAmount(amount);
}

export function calculateCashTotal(counts: Record<string, number>): number {
  let totalCents = 0;
  for (const [id, count] of Object.entries(counts)) {
    if (count > 0) {
      const denom = EURO_DENOMINATIONS.find(d => d.id === id);
      if (denom) {
        totalCents += Math.round(denom.value * 100) * count;
      }
    }
  }
  return totalCents / 100;
}


export interface CashFloatSettings {
  enabled: boolean;
  baseCounts: Record<string, number>;
  lastRemainingCounts?: Record<string, number>;
  carriedOverDifferences?: Record<string, number>;
  autoCalculationEnabled?: boolean;
  updatedAt?: string;
}

export interface SessionCashCountItem {
  id: string;
  name: string;
  value: number;
  type: 'bill' | 'coin';
  baseCount: number;
  previousDifference: number;
  effectiveBaseCount: number;
  extraCount: number;
  totalInDrawerCount: number;
  withdrawnCount: number;
  remainingCount: number;
  amountWithdrawn: number;
  amountTotalInDrawer: number;
  deficitCount: number;
}

export interface SessionCashWithdrawal {
  items: SessionCashCountItem[];
  totalCounted: number;
  totalWithdrawn: number;
  totalRemainingFloat: number;
  expectedCashSales: number;
  cashDiscrepancy: number;
  carriedOverDeficits: Record<string, number>;
  timestamp: string;
  visaBy?: string;
  visaDate?: string;
  visaNotes?: string;
}

export interface EnrichedCashWithdrawal extends SessionCashWithdrawal {
  sessionId: string;
  sessionEndTime: string;
  volunteerName: string;
}

export type AppProfile = 'foyer' | 'visco';



