import { db } from '../services/db';
import { ExportService } from '../services/export';
import { AnalyticsCharts } from '../components/AnalyticsCharts';
import { Icons } from '../components/Icons';

export class StatsView {
  private perkSuccessMessage: string | null = null;
  private selectedMonthDetail: number = new Date().getMonth(); // Mois en cours par défaut
  private selectedStockProductId: string = '';
  private selectedStockYear: number = new Date().getFullYear();
  private selectedStockMonth: number | 'all' = new Date().getMonth();

  public render(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'flex-1 flex flex-col min-w-0 rounded-3xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800/80 shadow-md overflow-hidden h-full';

    this.renderContent(container);
    return container;
  }

  private renderContent(container: HTMLElement): void {
    container.innerHTML = '';

    const products = db.getProducts();
    const sales = db.getSales();
    const sessions = db.getSessions();
    const volunteers = db.getVolunteers();
    const perks = db.getVolunteerPerks();
    const currentVolunteer = db.getCurrentVolunteer() || volunteers[0];

    const isDark = document.documentElement.classList.contains('dark');
    const now = new Date();
    const currentYear = now.getFullYear();

    // Calculs financiers globaux
    const totalRevenue = sales.reduce((sum, s) => sum + s.totalAmount, 0);
    const totalCash = sales.filter(s => s.paymentMethod === 'especes').reduce((sum, s) => sum + s.totalAmount, 0);
    const totalTpe = sales.filter(s => s.paymentMethod === 'tpe').reduce((sum, s) => sum + s.totalAmount, 0);

    // Calcul du coût d'achat des marchandises vendues (COGS)
    let totalCOGS = 0;
    sales.forEach(sale => {
      sale.items.forEach(item => {
        const prod = products.find(p => p.id === item.productId);
        const cost = prod ? prod.costPrice : (item.unitPrice * 0.5);
        totalCOGS += cost * item.quantity;
      });
    });

    const totalPerksCost = perks.reduce((sum, p) => sum + p.costPrice, 0);
    const realNetProfit = totalRevenue - totalCOGS - totalPerksCost;
    const netMarginPct = totalRevenue > 0 ? Math.round((realNetProfit / totalRevenue) * 100) : 0;

    // Calculs spécifiques pour le mois sélectionné (pour inspection mensuelle)
    const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
    const selMonthSales = sales.filter(s => {
      const d = new Date(s.timestamp);
      return d.getFullYear() === currentYear && d.getMonth() === this.selectedMonthDetail;
    });
    const selMonthPerks = perks.filter(p => {
      const d = new Date(p.timestamp || p.date);
      return d.getFullYear() === currentYear && d.getMonth() === this.selectedMonthDetail;
    });

    let selMonthRev = 0;
    let selMonthCost = 0;
    selMonthSales.forEach(s => {
      selMonthRev += s.totalAmount;
      s.items.forEach(it => {
        const prod = products.find(p => p.id === it.productId);
        selMonthCost += (prod ? prod.costPrice : it.unitPrice * 0.5) * it.quantity;
      });
    });
    const selMonthPerksCost = selMonthPerks.reduce((sum, p) => sum + p.costPrice, 0);
    const selMonthNetProfit = selMonthRev - selMonthCost - selMonthPerksCost;

    // Vérification du droit à la conso gratuite du bénévole connecté
    const perkEligibility = currentVolunteer ? db.canClaimVolunteerPerk(currentVolunteer.id) : { allowed: false, reason: '', salesToday: 0, requiredSales: 10 };
    const hasClaimedToday = currentVolunteer ? db.hasVolunteerClaimedPerkToday(currentVolunteer.id) : false;

    // Produit sélectionné pour l'historique linéaire des stocks
    if (!this.selectedStockProductId && products.length > 0) {
      const lowStockProd = products.find(p => p.stock <= p.minStockAlert);
      this.selectedStockProductId = lowStockProd ? lowStockProd.id : products[0].id;
    }
    const currentStockProdId = this.selectedStockProductId || (products[0] ? products[0].id : '');
    const stockEvol = db.getProductStockTimeline(currentStockProdId, this.selectedStockYear, this.selectedStockMonth);

    // 1. En-tête fixe
    const header = document.createElement('div');
    header.className = 'px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/80 flex flex-wrap items-center justify-between gap-4 flex-shrink-0';
    header.innerHTML = `
      <div>
        <div class="flex items-center gap-2.5">
          ${Icons.barChart('w-5 h-5 text-orange-500')}
          <h1 class="text-base font-black tracking-tight text-slate-900 dark:text-white">Rapports, Stocks & Analytics</h1>
        </div>
        <p class="text-xs font-medium text-slate-500">Comparaison annuelle, gestion des stocks, coûts et marges du foyer des lycéens</p>
      </div>

      <div class="flex items-center gap-2.5">
        <button id="btn-export-sales-csv" class="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 text-xs font-bold flex items-center gap-2 transition-all border border-slate-200 dark:border-slate-700 active:scale-95">
          ${Icons.download('w-3.5 h-3.5')}
          <span>Ventes (CSV)</span>
        </button>

        <button id="btn-export-sessions-csv" class="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold flex items-center gap-2 shadow-sm shadow-orange-500/20 active:scale-95 transition-all">
          ${Icons.download('w-3.5 h-3.5')}
          <span>Séances (CSV)</span>
        </button>
      </div>
    `;
    container.appendChild(header);

    // 2. Corps défilable
    const scrollBody = document.createElement('div');
    scrollBody.className = 'flex-1 min-h-0 overflow-y-auto p-6 space-y-6';

    scrollBody.innerHTML = `
      <!-- LIGNE 1 : KPI Finanziers Clés (4 Cards Arrondies) -->
      <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 font-mono-nums">
        
        <!-- Recette Totale -->
        <div class="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-xs font-sans font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Recette Totale</span>
            <div class="p-2 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400">
              ${Icons.banknote('w-4 h-4')}
            </div>
          </div>
          <p class="text-2xl font-black text-slate-900 dark:text-white">${totalRevenue.toFixed(2)} €</p>
          <div class="flex items-center justify-between text-[11px] font-sans text-slate-400">
            <span>Espèces: ${totalCash.toFixed(2)}€</span>
            <span>TPE: ${totalTpe.toFixed(2)}€</span>
          </div>
        </div>

        <!-- Coût Marchandises (COGS) -->
        <div class="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-xs font-sans font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Coût Marchandises</span>
            <div class="p-2 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
              ${Icons.package('w-4 h-4')}
            </div>
          </div>
          <p class="text-2xl font-black text-slate-900 dark:text-white">${totalCOGS.toFixed(2)} €</p>
          <div class="text-[11px] font-sans text-slate-400">
            Coût d'achat initial fournisseur
          </div>
        </div>

        <!-- Coût Consos Bénévoles (>10 ventes) -->
        <div class="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-xs font-sans font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Consos Bénévoles</span>
            <div class="p-2 rounded-xl bg-pink-500/10 text-pink-600 dark:text-pink-400">
              ${Icons.gift('w-4 h-4')}
            </div>
          </div>
          <p class="text-2xl font-black text-pink-600 dark:text-pink-400">-${totalPerksCost.toFixed(2)} €</p>
          <div class="text-[11px] font-sans text-slate-400">
            ${perks.length} conso${perks.length > 1 ? 's' : ''} gratuite${perks.length > 1 ? 's' : ''} prise${perks.length > 1 ? 's' : ''} en charge
          </div>
        </div>

        <!-- Marge Nette Réelle du Foyer -->
        <div class="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-xs font-sans font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Bénéfice Net Réel</span>
            <div class="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              ${Icons.trendingUp('w-4 h-4')}
            </div>
          </div>
          <p class="text-2xl font-black text-emerald-600 dark:text-emerald-400">+${realNetProfit.toFixed(2)} €</p>
          <div class="text-[11px] font-sans text-emerald-700 dark:text-emerald-400 font-bold">
            ${netMarginPct}% de marge nette globale
          </div>
        </div>

      </div>

      <!-- LIGNE 2 : MODULE INTERACTIF CONSO OFFERTE BÉNÉVOLE (>10 VENTES / JOUR) -->
      <div class="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-4">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div class="flex items-center gap-2.5">
            <div class="p-2 rounded-xl bg-orange-500/10 text-orange-500">
              ${Icons.gift('w-5 h-5')}
            </div>
            <div>
              <h2 class="text-sm font-extrabold text-slate-900 dark:text-white">Règle Bénévole : 1 Conso Gratuite après 10 Ventes</h2>
              <p class="text-xs text-slate-500">Chaque jour, tout bénévole effectuant plus de 10 ventes peut déclarer 1 conso offerte (max 1/jour, déduit des comptes).</p>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <span class="text-xs font-bold text-slate-700 dark:text-slate-300">Bénévole connecté :</span>
            <span class="px-3 py-1 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-orange-600 dark:text-orange-400">${currentVolunteer?.name}</span>
          </div>
        </div>

        ${this.perkSuccessMessage ? `
          <div class="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center gap-2">
            ${Icons.check('w-4 h-4')}
            <span>${this.perkSuccessMessage}</span>
          </div>
        ` : ''}

        <!-- Statut d'éligibilité pour le bénévole actif -->
        <div class="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div class="space-y-1.5 flex-1">
            <div class="flex items-center justify-between max-w-md text-xs font-mono-nums">
              <span class="font-sans font-bold text-slate-700 dark:text-slate-200">Progression des ventes aujourd'hui :</span>
              <span class="font-black ${perkEligibility.salesToday >= 10 ? 'text-emerald-600 dark:text-emerald-400' : 'text-orange-600 dark:text-orange-400'}">
                ${perkEligibility.salesToday} / 10 ventes
              </span>
            </div>

            <!-- Barre de progression -->
            <div class="w-full max-w-md h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div 
                class="h-full rounded-full transition-all duration-300 ${perkEligibility.salesToday >= 10 ? 'bg-emerald-500' : 'bg-orange-500'}"
                style="width: ${Math.min(100, Math.round((perkEligibility.salesToday / 10) * 100))}%"
              ></div>
            </div>

            <p class="text-[11px] text-slate-400">
              ${hasClaimedToday 
                ? 'Conso offerte du jour déjà accordée. Merci pour votre engagement sur cette permanence !'
                : perkEligibility.allowed 
                ? 'Seuil atteint ! Vous pouvez choisir et déclarer votre boisson ou snack offert ci-contre :' 
                : `Encore ${10 - perkEligibility.salesToday} vente(s) à réaliser aujourd'hui pour débloquer votre boisson/snack gratuit.`}
            </p>
          </div>

          <!-- Action de réclamation si éligible -->
          <div class="flex-shrink-0">
            ${hasClaimedToday ? `
              <span class="px-4 py-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-xs font-bold flex items-center gap-2">
                ${Icons.check('w-4 h-4')}
                <span>Conso du jour validée</span>
              </span>
            ` : perkEligibility.allowed ? `
              <div class="flex items-center gap-2">
                <select id="select-perk-product" class="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/30">
                  ${products.filter(p => p.stock > 0).map(p => `
                    <option value="${p.id}">${p.name} (Prix habituel: ${p.price.toFixed(2)}€)</option>
                  `).join('')}
                </select>

                <button id="btn-claim-perk" class="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm shadow-emerald-600/20 active:scale-95 transition-all">
                  ${Icons.gift('w-4 h-4')}
                  <span>Valider ma conso offerte</span>
                </button>
              </div>
            ` : `
              <button disabled class="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 text-xs font-semibold cursor-not-allowed border border-slate-200 dark:border-slate-700">
                Seuil 10 ventes requis
              </button>
            `}
          </div>
        </div>
      </div>

      <!-- LIGNE 3 : GRAPHIQUE EN BARRES EMPILÉES - COMPARAISON DES MOIS DE L'ANNÉE -->
      <div class="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-4">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 class="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              ${Icons.barChart('w-4 h-4 text-orange-500')}
              <span>Comparaison Mensuelle de l'Année (Coûts d'Achat, Marges & Bénévoles Hachurés)</span>
            </h3>
            <p class="text-[11px] text-slate-500 dark:text-slate-400">Barre des ventes = Coût initial + Marge brute. Les consos bénévoles sont hachurées sur la marge (si ça dépasse en rouge = déficit !)</p>
          </div>

