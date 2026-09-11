import { Product, Sale, StockVelocity } from '../types';

export class AnalyticsService {
  /**
   * Calcule pour chaque produit sa vitesse d'écoulement, le temps restant avant rupture,
   * et génère une recommandation précise pour le prochain restock.
   */
  public static calculateStockVelocities(products: Product[], sales: Sale[]): StockVelocity[] {
    // Calculer les quantités vendues au cours des 7 derniers jours (ou toutes les ventes si récentes)
    const salesByProduct: Record<string, { totalSold: number; firstSaleTime: number; lastSaleTime: number }> = {};

    const now = Date.now();
    const periodMs = 7 * 24 * 60 * 60 * 1000; // 7 jours

    for (const sale of sales) {
      const saleTime = new Date(sale.timestamp).getTime();
      if (now - saleTime > periodMs && sales.length > 20) continue; // Filtre 7 jours si suffisant

      for (const item of sale.items) {
        if (!salesByProduct[item.productId]) {
          salesByProduct[item.productId] = {
            totalSold: 0,
            firstSaleTime: saleTime,
            lastSaleTime: saleTime
          };
        }
        salesByProduct[item.productId].totalSold += item.quantity;
        salesByProduct[item.productId].firstSaleTime = Math.min(salesByProduct[item.productId].firstSaleTime, saleTime);
        salesByProduct[item.productId].lastSaleTime = Math.max(salesByProduct[item.productId].lastSaleTime, saleTime);
      }
    }

    return products.map(product => {
      const stats = salesByProduct[product.id];
      const totalSold = stats ? stats.totalSold : 0;

      // Calcul approximatif des heures d'activité du foyer (ex: estimé à 2h par jour d'ouverture)
      const hoursActive = stats && stats.lastSaleTime > stats.firstSaleTime
        ? Math.max(1, (stats.lastSaleTime - stats.firstSaleTime) / (1000 * 3600))
        : 2;

      const salesPerHour = totalSold > 0 ? totalSold / hoursActive : 0;

      // Jours restants avant rupture en considérant une consommation moyenne journalière
      let daysUntilOut: number | null = null;
      if (totalSold > 0) {
        // Hypothèse : foyer ouvert ~2h/jour (récré + pause midi)
        const dailyBurnRate = salesPerHour * 2;
        daysUntilOut = dailyBurnRate > 0 ? Number((product.stock / dailyBurnRate).toFixed(1)) : 999;
      }

      let recommendation: StockVelocity['recommendation'] = 'normal';
      let suggestedRestockQty = 0;

      if (product.stock === 0) {
        recommendation = 'urgent_restock';
        // Suggérer 2x le volume vendu ou minimum 24
        suggestedRestockQty = Math.max(24, totalSold > 0 ? Math.ceil(totalSold * 1.5) : 24);
      } else if (product.stock <= product.minStockAlert || (daysUntilOut !== null && daysUntilOut <= 2)) {
        recommendation = 'urgent_restock';
        suggestedRestockQty = Math.max(12, Math.ceil((product.minStockAlert * 3) - product.stock));
      } else if (daysUntilOut !== null && daysUntilOut > 20 && product.stock > 40) {
        recommendation = 'overstock';
        suggestedRestockQty = 0;
      } else {
        // Recommandation normale pour maintenir un stock tampon de 2 à 3 semaines
        suggestedRestockQty = Math.max(0, (product.minStockAlert * 2) - product.stock);
      }

      // Arrondir aux multiples de pack typiques (ex: 6, 12, 24)
      if (suggestedRestockQty > 0) {
        if (suggestedRestockQty <= 12) suggestedRestockQty = 12;
        else if (suggestedRestockQty <= 24) suggestedRestockQty = 24;
        else suggestedRestockQty = Math.ceil(suggestedRestockQty / 12) * 12;
      }

      return {
        productId: product.id,
        productName: product.name,
        currentStock: product.stock,
        totalSold,
        salesPerHour: Number(salesPerHour.toFixed(2)),
        daysUntilOut,
        recommendation,
        suggestedRestockQty
      };
    });
  }

  /**
   * Retourne l'historique de stock simulé sur les 5 derniers jours pour affichage de graphique
   */
  public static getStockHistory(product: Product, _sales: Sale[]): { dates: string[]; stocks: number[] } {
    const dates: string[] = [];
    
    // Générer 5 points temporels récents
    const now = new Date();
    for (let i = 4; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 3600 * 1000);
      dates.push(d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'numeric' }));
    }

    // Calculer les ventes du produit jour par jour
    let current = product.stock;
    const reversedHistory: number[] = [current];

    // Estimation rétrospective
    for (let i = 1; i <= 4; i++) {
      const estimatedDaySales = Math.round(product.stock * 0.15);
      current = current + estimatedDaySales;
      reversedHistory.unshift(current);
    }

    return {
      dates,
      stocks: reversedHistory
    };
  }
}
