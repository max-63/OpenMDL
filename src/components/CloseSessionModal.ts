import { Session, EURO_DENOMINATIONS, SessionCashCountItem, SessionCashWithdrawal } from '../types';
import { db } from '../services/db';
import { syncService } from '../services/syncService';
import { Icons } from './Icons';
import { escapeHtml } from '../utils/security';
import { AppDialog } from './AppDialog';

export class CloseSessionModalComponent {
  private container: HTMLElement | null = null;
  private session: Session | null = null;
  private onClosedCallback: () => void;
  private selectedPerkId: string = '';
  private extraCounts: Record<string, number> = {};

  constructor(onClosed: () => void) {
    this.session = db.getActiveSession();
    this.onClosedCallback = onClosed;
  }

  public show(): void {
    this.session = db.getActiveSession();
    if (!this.session) {
      AppDialog.alert({
        title: 'Aucune séance',
        message: 'Aucune séance active trouvée.',
        type: 'warning'
      });
      return;
    }

    this.selectedPerkId = this.session.draftPerkProductId || '';
    const cashFloatSettings = db.getCashFloatSettings();
    if (cashFloatSettings.autoCalculationEnabled === false) {
      this.extraCounts = {};
    } else {
      this.extraCounts = { ...(this.session.draftCashCounts || {}) };
    }

    this.container = document.createElement('div');
    this.container.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-enter';
    this.render();
    document.body.appendChild(this.container);
  }