          <!-- Sélecteur de mois pour inspection détaillée -->
          <div class="flex items-center gap-2">
            <span class="text-xs font-bold text-slate-400">Détails du mois :</span>
            <select id="select-month-inspector" class="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/30 font-mono-nums">
              ${monthNames.map((name, idx) => `
                <option value="${idx}" ${idx === this.selectedMonthDetail ? 'selected' : ''}>
                  ${name} ${currentYear} ${idx === now.getMonth() ? '(en cours)' : ''}
                </option>
              `).join('')}
            </select>
          </div>
        </div>

        <!-- Chiffres clés du mois sélectionné -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200/70 dark:border-slate-800 font-mono-nums text-xs">
          <div>
            <span class="text-[10px] text-slate-400 font-sans font-bold uppercase block">CA ${monthNames[this.selectedMonthDetail]}</span>
            <span class="font-black text-slate-900 dark:text-white text-sm">${selMonthRev.toFixed(2)} €</span>
          </div>
          <div>
            <span class="text-[10px] text-slate-400 font-sans font-bold uppercase block">Coût Initial Achat</span>
            <span class="font-medium text-sky-600 dark:text-sky-400">${selMonthCost.toFixed(2)} €</span>
          </div>
          <div>
            <span class="text-[10px] text-slate-400 font-sans font-bold uppercase block">Marge Brute Réalisée</span>
            <span class="font-bold text-emerald-600 dark:text-emerald-400">+${Math.max(0, selMonthRev - selMonthCost).toFixed(2)} €</span>
          </div>
          <div>
            <span class="text-[10px] text-slate-400 font-sans font-bold uppercase block">Consos Bénévoles (Haché)</span>
            <span class="font-bold text-pink-600 dark:text-pink-400">-${selMonthPerksCost.toFixed(2)} €</span>
          </div>
        </div>

