import { Product, Sale } from '../types';
import { AnalyticsService } from '../services/analytics';
import { Icons } from './Icons';

export class StockChartsComponent {
  public static renderOverview(products: Product[], sales: Sale[]): HTMLElement {
    const velocities = AnalyticsService.calculateStockVelocities(products, sales);
    const container = document.createElement('div');
    container.className = 'space-y-6';

    const urgentItems = velocities.filter(v => v.recommendation === 'urgent_restock');
    const overstockItems = velocities.filter(v => v.recommendation === 'overstock');

    // 1. Alertes & Recommandations discrètes
    const alertsBox = document.createElement('div');
    alertsBox.className = 'grid grid-cols-1 md:grid-cols-2 gap-4';

    alertsBox.innerHTML = `
      <!-- Alertes Réapprovisionnement -->
      <div class="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 shadow-xs">
        <div class="flex items-center justify-between">
          <h3 class="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
            Priorités de réapprovisionnement
          </h3>
          <span class="text-xs font-mono-nums font-bold px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">${urgentItems.length} alertes</span>
        </div>

        ${urgentItems.length === 0 ? `
          <p class="text-xs text-slate-500">Tous les stocks sont à des niveaux suffisants pour les prochaines permanences.</p>
        ` : `
          <div class="space-y-2 font-mono-nums text-xs">
            ${urgentItems.map(item => `
              <div class="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/70">
                <div>
                  <span class="font-sans font-bold text-slate-900 dark:text-slate-100">${item.productName}</span>
                  <div class="text-[11px] text-slate-500 mt-0.5">
                    Stock : <span class="${item.currentStock === 0 ? 'text-rose-500 font-bold' : 'text-amber-500 font-bold'}">${item.currentStock} u</span>
                    ${item.daysUntilOut !== null ? `• Rupture estimée dans ~${item.daysUntilOut}j` : ''}
                  </div>
                </div>
                <div class="text-right">
                  <span class="text-xs font-black text-white bg-orange-500 px-3 py-1 rounded-xl shadow-xs">
                    +${item.suggestedRestockQty} u
                  </span>
                </div>
              </div>
            `).join('')}
          </div>
        `}
      </div>

      <!-- Surstock ou Ventes Ralenties -->
      <div class="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 shadow-xs">
        <div class="flex items-center justify-between">
          <h3 class="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
            Sur-stocks ou rotation faible
          </h3>
          <span class="text-xs font-mono-nums font-bold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">${overstockItems.length} articles</span>
        </div>

        ${overstockItems.length === 0 ? `
          <p class="text-xs text-slate-500">Aucun sur-stock significatif détecté.</p>
        ` : `
          <div class="space-y-2 font-mono-nums text-xs">
            ${overstockItems.map(item => `
              <div class="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/70">
                <div>
                  <span class="font-sans font-bold text-slate-900 dark:text-slate-100">${item.productName}</span>
                  <div class="text-[11px] text-slate-500 mt-0.5">Stock actuel : ${item.currentStock} u</div>
                </div>
                <span class="text-xs font-bold text-slate-400">Stock suffisant</span>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    `;
    container.appendChild(alertsBox);

    // 2. Taux d'écoulement & Jauge de stock
    const chartsSection = document.createElement('div');
    chartsSection.className = 'p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 shadow-xs';

    chartsSection.innerHTML = `
      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-sm font-bold text-slate-900 dark:text-white tracking-tight">Niveaux de stock & Vitesse de vente</h3>
          <p class="text-xs text-slate-500 font-medium">Rythme d'écoulement moyen par heure d'ouverture du foyer</p>
        </div>
      </div>

      <div class="space-y-3 pt-1">
        ${velocities.map(vel => {
          const maxRef = 50;
          const pct = Math.min(100, Math.round((vel.currentStock / maxRef) * 100));
          const isCritical = vel.currentStock <= 5;
          const isLow = vel.currentStock <= 12;

          return `
            <div class="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/70 space-y-2.5">
              <div class="flex items-center justify-between text-xs">
                <div class="flex items-center gap-2">
                  <span class="font-bold text-slate-900 dark:text-slate-100">${vel.productName}</span>
                  ${vel.totalSold > 0 ? `
                    <span class="text-[10px] font-mono-nums font-bold px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-700 dark:text-orange-400">
                      ${vel.totalSold} vendus
                    </span>
                  ` : ''}
                </div>

                <div class="font-mono-nums text-right flex items-center gap-3">
                  <span class="font-black ${isCritical ? 'text-rose-500' : isLow ? 'text-amber-500' : 'text-slate-700 dark:text-slate-200'}">
                    ${vel.currentStock} u
                  </span>
                  ${vel.daysUntilOut !== null ? `
                    <span class="text-[10px] text-slate-400">(~${vel.daysUntilOut}j)</span>
                  ` : ''}
                </div>
              </div>

              <!-- Jauge de niveau arrondie -->
              <div class="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                <div 
                  class="h-full rounded-full transition-all duration-300 ${
                    isCritical 
                      ? 'bg-rose-500' 
                      : isLow 
                      ? 'bg-amber-500' 
                      : 'bg-emerald-500'
                  }"
                  style="width: ${Math.max(4, pct)}%"
                ></div>
              </div>

              <!-- Recommandation -->
              <div class="flex items-center justify-between text-[11px] text-slate-500 font-mono-nums">
                <span class="font-medium">Vitesse : ${vel.salesPerHour} u/heure</span>
                <span class="font-bold ${vel.suggestedRestockQty > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-slate-400'}">
                  ${vel.suggestedRestockQty > 0 ? `Conseil : commander +${vel.suggestedRestockQty} u` : 'Stock OK'}
                </span>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;

    container.appendChild(chartsSection);
    return container;
  }
}