  public hide(): void {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
      this.container = null;
    }
  }

  private render(): void {
    if (!this.container || !this.session) return;

    const startTimeFormatted = new Date(this.session.startTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const nowFormatted = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

    const perkCheck = db.canClaimVolunteerPerk(this.session.volunteerId, this.session.id);
    const perkSettings = db.getPerkSettings();
    const itemsSoldCount = db.getSessionItemsSoldCount(this.session.id);
    const salesCount = this.session.salesCount;

    // Produits consommables éligibles à la collation (stock > 0)
    const availableProducts = db.getProducts().filter(p =>
      p.isActive && p.stock > 0 &&
      (p.category === 'boissons' || p.category === 'snacks' || p.category === 'chaud' || p.category === 'bonbons')
    );

    const draftNotes = this.session.draftNotes || '';
    const cashFloatSettings = db.getCashFloatSettings();
    const baseFloatTotal = db.calculateBaseCashFloatTotal(cashFloatSettings.baseCounts);
    const hasCashFloatDraft = Object.keys(this.extraCounts).length > 0;
    const hasDraft = Boolean(draftNotes || this.selectedPerkId || hasCashFloatDraft);

    // Calcul du pourcentage de progression du seuil
    const progressPercent = perkCheck.required > 0
      ? Math.min(100, Math.round((perkCheck.current / perkCheck.required) * 100))
      : 100;

    let perkStatusHtml = '';
    if (!perkSettings.enabled) {
      perkStatusHtml = `
        <div class="p-3 px-4 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2.5">
          ${Icons.gift('w-5 h-5 text-slate-400 flex-shrink-0')}
          <span>La collation bénévole offerte est actuellement désactivée par les administrateurs.</span>
        </div>
      `;
    } else if (perkCheck.allowed) {
      perkStatusHtml = `
        <div class="p-3 px-4.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 text-slate-800 dark:text-slate-200 flex flex-wrap items-center justify-between gap-3 shadow-xs">
          <div class="flex items-center gap-3 min-w-0">
            <div class="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold flex-shrink-0">
              ${Icons.gift('w-5 h-5')}
            </div>
            <div class="min-w-0 truncate">
              <div class="flex items-center gap-2">
                <span class="text-sm font-bold text-emerald-700 dark:text-emerald-300">Collation bénévole débloquée</span>
                <span class="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">Offert</span>
              </div>
              <p class="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                ${perkSettings.rule === 'always' 
                  ? 'Offerte sans condition pour chaque permanence' 
                  : `Objectif atteint : ${perkCheck.current} ${perkSettings.rule === 'sales_count' ? 'ventes' : 'articles vendus'} (seuil configuré: ${perkCheck.required})`}
              </p>
            </div>
          </div>

          <div class="w-80 flex-shrink-0">
            <select 
              id="perk-product-select" 
              class="w-full px-3.5 py-2 text-sm rounded-xl bg-white dark:bg-slate-800 border border-emerald-500/30 text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/30 cursor-pointer shadow-xs"
            >
              <option value="">-- Aucun (ne rien prendre) --</option>
              ${availableProducts.map(p => `
                <option value="${p.id}" ${p.id === this.selectedPerkId ? 'selected' : ''}>
                  ${escapeHtml(p.name)} (${p.price.toFixed(2)} €)
                </option>
              `).join('')}
            </select>
          </div>
        </div>
      `;
    } else {
      const metricLabel = perkSettings.rule === 'sales_count' ? 'ventes' : 'articles vendus';
      perkStatusHtml = `
        <div class="p-3 px-4 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3 text-xs sm:text-sm">
          <div class="flex items-center gap-2.5">
            ${Icons.gift('w-5 h-5 text-orange-500 flex-shrink-0')}
            <span class="font-bold text-slate-700 dark:text-slate-300">Collation bénévole :</span>
            <span class="text-slate-500 dark:text-slate-400 text-xs">${escapeHtml(perkCheck.reason || 'Objectif non atteint.')}</span>
          </div>
          <div class="flex items-center gap-3 font-mono text-xs font-bold text-orange-600 dark:text-orange-400">
            <span>${perkCheck.current} / ${perkCheck.required} ${metricLabel}</span>
            <div class="w-28 h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
              <div class="h-full bg-orange-500" style="width: ${progressPercent}%;"></div>
            </div>
          </div>
        </div>
      `;
    }

    const billDenoms = EURO_DENOMINATIONS.filter(d => d.type === 'bill'); // 50, 20, 10, 5
    const euroCoinDenoms = EURO_DENOMINATIONS.filter(d => d.type === 'coin' && d.value >= 0.20); // 2, 1, 0.50, 0.20
    const centCoinDenoms = EURO_DENOMINATIONS.filter(d => d.type === 'coin' && d.value < 0.20); // 0.10, 0.05, 0.02, 0.01

    const renderDenomRow = (d: typeof EURO_DENOMINATIONS[0]) => {
      const baseCount = cashFloatSettings.baseCounts[d.id] || 0;
      const prevDiff = cashFloatSettings.carriedOverDifferences?.[d.id] || 0;
      const extraCount = this.extraCounts[d.id] ?? 0;
      const effectiveBase = Math.max(0, baseCount + prevDiff);
      const totalInDrawer = Math.max(0, effectiveBase + extraCount);
      const toWithdraw = Math.max(0, extraCount);

      return `
        <div class="flex items-center justify-between gap-3 p-2.5 px-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/70 dark:border-slate-700/70 hover:border-slate-300 dark:hover:border-slate-600 transition-colors">
          <!-- Partie Gauche : Badge Valeur + Fond + Badge À Décaisser -->
          <div class="flex items-center gap-2.5 flex-1 min-w-0">
            <span class="px-2.5 py-1.5 rounded-xl ${d.type === 'bill' ? 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border border-orange-500/20 font-black' : 'bg-slate-200/80 dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 font-bold'} text-sm font-mono flex-shrink-0 shadow-2xs">
              ${d.label}
            </span>
            <div class="flex flex-col">
              <div class="text-xs text-slate-400 whitespace-nowrap flex items-center gap-1">
                <span>Fond: <strong class="text-slate-700 dark:text-slate-200 font-mono text-sm">${baseCount}</strong></span>
                ${prevDiff !== 0 ? `<span class="text-amber-500 font-bold font-mono text-xs">(${prevDiff > 0 ? `+${prevDiff}` : prevDiff})</span>` : ''}
              </div>
              <!-- Badge Orange bien visible sous le fond, sans être compressé -->
              <span id="modal-to-withdraw-badge-${d.id.replace('.', '_')}" class="${toWithdraw > 0 ? 'inline-flex' : 'hidden'} items-center gap-1 text-[11px] font-mono font-black text-orange-600 dark:text-orange-400 mt-0.5">
                À décaisser : <strong class="underline decoration-orange-500 underline-offset-2">${toWithdraw}</strong>
              </span>
            </div>
          </div>

          <!-- Partie Droite : Boutons - Input + Total en caisse -->
          <div class="flex items-center gap-2 flex-shrink-0">
            <button type="button" data-modal-cash-down="${d.id}" class="w-10 h-10 rounded-xl bg-white dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600 text-xl font-black flex items-center justify-center cursor-pointer active:scale-90 transition-all shadow-xs text-slate-800 dark:text-white select-none">
              -
            </button>
            <input 
              type="number" 
              step="1" 
              id="modal-extra-count-${d.id.replace('.', '_')}" 
              data-modal-denom-id="${d.id}"
              data-modal-denom-val="${d.value}"
              value="${extraCount}" 
              placeholder="0"
              class="w-14 h-10 text-center text-base font-mono font-black rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 shadow-inner"
            />
            <button type="button" data-modal-cash-up="${d.id}" class="w-10 h-10 rounded-xl bg-white dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600 text-xl font-black flex items-center justify-center cursor-pointer active:scale-90 transition-all shadow-xs text-slate-800 dark:text-white select-none">
              +
            </button>
            <span data-modal-denom-calc="${d.id}" id="modal-denom-calc-${d.id.replace('.', '_')}" class="min-w-[90px] text-right text-xs sm:text-sm font-mono font-bold text-slate-700 dark:text-slate-200 whitespace-nowrap">
              ${totalInDrawer} en caisse
            </span>
          </div>
        </div>
      `;
    };

    this.container.innerHTML = `
      <div class="relative w-[97vw] max-w-[1700px] rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden text-slate-900 dark:text-slate-100 max-h-[96vh] flex flex-col">
        
        <!-- En-tête large et très lisible -->
        <div class="px-8 py-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-800/60 flex-shrink-0">
          <div class="flex items-center gap-3.5">
            <div class="w-12 h-12 rounded-2xl bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20 flex items-center justify-center font-bold">
              ${Icons.clipboardCheck('w-6 h-6')}
            </div>
            <div>
              <div class="flex items-center gap-2.5">
                <h2 class="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">Clôture de la séance</h2>
                <span id="draft-badge" class="${hasDraft ? 'inline-flex' : 'hidden'} items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  ${Icons.refresh('w-3.5 h-3.5 animate-spin-slow')}
                  <span>Brouillon mémorisé</span>
                </span>
              </div>
              <p class="text-xs sm:text-sm text-slate-400 font-mono-nums mt-0.5">${escapeHtml(this.session.volunteerName)} (${startTimeFormatted} - ${nowFormatted})</p>
            </div>
          </div>
          <button id="close-modal-x" class="p-2.5 rounded-2xl text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer">
            <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <!-- Corps spacieux et bien visible sans défilement -->
        <div class="p-7 space-y-4 overflow-y-auto flex-1">
          
          <!-- Chiffres clés de la séance (larges et très lisibles) -->
          <div class="grid grid-cols-3 gap-4 text-center">
            <div class="py-4 px-6 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-between shadow-xs">
              <div class="text-left">
                <span class="text-xs sm:text-sm font-extrabold text-orange-700 dark:text-orange-400 uppercase tracking-wider block">Recette totale</span>
                <span class="text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400">${salesCount} ventes (${itemsSoldCount} art.)</span>
              </div>
              <p class="font-mono-nums font-black text-2xl sm:text-3xl text-orange-600 dark:text-orange-400">${this.session.totalSales.toFixed(2)} €</p>
            </div>

            <div class="py-4 px-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between shadow-xs">
              <div class="text-left">
                <span class="text-xs sm:text-sm font-extrabold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider block">Espèces</span>
                <span class="text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400">Tiroir caisse</span>
              </div>
              <p class="font-mono-nums font-black text-2xl sm:text-3xl text-emerald-600 dark:text-emerald-400">${this.session.totalCash.toFixed(2)} €</p>
            </div>

            <div class="py-4 px-6 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-between shadow-xs">
              <div class="text-left">
                <span class="text-xs sm:text-sm font-extrabold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider block">TPE (Cartes)</span>
                <span class="text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400">Télécollecte</span>
              </div>
              <p class="font-mono-nums font-black text-2xl sm:text-3xl text-indigo-600 dark:text-indigo-400">${this.session.totalTpe.toFixed(2)} €</p>
            </div>
          </div>

          <!-- Section Comptage & Décaisse Assistée (3 colonnes avec gros boutons faciles à cliquer) -->
          ${cashFloatSettings.enabled ? `
            <div class="p-5 rounded-3xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-3.5">
              <div class="flex items-center justify-between gap-3">
                <div class="flex items-center gap-3">
                  <div class="w-9 h-9 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20 flex items-center justify-center font-bold flex-shrink-0">
                    ${Icons.coins('w-5 h-5')}
                  </div>
                  <div>
                    <h3 class="text-sm sm:text-base font-black text-slate-800 dark:text-slate-100 uppercase tracking-wide">Fond de Caisse & Décaisse Assistée</h3>
                  </div>
                </div>
                <div class="flex items-center gap-2 flex-shrink-0">
                  <button 
                    type="button" 
                    id="btn-prefill-auto-cash" 
                    class="px-2.5 py-1 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30 text-xs font-bold transition-colors cursor-pointer"
                    title="Pré-remplir selon le calcul automatique des ventes"
                  >
                    Calcul auto
                  </button>
                  <button 
                    type="button" 
                    id="btn-reset-manual-cash" 
                    class="px-2.5 py-1 rounded-xl bg-slate-200/80 dark:bg-slate-700/80 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 text-xs font-bold transition-colors cursor-pointer"
                    title="Remettre tous les surplus à 0 pour compter à la main"
                  >
                    À la main (0)
                  </button>
                  <span class="text-xs font-bold text-slate-400 uppercase ml-1">Fond programmé :</span>
                  <span class="px-3.5 py-1.5 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20 font-mono text-sm sm:text-base font-black">
                    ${baseFloatTotal.toFixed(2)} €
                  </span>
                </div>
              </div>

              <!-- Grille 3 colonnes symétriques : 4 Billets | 4 Pièces Euro | 4 Pièces Centimes -->
              <div class="grid grid-cols-1 lg:grid-cols-3 gap-3.5">
                <!-- Col 1 : Billets (4) -->
                <div class="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-750 space-y-2.5 shadow-2xs">
                  <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                    <span class="text-xs sm:text-sm font-black uppercase text-slate-700 dark:text-slate-300 flex items-center gap-2">
                      ${Icons.banknote('w-4.5 h-4.5 text-orange-500')}
                      <span>Billets</span>
                    </span>
                    <span class="text-xs text-slate-400 font-semibold">Fond + Surplus</span>
                  </div>
                  <div class="space-y-2">
                    ${billDenoms.map(renderDenomRow).join('')}
                  </div>
                </div>

                <!-- Col 2 : Pièces Euro (4) -->
                <div class="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-750 space-y-2.5 shadow-2xs">
                  <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                    <span class="text-xs sm:text-sm font-black uppercase text-slate-700 dark:text-slate-300 flex items-center gap-2">
                      ${Icons.coins('w-4.5 h-4.5 text-orange-500')}
                      <span>Pièces (2€ - 0,20€)</span>
                    </span>
                    <span class="text-xs text-slate-400 font-semibold">Fond + Surplus</span>
                  </div>
                  <div class="space-y-2">
                    ${euroCoinDenoms.map(renderDenomRow).join('')}
                  </div>
                </div>

                <!-- Col 3 : Pièces Centimes (4) -->
                <div class="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-750 space-y-2.5 shadow-2xs">
                  <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                    <span class="text-xs sm:text-sm font-black uppercase text-slate-700 dark:text-slate-300 flex items-center gap-2">
                      ${Icons.coins('w-4.5 h-4.5 text-amber-500')}
                      <span>Centimes (10c - 1c)</span>
                    </span>
                    <span class="text-xs text-slate-400 font-semibold">Fond + Surplus</span>
                  </div>
                  <div class="space-y-2">
                    ${centCoinDenoms.map(renderDenomRow).join('')}
                  </div>
                </div>
              </div>

              <!-- Récapitulatif Live (4 colonnes très lisibles) -->
              <div class="p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center font-mono">
                <div class="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-750">
                  <span class="text-xs font-sans font-bold text-slate-400 uppercase block">Total Tiroir</span>
                  <span id="calc-total-drawer" class="text-base sm:text-lg font-black text-slate-800 dark:text-slate-100">0.00 €</span>
                </div>
                <div class="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-750">
                  <span class="text-xs font-sans font-bold text-slate-400 uppercase block">Fond Conservé</span>
                  <span id="calc-remaining-float" class="text-base sm:text-lg font-black text-slate-800 dark:text-slate-100">0.00 €</span>
                </div>
                <div class="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                  <span class="text-xs font-sans font-bold uppercase block">À Décaisser</span>
                  <span id="calc-amount-withdrawn" class="text-base sm:text-lg font-black">0.00 €</span>
                </div>
                <div id="calc-discrepancy-card" class="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700">
                  <span class="text-xs font-sans font-bold text-slate-400 uppercase block">Écart Caisse</span>
                  <span id="calc-discrepancy" class="text-base sm:text-lg font-black text-slate-700 dark:text-slate-300">0.00 €</span>
                </div>
              </div>

              <!-- Bannière d'instruction précise pour le retrait physique -->
              <div id="cash-withdrawal-breakdown-banner" class="p-3 px-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm">
                <div class="flex items-center gap-2">
                  ${Icons.coins('w-4.5 h-4.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0')}
                  <span class="font-bold text-emerald-800 dark:text-emerald-300">Détail des espèces à retirer :</span>
                </div>
                <div id="cash-withdrawal-breakdown-text" class="font-mono font-bold text-emerald-700 dark:text-emerald-300">
                  Aucun retrait
                </div>
              </div>
            </div>
          ` : ''}

          <!-- Section Collation Bénévole (Offerte / Progression) -->
          ${perkStatusHtml}

          <!-- Cahier de transmission & Remarques (2 lignes) -->
          <div class="space-y-1.5">
            <div class="flex items-center justify-between text-xs sm:text-sm">
              <label for="incident-notes-input" class="font-bold text-slate-700 dark:text-slate-200">
                Cahier de transmission & Remarques de séance
              </label>
              <span class="text-xs text-slate-400">Sauvegarde auto</span>
            </div>
            <textarea 
              id="incident-notes-input" 
              rows="2" 
              placeholder="Ex: Restock canettes OK, manque de monnaie de 1€ dans le tiroir, queue de billard réparée..."
              class="w-full p-3 text-xs sm:text-sm rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 transition-all resize-none placeholder:text-slate-400 font-sans shadow-inner"
            >${escapeHtml(draftNotes)}</textarea>
          </div>

          <!-- Note sur l'action automatique -->
          <div class="py-2.5 px-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-800 dark:text-amber-300 leading-tight font-medium flex items-center gap-2.5">
            ${Icons.save('w-4 h-4 flex-shrink-0 text-amber-600 dark:text-amber-400')}
            <span>La clôture sauvegarde la séance, effectue la décaisse, valide la collation offerte et crée une archive horodatée.</span>
          </div>

        </div>

        <!-- Boutons fixes en bas avec cibles de clic confortables -->
        <div class="p-4 sm:p-5 px-8 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/80 flex items-center gap-4 flex-shrink-0">
          <button id="cancel-btn" class="flex-1 py-3.5 px-6 rounded-2xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 text-sm font-bold transition-all cursor-pointer">
            Garder en brouillon & Quitter
          </button>

          <button id="confirm-close-btn" class="flex-[2] py-3.5 px-6 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-black text-sm sm:text-base flex items-center justify-center gap-3 shadow-md shadow-amber-600/20 active:scale-98 transition-all cursor-pointer">
            ${Icons.check('w-5 h-5')}
            <span>Valider la clôture définitive</span>
          </button>
        </div>

      </div>
    `;

    const notesInput = this.container.querySelector('#incident-notes-input') as HTMLTextAreaElement | null;
    const perkSelect = this.container.querySelector('#perk-product-select') as HTMLSelectElement | null;
    const draftBadge = this.container.querySelector('#draft-badge') as HTMLElement | null;

    // Calcul complet de la décaisse
    const computeWithdrawalData = (): SessionCashWithdrawal | undefined => {
      if (!cashFloatSettings.enabled) return undefined;

      const items: SessionCashCountItem[] = EURO_DENOMINATIONS.map(d => {
        const baseCount = cashFloatSettings.baseCounts[d.id] || 0;
        const previousDifference = cashFloatSettings.carriedOverDifferences?.[d.id] || 0;
        const effectiveBaseCount = Math.max(0, baseCount + previousDifference);
        const extraInput = this.container?.querySelector(`input[data-modal-denom-id="${d.id}"]`) as HTMLInputElement | null;
        const extraCount = extraInput ? (parseInt(extraInput.value, 10) || 0) : (this.extraCounts[d.id] || 0);

        const totalInDrawerCount = Math.max(0, effectiveBaseCount + extraCount);
        const withdrawnCount = Math.max(0, extraCount);
        const remainingCount = totalInDrawerCount - withdrawnCount;
        const amountWithdrawn = withdrawnCount * d.value;
        const amountTotalInDrawer = totalInDrawerCount * d.value;
        const deficitCount = Math.max(0, baseCount - remainingCount);

        return {
          id: d.id,
          name: d.name,
          value: d.value,
          type: d.type,
          baseCount,
          previousDifference,
          effectiveBaseCount,
          extraCount,
          totalInDrawerCount,
          withdrawnCount,
          remainingCount,
          amountWithdrawn,
          amountTotalInDrawer,
          deficitCount,
        };
      });

      let totalCounted = 0;
      let totalWithdrawn = 0;
      let totalRemainingFloat = 0;
      const carriedOverDeficits: Record<string, number> = {};

      items.forEach(it => {
        totalCounted += it.amountTotalInDrawer;
        totalWithdrawn += it.amountWithdrawn;
        totalRemainingFloat += it.remainingCount * it.value;
        const diff = it.remainingCount - it.baseCount;
        if (diff !== 0) {
          carriedOverDeficits[it.id] = diff;
        }
      });

      const expectedCashSales = this.session?.totalCash || 0;
      const cashDiscrepancy = totalWithdrawn - expectedCashSales;

      return {
        items,
        totalCounted,
        totalWithdrawn,
        totalRemainingFloat,
        expectedCashSales,
        cashDiscrepancy,
        carriedOverDeficits,
        timestamp: new Date().toISOString()
      };
    };

    const updateLiveCalculations = () => {
      const data = computeWithdrawalData();
      if (!data) return;

      data.items.forEach(it => {
        const span = this.container?.querySelector(`[data-modal-denom-calc="${it.id}"]`) as HTMLElement | null;
        if (span) {
          span.textContent = `${it.totalInDrawerCount} en caisse`;
        }

        const badge = this.container?.querySelector(`#modal-to-withdraw-badge-${it.id.replace('.', '_')}`) as HTMLElement | null;
        if (badge) {
          if (it.withdrawnCount > 0) {
            badge.classList.remove('hidden');
            badge.classList.add('inline-flex');
            badge.innerHTML = `À décaisser : <strong class="underline decoration-orange-500 underline-offset-2">${it.withdrawnCount}</strong>`;
          } else {
            badge.classList.add('hidden');
            badge.classList.remove('inline-flex');
          }
        }
      });

      const totalDrawerEl = this.container?.querySelector('#calc-total-drawer') as HTMLElement | null;
      const remainingFloatEl = this.container?.querySelector('#calc-remaining-float') as HTMLElement | null;
      const amountWithdrawnEl = this.container?.querySelector('#calc-amount-withdrawn') as HTMLElement | null;
      const discrepancyEl = this.container?.querySelector('#calc-discrepancy') as HTMLElement | null;
      const discrepancyCard = this.container?.querySelector('#calc-discrepancy-card') as HTMLElement | null;

      if (totalDrawerEl) totalDrawerEl.textContent = `${data.totalCounted.toFixed(2)} €`;
      if (remainingFloatEl) remainingFloatEl.textContent = `${data.totalRemainingFloat.toFixed(2)} €`;
      if (amountWithdrawnEl) amountWithdrawnEl.textContent = `${data.totalWithdrawn.toFixed(2)} €`;

      if (discrepancyEl && discrepancyCard) {
        const disc = data.cashDiscrepancy;
        const absDisc = Math.abs(disc).toFixed(2);
        if (Math.abs(disc) < 0.005) {
          discrepancyEl.textContent = '0.00 € (Exact)';
          discrepancyCard.className = 'p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400';
        } else if (disc > 0) {
          discrepancyEl.textContent = `+${absDisc} € (Surplus)`;
          discrepancyCard.className = 'p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-600 dark:text-sky-400';
        } else {
          discrepancyEl.textContent = `-${absDisc} € (Manque)`;
          discrepancyCard.className = 'p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400';
        }
      }

      // Mise à jour de la liste explicite des pièces/billets à retirer
      const breakdownTextEl = this.container?.querySelector('#cash-withdrawal-breakdown-text') as HTMLElement | null;
      if (breakdownTextEl) {
        const toWithdraw = data.items
          .filter(it => it.withdrawnCount > 0)
          .map(it => `${it.withdrawnCount}x ${it.name}`);

        if (toWithdraw.length > 0) {
          breakdownTextEl.innerHTML = `<span class="px-2 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-black">${toWithdraw.join(', ')}</span> <span class="text-xs text-slate-500 dark:text-slate-400 font-normal">(= ${data.totalWithdrawn.toFixed(2)} €)</span>`;
        } else {
          breakdownTextEl.innerHTML = `<span class="text-slate-400 font-normal">Aucun retrait nécessaire (laisser tout dans le tiroir)</span>`;
        }
      }
    };

    // Enregistrement continu en brouillon
    const handleDraftUpdate = () => {
      const currentNotes = notesInput?.value || '';
      const currentPerk = perkSelect?.value || this.selectedPerkId || '';
      db.saveSessionDraft(currentNotes, currentPerk, this.extraCounts);
      if (draftBadge) {
        draftBadge.classList.remove('hidden');
        draftBadge.classList.add('inline-flex');
      }
    };

    // Événements pour le comptage du fond de caisse
    if (cashFloatSettings.enabled) {
      EURO_DENOMINATIONS.forEach(d => {
        const input = this.container?.querySelector(`input[data-modal-denom-id="${d.id}"]`) as HTMLInputElement | null;
        const btnDown = this.container?.querySelector(`[data-modal-cash-down="${d.id}"]`) as HTMLButtonElement | null;
        const btnUp = this.container?.querySelector(`[data-modal-cash-up="${d.id}"]`) as HTMLButtonElement | null;

        btnDown?.addEventListener('click', () => {
          if (!input) return;
          const val = (parseInt(input.value, 10) || 0) - 1;
          input.value = val.toString();
          this.extraCounts[d.id] = val;
          updateLiveCalculations();
          handleDraftUpdate();
        });

        btnUp?.addEventListener('click', () => {
          if (!input) return;
          const val = (parseInt(input.value, 10) || 0) + 1;
          input.value = val.toString();
          this.extraCounts[d.id] = val;
          updateLiveCalculations();
          handleDraftUpdate();
        });

        input?.addEventListener('input', () => {
          const val = parseInt(input.value, 10) || 0;
          this.extraCounts[d.id] = val;
          updateLiveCalculations();
          handleDraftUpdate();
        });
      });

      this.container?.querySelector('#btn-prefill-auto-cash')?.addEventListener('click', () => {
        const autoCounts = this.session?.draftCashCounts || {};
        EURO_DENOMINATIONS.forEach(d => {
          const val = autoCounts[d.id] || 0;
          this.extraCounts[d.id] = val;
          const input = this.container?.querySelector(`input[data-modal-denom-id="${d.id}"]`) as HTMLInputElement | null;
          if (input) input.value = val.toString();
        });
        updateLiveCalculations();
        handleDraftUpdate();
      });

      this.container?.querySelector('#btn-reset-manual-cash')?.addEventListener('click', () => {
        EURO_DENOMINATIONS.forEach(d => {
          this.extraCounts[d.id] = 0;
          const input = this.container?.querySelector(`input[data-modal-denom-id="${d.id}"]`) as HTMLInputElement | null;
          if (input) input.value = '0';
        });
        updateLiveCalculations();
        handleDraftUpdate();
      });

      updateLiveCalculations();
    }

    notesInput?.addEventListener('input', handleDraftUpdate);
    perkSelect?.addEventListener('change', (e) => {
      this.selectedPerkId = (e.target as HTMLSelectElement).value;
      handleDraftUpdate();
    });

    // Boutons de fermeture (conservent le brouillon)
    this.container.querySelector('#close-modal-x')?.addEventListener('click', () => {
      handleDraftUpdate();
      this.hide();
    });

    this.container.querySelector('#cancel-btn')?.addEventListener('click', () => {
      handleDraftUpdate();
      this.hide();
    });

    // Validation définitive de la séance
    this.container.querySelector('#confirm-close-btn')?.addEventListener('click', () => {
      const notes = notesInput?.value || '';
      const perkId = perkSelect?.value || this.selectedPerkId || undefined;
      const cashWithdrawal = computeWithdrawalData();

      const { session, backupName, perkResult } = db.closeSession(notes, perkId, cashWithdrawal);

      // Diffusion automatique de l'alerte de fermeture aux postes clients (Vie Scolaire)
      syncService.broadcastShutdownAlert(
        'La permanence du foyer est fermée. Le poste foyer va être éteint et ne sera plus accessible. Téléchargement final de la base de données déclenché.'
      ).catch(e => console.warn('Broadcast shutdown alert warning:', e));

      this.hide();

      const details: Array<{ label: string; value: string }> = [
        { label: 'Recette totale', value: `${session.totalSales.toFixed(2)} € (${session.salesCount} ventes)` },
        { label: 'Espèces (Tiroir)', value: `${session.totalCash.toFixed(2)} €` },
        { label: 'TPE (Cartes)', value: `${session.totalTpe.toFixed(2)} €` },
        { label: 'Archive de sauvegarde', value: backupName }
      ];

      if (session.cashWithdrawal) {
        const sign = session.cashWithdrawal.cashDiscrepancy >= 0 ? '+' : '';
        details.push(
          { label: 'Montant décaissé', value: `${session.cashWithdrawal.totalWithdrawn.toFixed(2)} €` },
          { label: 'Fond restant en caisse', value: `${session.cashWithdrawal.totalRemainingFloat.toFixed(2)} €` },
          { label: 'Écart de caisse', value: `${sign}${session.cashWithdrawal.cashDiscrepancy.toFixed(2)} €` }
        );
      }

      let perkMsg = '';
      if (perkResult && perkResult.success) {
        perkMsg = `\n\nCollation bénévole validée : ${perkResult.message}`;
      }

      AppDialog.alert({
        title: 'Séance clôturée avec succès',
        message: `La permanence a été fermée et archivée.${perkMsg}`,
        type: 'success',
        confirmText: 'Terminer',
        details,
        onClose: () => {
          this.onClosedCallback();
        }
      });
    });
  }
}