        <div class="relative w-full h-72 sm:h-80">
          <canvas id="yearly-monthly-bar-chart"></canvas>
        </div>
      </div>

      <!-- LIGNE 4 : ÉVOLUTION LINÉAIRE DES STOCKS DU PRODUIT (SÉLECTEUR DÉROULANT, ANNEE/MOIS) & CE MOIS-CI (DOUGHNUT) -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        <!-- Graphique Linéaire : Évolution des stocks du produit sélectionné -->
        <div class="lg:col-span-8 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-4 flex flex-col justify-between shadow-xs">
          
          <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 class="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                ${Icons.lineChart('w-4 h-4 text-orange-500')}
                <span>Évolution des Stocks & Planification Restock</span>
              </h3>
              <p class="text-[11px] text-slate-500 dark:text-slate-400">
                Suivi chronologique des ventes (descentes) et des restocks (montées) pour anticiper les ruptures
              </p>
            </div>

            <!-- Filtres : Sélection Produit, Année, Mois -->
            <div class="flex items-center gap-2 flex-wrap">
              
              <!-- Liste déroulante des produits -->
              <select id="select-stock-product" class="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/30 cursor-pointer">
                ${products.map(p => `
                  <option value="${p.id}" ${p.id === currentStockProdId ? 'selected' : ''}>
                    ${p.name} (Stock: ${p.stock} u)
                  </option>
                `).join('')}
              </select>

              <!-- Sélecteur Année -->
              <select id="select-stock-year" class="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white focus:outline-none font-mono cursor-pointer">
                <option value="${currentYear}" ${this.selectedStockYear === currentYear ? 'selected' : ''}>${currentYear}</option>
                <option value="${currentYear - 1}" ${this.selectedStockYear === currentYear - 1 ? 'selected' : ''}>${currentYear - 1}</option>
              </select>

              <!-- Sélecteur Mois (Toute l'année ou mois précis) -->
              <select id="select-stock-month" class="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white focus:outline-none font-mono cursor-pointer">
                <option value="all" ${this.selectedStockMonth === 'all' ? 'selected' : ''}>Année entière</option>
                ${monthNames.map((name, idx) => `
                  <option value="${idx}" ${this.selectedStockMonth === idx ? 'selected' : ''}>
                    ${name} (vue/jour)
                  </option>
                `).join('')}
              </select>
            </div>
          </div>

          <!-- Canvas du graphique linéaire -->
          <div class="relative w-full h-64 sm:h-72">
            <canvas id="stock-evolution-chart"></canvas>
          </div>

          <!-- Diagnostic Restock Intelligent -->
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200/70 dark:border-slate-800 font-mono-nums text-xs">
            <div>
              <span class="text-[10px] text-slate-400 font-sans font-bold uppercase block">Stock Actuel</span>
              <span class="font-black ${stockEvol.summary.urgentStatus === 'urgent' ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white'} text-sm">
                ${stockEvol.summary.currentStock} unités
              </span>
            </div>
            <div>
              <span class="text-[10px] text-slate-400 font-sans font-bold uppercase block">Vitesse Ventes</span>
              <span class="font-bold text-slate-700 dark:text-slate-300">
                ${stockEvol.summary.dailyVelocity} u/j (${stockEvol.summary.totalSold} vendues)
              </span>
            </div>
            <div>
              <span class="text-[10px] text-slate-400 font-sans font-bold uppercase block">Autonomie Estimée</span>
              <span class="font-black ${stockEvol.summary.daysUntilOut !== null && stockEvol.summary.daysUntilOut <= 5 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}">
                ${stockEvol.summary.daysUntilOut !== null ? `${stockEvol.summary.daysUntilOut} jours` : '0 vente / Réappro'}
              </span>
            </div>
            <div>
              <span class="text-[10px] text-slate-400 font-sans font-bold uppercase block">Restock Recommandé</span>
              <span class="font-extrabold text-orange-600 dark:text-orange-400">
                +${stockEvol.summary.recommendedRestockQty} unités
              </span>
            </div>
          </div>

        </div>

        <!-- Graphique Circulaire : Ce mois-ci : Bénévoles, Coûts et Marges -->
        <div class="lg:col-span-4 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-3 flex flex-col justify-between shadow-xs">
          <div>
            <h3 class="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              ${Icons.pieChart('w-4 h-4 text-orange-500')}
              <span>Ce Mois-ci : Bénévoles, Coûts & Marges</span>
            </h3>
            <p class="text-[11px] text-slate-500 dark:text-slate-400">Répartition financière du mois en cours (${monthNames[now.getMonth()]})</p>
          </div>

          <div class="relative w-full h-64 sm:h-72 flex items-center justify-center">
            <canvas id="monthly-financials-doughnut"></canvas>
          </div>
        </div>

      </div>

      <!-- LIGNE 5 : PRIORITÉS DE RÉAPPROVISIONNEMENT EN CARTES ARRONDIES -->
      <div class="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-3">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            ${Icons.alertTriangle('w-4 h-4 text-amber-500')}
            <h3 class="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">Priorités de réapprovisionnement</h3>
          </div>
          <span class="text-xs font-mono-nums font-bold text-slate-400">${products.filter(p => p.stock <= p.minStockAlert).length} alertes urgentes</span>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 font-mono-nums text-xs">
          ${products.filter(p => p.stock <= p.minStockAlert).length === 0 ? `
            <div class="col-span-full py-8 text-center text-xs text-slate-400 font-sans">
              Tous les stocks sont au-dessus des seuils de sécurité.
            </div>
          ` : products.filter(p => p.stock <= p.minStockAlert).map(p => {
            const isOut = p.stock <= 0;
            return `
              <div class="p-3.5 rounded-xl bg-white dark:bg-slate-900 border ${isOut ? 'border-rose-300 dark:border-rose-900/60' : 'border-amber-200 dark:border-amber-900/60'} shadow-xs flex items-center justify-between">
                <div>
                  <div class="font-sans font-bold text-slate-900 dark:text-slate-100">${p.name}</div>
                  <div class="text-[11px] text-slate-400">Seuil: ${p.minStockAlert} u</div>
                </div>
                <div class="text-right">
                  <span class="px-2 py-0.5 rounded-full text-xs font-black ${isOut ? 'bg-rose-500/15 text-rose-600' : 'bg-amber-500/15 text-amber-600'}">
                    ${p.stock} u
                  </span>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <!-- LIGNE 6 : DERNIÈRES TRANSACTIONS & CAHIER DE TRANSMISSION -->
      <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
        
        <!-- Cahier de transmission -->
        <div class="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-3">
          <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-700/60 pb-3">
            <div class="flex items-center gap-2">
              ${Icons.clipboardCheck('w-4 h-4 text-orange-500')}
              <h3 class="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">Cahier de transmission</h3>
            </div>
            <span class="text-xs font-mono-nums font-bold text-slate-400">${sessions.length} séances</span>
          </div>

          <div class="space-y-2.5 font-mono-nums text-xs max-h-64 overflow-y-auto">
            ${sessions.length === 0 ? `
              <p class="text-xs text-slate-400 py-6 text-center font-sans">Aucune séance clôturée pour le moment.</p>
            ` : sessions.map(sess => {
              const startFormatted = new Date(sess.startTime).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
              const hasNotes = sess.incidentNotes && sess.incidentNotes.trim().length > 0;

              return `
                <div class="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200/70 dark:border-slate-800 space-y-1.5">
                  <div class="flex items-center justify-between font-sans">
                    <span class="font-bold text-slate-900 dark:text-slate-100">${sess.volunteerName} <span class="text-slate-400 text-[11px] font-normal">• ${startFormatted}</span></span>
                    <span class="font-mono-nums font-black text-orange-600 dark:text-orange-400">${sess.totalSales.toFixed(2)} €</span>
                  </div>
                  <p class="text-[11px] font-sans text-slate-500 whitespace-pre-line">${hasNotes ? sess.incidentNotes : 'Permanence sans incident particulier (R.A.S.)'}</p>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Dernières transactions -->
        <div class="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-3">
          <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-700/60 pb-3">
            <div class="flex items-center gap-2">
              ${Icons.receipt('w-4 h-4 text-orange-500')}
              <h3 class="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">Dernières transactions</h3>
            </div>
            <span class="text-xs font-mono-nums font-bold text-slate-400">${sales.length} ventes</span>
          </div>

          <div class="overflow-x-auto max-h-64 overflow-y-auto">
            <table class="w-full text-left border-collapse text-xs font-mono-nums">
              <thead>
                <tr class="border-b border-slate-200 dark:border-slate-800 text-slate-400 text-[10px] font-bold uppercase">
                  <th class="py-2 px-3 font-sans">Heure</th>
                  <th class="py-2 px-3 font-sans">Bénévole</th>
                  <th class="py-2 px-3 font-sans">Mode</th>
                  <th class="py-2 px-3 font-sans">Articles</th>
                  <th class="py-2 px-3 text-right font-sans">Montant</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-200/60 dark:divide-slate-800/60">
                ${sales.slice(0, 10).map(s => `
                  <tr class="hover:bg-white dark:hover:bg-slate-800/60 transition-colors">
                    <td class="py-2 px-3 text-slate-500 text-[11px]">${new Date(s.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</td>
                    <td class="py-2 px-3 font-sans text-slate-800 dark:text-slate-200 font-semibold">${s.volunteerName.split(' ')[0]}</td>
                    <td class="py-2 px-3">
                      <span class="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                        s.paymentMethod === 'especes' 
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' 
                          : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                      }">
                        ${s.paymentMethod}
                      </span>
                    </td>
                    <td class="py-2 px-3 text-slate-600 dark:text-slate-300 font-sans truncate max-w-[140px] text-[11px]">
                      ${s.items.map(i => `${i.quantity}x ${i.productName}`).join(', ')}
                    </td>
                    <td class="py-2 px-3 text-right font-black text-slate-900 dark:text-slate-100">
                      ${s.totalAmount.toFixed(2)} €
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    `;

    container.appendChild(scrollBody);

    // Initialiser les 3 graphiques Chart.js demandés après injection DOM
    requestAnimationFrame(() => {
      // 1. Bar Chart empilé : Comparaison mensuelle de l'année (Achat + Marge + Consos hachurées)
      const barCanvas = scrollBody.querySelector('#yearly-monthly-bar-chart') as HTMLCanvasElement;
      if (barCanvas) {
        AnalyticsCharts.createYearlyMonthlyStackedBarChart(barCanvas, sales, perks, products, isDark);
      }

      // 2. Line Chart : Évolution dynamique des stocks du produit sélectionné
      const lineCanvas = scrollBody.querySelector('#stock-evolution-chart') as HTMLCanvasElement;
      if (lineCanvas) {
        AnalyticsCharts.createProductStockEvolutionChart(lineCanvas, stockEvol, isDark);
      }

      // 3. Doughnut Chart : Ce mois-ci (Coûts d'achat vs Marge vs Bénévoles)
      const doughnutCanvas = scrollBody.querySelector('#monthly-financials-doughnut') as HTMLCanvasElement;
      if (doughnutCanvas) {
        AnalyticsCharts.createMonthlyFinancialsDoughnutChart(doughnutCanvas, sales, perks, products, isDark);
      }
    });

    // Événements
    scrollBody.querySelector('#select-stock-product')?.addEventListener('change', (e) => {
      this.selectedStockProductId = (e.target as HTMLSelectElement).value;
      this.renderContent(container);
    });

    scrollBody.querySelector('#select-stock-year')?.addEventListener('change', (e) => {
      this.selectedStockYear = parseInt((e.target as HTMLSelectElement).value, 10);
      this.renderContent(container);
    });

    scrollBody.querySelector('#select-stock-month')?.addEventListener('change', (e) => {
      const val = (e.target as HTMLSelectElement).value;
      this.selectedStockMonth = val === 'all' ? 'all' : parseInt(val, 10);
      this.renderContent(container);
    });

    scrollBody.querySelector('#select-month-inspector')?.addEventListener('change', (e) => {
      this.selectedMonthDetail = parseInt((e.target as HTMLSelectElement).value, 10);
      this.renderContent(container);
    });

    container.querySelector('#btn-export-sales-csv')?.addEventListener('click', () => {
      ExportService.exportSalesToCSV(sales);
    });

    container.querySelector('#btn-export-sessions-csv')?.addEventListener('click', () => {
      ExportService.exportSessionsToCSV(sessions);
    });

    scrollBody.querySelector('#btn-claim-perk')?.addEventListener('click', () => {
      if (!currentVolunteer) return;
      const select = scrollBody.querySelector('#select-perk-product') as HTMLSelectElement;
      const selectedProdId = select?.value;
      if (!selectedProdId) return;

      const result = db.claimVolunteerPerk(currentVolunteer.id, selectedProdId);
      if (result.success) {
        this.perkSuccessMessage = result.message;
        this.renderContent(container);
      } else {
        alert(result.message);
      }
    });
  }
}
