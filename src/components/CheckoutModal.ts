import { CartItem, PaymentMethod, EURO_DENOMINATIONS, decomposeCashAmount, calculateCashTotal, decomposeSmartCashChange } from '../types';
import { db } from '../services/db';
import { Icons } from './Icons';
import { SumUpService } from '../services/sumup';
import { escapeHtml } from '../utils/security';

export class CheckoutModalComponent {
  private container: HTMLElement | null = null;
  private items: CartItem[] = [];
  private totalAmount = 0;
  private selectedMethod: PaymentMethod = 'especes';
  private cashGiven = 0;
  private givenCounts: Record<string, number> = {};
  private onCompleteCallback: () => void;

  // État du paiement TPE SumUp
  private tpeState: 'idle' | 'starting' | 'waiting_card' | 'approved' | 'refused' = 'idle';
  private tpeCheckoutId: string = '';
  private tpeReaderCheckoutId?: string = '';
  private tpePollingTimer: any = null;
  private tpeErrorMessage: string = '';
  private tpeTxDetails: { cardBrand?: string; last4?: string; transactionCode?: string } | null = null;

  // Gestionnaire clavier global
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;
  private autoCalcOverride: boolean | null = null;

  constructor(items: CartItem[], onComplete: () => void) {
    this.items = items;
    this.totalAmount = items.reduce((sum, i) => sum + (i.product.price * i.quantity), 0);
    // Par défaut : 0 € donné (le bénévole clique sur les coupures reçues ou sur 'Montant exact')
    this.cashGiven = 0;
    this.givenCounts = {};
    this.onCompleteCallback = onComplete;
  }

  public show(): void {
    this.container = document.createElement('div');
    this.container.className = 'fixed inset-0 z-50 flex items-center justify-center p-1 sm:p-2 bg-black/85 backdrop-blur-md animate-enter';
    this.render();
    document.body.appendChild(this.container);

    this.keydownHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        this.hide();
      } else if (e.key === 'Enter') {
        const target = e.target as HTMLElement;
        if (target && target.tagName === 'INPUT') {
          // Validation autorisée même dans l'input
        }
        if (this.selectedMethod === 'especes' && this.cashGiven >= this.totalAmount) {
          e.preventDefault();
          this.confirmCashSale();
        }
      }
    };
    window.addEventListener('keydown', this.keydownHandler);
  }

  public hide(): void {
    this.stopTpePolling();
    if (this.keydownHandler) {
      window.removeEventListener('keydown', this.keydownHandler);
      this.keydownHandler = null;
    }
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
      this.container = null;
    }
  }

  private stopTpePolling(): void {
    if (this.tpePollingTimer) {
      clearInterval(this.tpePollingTimer);
      this.tpePollingTimer = null;
    }
  }

  private playTpeSound(): void {
    const tpe = db.getTpeSettings();
    if (!tpe.soundEnabled) return;

    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.22);
    } catch {}
  }

  private async startTpePayment(): Promise<void> {
    const tpe = db.getTpeSettings();
    if (!tpe.isConnected || !tpe.apiKey) {
      this.tpeState = 'refused';
      this.tpeErrorMessage = 'Le lecteur SumUp n\'est pas configuré. Veuillez renseigner votre clé API dans l\'onglet TPE.';
      this.render();
      return;
    }

    this.tpeState = 'starting';
    this.tpeErrorMessage = '';
    this.render();

    const initRes = await SumUpService.initiatePayment(
      this.totalAmount,
      `Vente Caisse Foyer MDL (${this.items.length} articles)`
    );

    if (!initRes.success || !initRes.checkoutId) {
      this.tpeState = 'refused';
      this.tpeErrorMessage = initRes.message || 'Impossible de joindre les serveurs SumUp. Vérifiez votre connexion Internet.';
      this.render();
      return;
    }

    this.tpeCheckoutId = initRes.checkoutId;
    this.tpeReaderCheckoutId = initRes.readerCheckoutId;
    this.tpeState = 'waiting_card';
    this.render();

    let elapsedMs = 0;
    this.stopTpePolling();

    this.tpePollingTimer = setInterval(async () => {
      elapsedMs += 1500;
      if (elapsedMs >= 90000) {
        this.stopTpePolling();
        this.tpeState = 'refused';
        this.tpeErrorMessage = 'Délai d\'attente dépassé (90s). La transaction a expiré.';
        this.render();
        return;
      }

      const statusRes = await SumUpService.checkPaymentStatus(
        this.tpeCheckoutId,
        this.tpeReaderCheckoutId
      );

      if (statusRes.isComplete) {
        this.stopTpePolling();

        if (statusRes.isSuccess) {
          this.tpeState = 'approved';
          this.tpeTxDetails = {
            cardBrand: statusRes.cardBrand || 'Carte Bancaire',
            last4: statusRes.last4,
            transactionCode: statusRes.transactionCode || this.tpeCheckoutId
          };
          this.playTpeSound();
          this.render();

          this.completeTpeSale();

          setTimeout(() => {
            this.hide();
            this.onCompleteCallback();
          }, 1800);
        } else {
          this.tpeState = 'refused';
          this.tpeErrorMessage = statusRes.message || 'Paiement refusé ou abandonné sur le terminal.';
          this.render();
        }
      }
    }, 1500);
  }

  private async cancelTpePayment(): Promise<void> {
    this.stopTpePolling();
    if (this.tpeCheckoutId) {
      SumUpService.cancelCheckout(this.tpeCheckoutId, this.tpeReaderCheckoutId).catch(() => {});
    }
    this.tpeState = 'idle';
    this.render();
  }

  private completeTpeSale(): void {
    const saleItems = this.items.map(item => ({
      productId: item.product.id,
      productName: item.product.name,
      unitPrice: item.product.price,
      quantity: item.quantity,
      totalPrice: item.product.price * item.quantity
    }));

    db.recordTpePayment({
      amount: this.totalAmount,
      cardBrand: this.tpeTxDetails?.cardBrand || 'CB Sans-Contact',
      last4: this.tpeTxDetails?.last4 || undefined,
      status: 'SUCCESS'
    });

    db.recordSale({
      items: saleItems,
      totalAmount: this.totalAmount,
      paymentMethod: 'tpe'
    });
  }

  // Rendu visuel d'un billet d'Euro avec image réelle PNG
  public static renderEuroBillVisual(id: string, count: number, isMini: boolean = false): string {
    const denom = EURO_DENOMINATIONS.find(d => d.id === id);
    const label = denom ? denom.label : `${id} €`;
    const imgSrc = `/currency/bill_${id}.png`;

    if (isMini) {
      return `
        <div class="relative inline-flex items-center justify-center select-none flex-shrink-0">
          <img src="${imgSrc}" alt="${label}" class="h-9 w-14 object-contain rounded-md shadow-xs drop-shadow" />
        </div>
      `;
    }

    return `
      <div class="relative w-full h-24 sm:h-28 rounded-2xl overflow-hidden shadow-sm flex items-center justify-center bg-slate-100 dark:bg-slate-800/80 transition-transform group-hover:scale-[1.02]">
        <img src="${imgSrc}" alt="${label}" class="w-full h-full object-contain pointer-events-none drop-shadow-sm select-none" />
        
        ${count > 0 ? `
          <div class="absolute top-1.5 right-1.5 z-20 px-2.5 py-0.5 rounded-full bg-orange-600 text-white font-mono text-xs font-black border-2 border-white shadow-xl animate-enter">
            x${count}
          </div>
        ` : ''}
      </div>
    `;
  }

  // Rendu visuel d'une pièce d'Euro avec image réelle PNG
  public static renderEuroCoinVisual(id: string, count: number, isMini: boolean = false): string {
    const denom = EURO_DENOMINATIONS.find(d => d.id === id);
    const label = denom ? denom.label : `${id} €`;
    const imgSrc = `/currency/coin_${id}.png`;

    if (isMini) {
      return `
        <div class="relative inline-flex items-center justify-center select-none flex-shrink-0">
          <img src="${imgSrc}" alt="${label}" class="w-9 h-9 object-contain drop-shadow-md" />
        </div>
      `;
    }

    const coinSizes: Record<string, string> = {
      '2':    'w-16 h-16 sm:w-18 sm:h-18',
      '1':    'w-15 h-15 sm:w-17 sm:h-17',
      '0.50': 'w-15 h-15 sm:w-17 sm:h-17',
      '0.20': 'w-14 h-14 sm:w-16 sm:h-16',
      '0.10': 'w-13 h-13 sm:w-15 sm:h-15',
      '0.05': 'w-13 h-13 sm:w-15 sm:h-15',
      '0.02': 'w-12 h-12 sm:w-14 sm:h-14',
      '0.01': 'w-11 h-11 sm:w-13 sm:h-13',
    };

    const sizeClass = coinSizes[id] || 'w-15 h-15';

    return `
      <div class="relative ${sizeClass} flex items-center justify-center select-none">
        <img src="${imgSrc}" alt="${label}" class="w-full h-full object-contain drop-shadow-md pointer-events-none transition-transform group-hover:scale-110 active:scale-95" />
        ${count > 0 ? `
          <div class="absolute -top-1.5 -right-1.5 z-20 px-2 py-0.5 rounded-full bg-orange-600 text-white font-mono text-[11px] font-black border-2 border-white shadow-xl animate-enter">
            x${count}
          </div>
        ` : ''}
      </div>
    `;
  }

  private renderTpeScreen(tpe: ReturnType<typeof db.getTpeSettings>): string {
    if (!tpe.isConnected || !tpe.apiKey) {
      return `
        <div class="p-6 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-center space-y-4">
          <div class="w-14 h-14 rounded-2xl bg-indigo-600 text-white flex items-center justify-center mx-auto shadow-lg shadow-indigo-600/30">
            ${Icons.creditCard('w-7 h-7')}
          </div>

          <div>
            <h3 class="text-sm font-black text-slate-900 dark:text-white">
              Terminal TPE - Saisie Manuelle
            </h3>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs mx-auto leading-relaxed">
              Saisissez <strong>${this.totalAmount.toFixed(2)} €</strong> sur votre boîtier SumUp et faites badger le client.
            </p>
          </div>

          <div class="space-y-2 pt-1 max-w-xs mx-auto">
            <button 
              id="btn-confirm-manual-tpe" 
              type="button"
              class="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-600/25 active:scale-[0.98] transition-all cursor-pointer"
            >
              ${Icons.check('w-4 h-4')}
              <span>Valider l'encaissement TPE (${this.totalAmount.toFixed(2)} €)</span>
            </button>

            <button 
              id="btn-switch-cash-fallback"
              type="button"
              class="w-full py-2 px-4 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              ${Icons.banknote('w-3.5 h-3.5')}
              <span>Payer en Espèces à la place</span>
            </button>
          </div>
        </div>
      `;
    }

    return `
      <!-- TPE Automatique Connecté -->
      <div class="p-6 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-center space-y-4">
        <div class="flex items-center justify-between pb-2 border-b border-indigo-500/20 text-xs font-bold">
          <span class="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
            <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>${tpe.readerName || 'SumUp Solo'}</span>
          </span>
          <span class="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 font-mono-nums">
            ${Icons.wifi('w-4 h-4')} En ligne
          </span>
        </div>

        ${this.tpeState === 'idle' ? `
          <div class="py-4 space-y-4">
            <div class="w-14 h-14 rounded-2xl bg-indigo-600 text-white flex items-center justify-center mx-auto shadow-lg shadow-indigo-600/30">
              ${Icons.creditCard('w-7 h-7')}
            </div>
            <div>
              <p class="text-sm font-bold text-slate-800 dark:text-slate-200">Terminal SumUp prêt pour l'encaissement</p>
              <p class="text-xs text-slate-500 mt-0.5">L'ordre sera envoyé directement sur le lecteur</p>
            </div>
            <button 
              id="btn-start-tpe" 
              class="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs flex items-center justify-center gap-2 shadow-md shadow-indigo-600/30 active:scale-[0.98] transition-all cursor-pointer"
            >
              ${Icons.zap('w-4 h-4')}
              <span>Envoyer au terminal SumUp</span>
            </button>
          </div>
        ` : ''}

        ${this.tpeState === 'starting' ? `
          <div class="py-6 space-y-3">
            <div class="w-10 h-10 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p class="text-sm font-black text-slate-800 dark:text-slate-100">Communication avec SumUp...</p>
            <p class="text-xs text-slate-500">Transmission de l'ordre de paiement sécurisé</p>
          </div>
        ` : ''}

        ${this.tpeState === 'waiting_card' ? `
          <div class="py-4 space-y-4">
            <div class="relative w-14 h-14 mx-auto flex items-center justify-center">
              <div class="absolute inset-0 rounded-full bg-indigo-500/20 animate-ping"></div>
              <div class="w-12 h-12 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-600/30">
                ${Icons.creditCard('w-6 h-6 animate-pulse')}
              </div>
            </div>
            <div>
              <p class="text-sm font-black text-slate-900 dark:text-white">Présentez la carte bancaire</p>
              <p class="text-xs text-indigo-600 dark:text-indigo-400 font-bold mt-0.5">Sans-contact ou insertion sur le terminal</p>
            </div>
            <button 
              id="btn-cancel-tpe" 
              class="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all cursor-pointer"
            >
              Annuler la transaction
            </button>
          </div>
        ` : ''}

        ${this.tpeState === 'approved' ? `
          <div class="py-5 space-y-3 animate-enter">
            <div class="w-14 h-14 rounded-full bg-emerald-500 text-white flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/30">
              ${Icons.check('w-7 h-7')}
            </div>
            <div>
              <p class="text-base font-black text-emerald-600 dark:text-emerald-400">Paiement Accepté !</p>
              <p class="text-xs text-slate-500 mt-0.5">${this.tpeTxDetails?.cardBrand || 'Carte Bancaire'}</p>
            </div>
          </div>
        ` : ''}

        ${this.tpeState === 'refused' ? `
          <div class="py-4 space-y-3 animate-enter">
            <div class="w-12 h-12 rounded-xl bg-rose-500 text-white flex items-center justify-center mx-auto shadow-lg shadow-rose-500/30">
              ${Icons.alertTriangle('w-6 h-6')}
            </div>
            <div>
              <p class="text-sm font-black text-rose-600 dark:text-rose-400">Paiement Refusé</p>
              <p class="text-xs text-slate-500 mt-0.5 max-w-xs mx-auto">
                ${escapeHtml(this.tpeErrorMessage || 'La transaction a été refusée sur le terminal.')}
              </p>
            </div>
            <div class="space-y-2 max-w-xs mx-auto">
              <button 
                id="btn-retry-tpe" 
                class="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-sm cursor-pointer"
              >
                Réessayer sur le terminal TPE
              </button>
              <button 
                id="btn-fallback-manual-tpe" 
                class="w-full py-2 px-4 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold cursor-pointer"
              >
                Valider manuellement (${this.totalAmount.toFixed(2)} €)
              </button>
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }

  private render(): void {
    if (!this.container) return;

    const changeDue = Number(Math.max(0, this.cashGiven - this.totalAmount).toFixed(2));
    const isCashValid = this.selectedMethod === 'especes' && this.cashGiven >= this.totalAmount;
    const tpe = db.getTpeSettings();
    const billDenoms = EURO_DENOMINATIONS.filter(d => d.type === 'bill');
    const coinDenoms = EURO_DENOMINATIONS.filter(d => d.type === 'coin');
    const drawerState = db.getCurrentDrawerState(this.givenCounts);
    const cashFloatSettings = db.getCashFloatSettings();
    const isAutoCalc = this.autoCalcOverride !== null ? this.autoCalcOverride : (cashFloatSettings.autoCalculationEnabled !== false);
    const changeBreakdown = (isAutoCalc && changeDue > 0) ? decomposeSmartCashChange(changeDue, drawerState) : {};
    const changeItems = Object.entries(changeBreakdown).filter(([_, count]) => count > 0);

    // Si méthode TPE : Modal compacte centrée et ergonomique
    if (this.selectedMethod === 'tpe') {
      this.container.innerHTML = `
        <div class="relative w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden text-slate-900 dark:text-slate-100 flex flex-col animate-enter my-auto">
          
          <!-- Header Compact TPE -->
          <div class="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/90 dark:bg-slate-800/80 flex-shrink-0 backdrop-blur-md">
            <div class="flex items-center gap-3.5">
              <div class="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold shadow-xs">
                ${Icons.creditCard('w-6 h-6')}
              </div>
              <div>
                <div class="flex items-center gap-2.5">
                  <h2 class="text-base font-black tracking-tight text-slate-900 dark:text-white">Encaissement Carte TPE</h2>
                  <span class="px-2 py-0.5 rounded-full text-xs font-black bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30">
                    ${this.items.reduce((s, i) => s + i.quantity, 0)} art.
                  </span>
                </div>
                <p class="text-xs text-slate-500 dark:text-slate-400">Terminal SumUp • Raccourci <strong>Échap</strong> pour fermer</p>
              </div>
            </div>
            <button id="modal-close-btn" class="p-2 rounded-2xl text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer" title="Fermer (Échap)">
              <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>

          <!-- Corps Compact TPE -->
          <div class="p-6 space-y-4">
            <!-- Total à payer Haute Visibilité -->
            <div class="p-4 rounded-2xl bg-indigo-500/10 border-2 border-indigo-500/30 flex items-baseline justify-between shadow-xs">
              <div>
                <span class="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 block">TOTAL À PAYER</span>
                <span class="text-xs text-indigo-600 dark:text-indigo-400 font-bold">${this.items.length} référence(s)</span>
              </div>
              <span class="font-mono-nums font-black text-4xl text-indigo-600 dark:text-indigo-400 tracking-tight">${this.totalAmount.toFixed(2)} €</span>
            </div>

            <!-- Bascule Rapide Espèces / TPE -->
            <div class="grid grid-cols-2 gap-3">
              <button 
                id="btn-method-especes" 
                class="py-2.5 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-2 border transition-all cursor-pointer bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200"
              >
                ${Icons.banknote('w-4 h-4')}
                <span>Espèces</span>
              </button>

              <button 
                id="btn-method-tpe" 
                class="py-2.5 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-2 border transition-all cursor-pointer bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/25 ring-2 ring-indigo-600/20"
              >
                ${Icons.creditCard('w-4 h-4')}
                <span>Carte (TPE SumUp)</span>
              </button>
            </div>

            <!-- Écran SumUp / Boîtier -->
            ${this.renderTpeScreen(tpe)}
          </div>

        </div>
      `;

      this.attachEventListeners(isAutoCalc);
      return;
    }

    this.container.innerHTML = `
      <div class="relative w-[98vw] max-w-[1720px] h-[98vh] rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden text-slate-900 dark:text-slate-100 flex flex-col animate-enter">
        
        <!-- Header Grand Format Stylé Rush -->
        <div class="px-6 py-2.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/90 dark:bg-slate-800/80 flex-shrink-0 backdrop-blur-md">
          <div class="flex items-center gap-3.5">
            <div class="w-10 h-10 rounded-2xl bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center font-bold shadow-xs">
              ${Icons.banknote('w-6 h-6')}
            </div>
            <div>
              <div class="flex items-center gap-2.5">
                <h2 class="text-lg font-black tracking-tight text-slate-900 dark:text-white">Encaissement de la Commande</h2>
                <span class="px-2.5 py-0.5 rounded-full text-xs font-black bg-orange-500/15 text-orange-600 dark:text-orange-400 border border-orange-500/30">
                  ${this.items.reduce((s, i) => s + i.quantity, 0)} article(s)
                </span>
              </div>
              <p class="text-xs text-slate-500 dark:text-slate-400">Raccourcis : <strong>Entrée</strong> pour encaisser dès que le compte est bon • <strong>Échap</strong> pour fermer</p>
            </div>
          </div>
          <button id="modal-close-btn" class="p-2 rounded-2xl text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer" title="Fermer (Échap)">
            <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <!-- Corps 2 Colonnes Très Spacieux Sans Scroll -->
        <div class="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-5 p-5 overflow-hidden min-h-0">

          <!-- Colonne Gauche : Total, Mode & Rendu de Monnaie (5 colonnes) -->
          <div class="lg:col-span-5 xl:col-span-5 flex flex-col justify-between h-full overflow-y-auto pr-1 space-y-3">
            
            <div class="space-y-3">
              <!-- Total à payer Géant Haute Visibilité -->
              <div class="p-4 sm:p-5 rounded-3xl bg-orange-500/10 border-2 border-orange-500/30 flex items-baseline justify-between shadow-xs">
                <div>
                  <span class="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 block">TOTAL À PAYER</span>
                  <span class="text-xs text-orange-600 dark:text-orange-400 font-bold">${this.items.length} référence(s)</span>
                </div>
                <span class="font-mono-nums font-black text-4xl sm:text-5xl text-orange-600 dark:text-orange-400 tracking-tight">${this.totalAmount.toFixed(2)} €</span>
              </div>

              <!-- Sélecteur de méthode (Espèces vs TPE) -->
              <div class="grid grid-cols-2 gap-3">
                <button 
                  id="btn-method-especes" 
                  class="py-3 px-4 rounded-2xl text-xs font-black flex items-center justify-center gap-2 border transition-all cursor-pointer bg-orange-500 text-white border-orange-500 shadow-md shadow-orange-500/25 ring-2 ring-orange-500/20"
                >
                  ${Icons.banknote('w-4 h-4')}
                  <span>Espèces</span>
                </button>

                <button 
                  id="btn-method-tpe" 
                  class="py-3 px-4 rounded-2xl text-xs font-black flex items-center justify-center gap-2 border transition-all cursor-pointer bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200"
                >
                  ${Icons.creditCard('w-4 h-4')}
                  <span>Carte (TPE SumUp)</span>
                </button>
              </div>

              ${this.selectedMethod === 'especes' ? `
                <!-- Somme reçue du client -->
                <div class="space-y-2">
                  <div class="flex items-center justify-between text-xs">
                    <span class="text-slate-600 dark:text-slate-300 font-black uppercase tracking-wider text-[11px]">Espèces données</span>
                    <div class="flex items-center gap-1.5">
                      <button id="btn-exact-amount" type="button" class="px-3 py-1 rounded-xl bg-emerald-500/15 hover:bg-emerald-500 hover:text-white text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 font-bold font-mono-nums transition-all text-xs cursor-pointer shadow-2xs" title="Le client donne le montant exact">
                        Montant exact (${this.totalAmount.toFixed(2)} €)
                      </button>
                      <button id="btn-reset-cash" type="button" class="px-2.5 py-1 rounded-xl bg-rose-500/15 hover:bg-rose-500 hover:text-white text-rose-600 dark:text-rose-400 border border-rose-500/30 font-bold font-mono-nums transition-all text-xs cursor-pointer shadow-2xs" title="Remettre à zéro (0 €)">
                        Effacer (0 €)
                      </button>
                    </div>
                  </div>

                  <!-- Champ montant reçu Géant -->
                  <div class="relative">
                    <input 
                      type="number" 
                      step="0.01" 
                      id="input-cash-given" 
                      value="${this.cashGiven === 0 ? '' : this.cashGiven.toFixed(2)}" 
                      placeholder="0,00"
                      class="w-full text-4xl font-mono-nums font-black px-5 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-right pr-12 shadow-inner placeholder:text-slate-400"
                    />
                    <span class="absolute right-5 top-1/2 -translate-y-1/2 text-2xl font-mono-nums font-bold text-slate-400 pointer-events-none">€</span>
                  </div>

                  <!-- Raccourcis Rapides Coupures -->
                  <div class="grid grid-cols-6 gap-1.5 pt-0.5">
                    <button data-quick-add="1" type="button" class="py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-black font-mono hover:bg-orange-500 hover:text-white transition-colors cursor-pointer text-center">+1 €</button>
                    <button data-quick-add="2" type="button" class="py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-black font-mono hover:bg-orange-500 hover:text-white transition-colors cursor-pointer text-center">+2 €</button>
                    <button data-quick-add="5" type="button" class="py-1.5 rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-xs font-black font-mono hover:bg-emerald-500 hover:text-white transition-colors cursor-pointer text-center">+5 €</button>
                    <button data-quick-add="10" type="button" class="py-1.5 rounded-xl bg-rose-500/15 text-rose-700 dark:text-rose-300 text-xs font-black font-mono hover:bg-rose-500 hover:text-white transition-colors cursor-pointer text-center">+10 €</button>
                    <button data-quick-add="20" type="button" class="py-1.5 rounded-xl bg-blue-500/15 text-blue-700 dark:text-blue-300 text-xs font-black font-mono hover:bg-blue-500 hover:text-white transition-colors cursor-pointer text-center">+20 €</button>
                    <button data-quick-add="50" type="button" class="py-1.5 rounded-xl bg-orange-500/15 text-orange-700 dark:text-orange-300 text-xs font-black font-mono hover:bg-orange-500 hover:text-white transition-colors cursor-pointer text-center">+50 €</button>
                  </div>
                </div>

                <!-- SUPERBE MODULE DE RENDU DE MONNAIE -->
                ${this.cashGiven === 0 ? `
                  <div class="p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border-2 border-slate-200 dark:border-slate-700/80 text-slate-600 dark:text-slate-300 flex items-center gap-3.5 shadow-xs animate-enter">
                    <div class="w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 flex items-center justify-center flex-shrink-0">
                      ${Icons.banknote('w-5 h-5')}
                    </div>
                    <div>
                      <span class="text-xs font-black uppercase tracking-wider block text-slate-800 dark:text-slate-200">En attente des espèces</span>
                      <span class="text-[11px] text-slate-500 dark:text-slate-400">Cliquez sur les coupures reçues à droite ou tapez le montant</span>
                    </div>
                  </div>
                ` : this.cashGiven < this.totalAmount ? `
                  <div class="p-3.5 rounded-2xl bg-rose-500/15 border-2 border-rose-500/30 text-rose-800 dark:text-rose-200 flex items-center justify-between shadow-sm animate-enter">
                    <div class="flex items-center gap-3">
                      <div class="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center flex-shrink-0">
                        ${Icons.alertTriangle('w-5 h-5')}
                      </div>
                      <div>
                        <span class="text-xs font-black uppercase tracking-wider block">Somme Insuffisante</span>
                        <span class="text-xs text-rose-600 dark:text-rose-400 font-bold">Il manque ${(this.totalAmount - this.cashGiven).toFixed(2)} €</span>
                      </div>
                    </div>
                    <span class="font-mono-nums font-black text-2xl text-rose-600 dark:text-rose-400">-${(this.totalAmount - this.cashGiven).toFixed(2)} €</span>
                  </div>
                ` : changeDue === 0 ? `
                  <div class="p-3.5 rounded-2xl bg-emerald-500/15 border-2 border-emerald-500/30 text-emerald-800 dark:text-emerald-300 flex items-center justify-between shadow-sm animate-enter">
                    <div class="flex items-center gap-3">
                      <div class="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
                        ${Icons.check('w-6 h-6')}
                      </div>
                      <div>
                        <span class="text-xs font-black uppercase tracking-wider block">Compte Juste</span>
                        <span class="text-xs text-slate-500 dark:text-slate-400 font-semibold">Aucune monnaie à rendre</span>
                      </div>
                    </div>
                    <span class="font-mono-nums font-black text-2xl text-emerald-600 dark:text-emerald-400">0,00 €</span>
                  </div>
                ` : isAutoCalc ? `
                  <div class="p-4 rounded-3xl bg-emerald-500/15 border-2 border-emerald-500/40 text-emerald-950 dark:text-emerald-100 space-y-3 shadow-md animate-enter">
                    <div class="flex items-center justify-between pb-2 border-b border-emerald-500/25">
                      <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center flex-shrink-0 shadow-sm">
                          ${Icons.banknote('w-6 h-6')}
                        </div>
                        <div>
                          <div class="flex items-center gap-2">
                            <span class="text-xs font-black uppercase tracking-wider block text-emerald-900 dark:text-emerald-200">RENDU DE MONNAIE</span>
                            <span class="text-[9px] font-black text-emerald-800 dark:text-emerald-300 bg-emerald-500/20 px-1.5 py-0.5 rounded border border-emerald-500/30 uppercase tracking-wider">Optimisé Tiroir</span>
                            <button type="button" id="btn-toggle-auto-calc" class="text-[10px] font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white underline cursor-pointer ml-1" title="Passer en mode manuel pour cette vente">Mode manuel</button>
                          </div>
                          <span class="text-xs text-emerald-700 dark:text-emerald-400 font-bold">À sortir du tiroir (préserve le fond)</span>
                        </div>
                      </div>
                      <div class="text-right">
                        <span class="font-mono-nums font-black text-3xl text-emerald-600 dark:text-emerald-400 block">${changeDue.toFixed(2)} €</span>
                      </div>
                    </div>

                    <!-- Plateau Visuel Réel : Toutes les pièces et billets dessinés un par un -->
                    <div class="space-y-2">
                      <div class="flex items-center justify-between text-xs font-black uppercase tracking-wider">
                        <span class="text-emerald-900 dark:text-emerald-200">Coupures à prendre (${changeItems.reduce((acc, [_, cnt]) => acc + cnt, 0)} au total) :</span>
                      </div>

                      <!-- Plateau horizontal avec chaque coupure dessinée -->
                      <div class="p-2.5 rounded-2xl bg-white/90 dark:bg-slate-900/90 border border-emerald-500/30 flex flex-wrap items-center gap-2.5 shadow-inner min-h-[58px]">
                        ${changeItems.map(([id, cnt]) => {
                          const denom = EURO_DENOMINATIONS.find(d => d.id === id);
                          if (!denom) return '';
                          const isBill = denom.type === 'bill';
                          const imgSrc = isBill ? `/currency/bill_${id}.png` : `/currency/coin_${id}.png`;
                          const imgClass = isBill ? 'h-9 w-15 object-contain rounded-md shadow-xs' : 'w-9 h-9 object-contain drop-shadow-md';

                          return Array.from({ length: cnt }).map(() => `
                            <div class="flex flex-col items-center gap-0.5 group/item select-none transition-transform hover:scale-110 active:scale-95" title="${denom.label}">
                              <img src="${imgSrc}" alt="${denom.label}" class="${imgClass}" />
                              <span class="text-[9px] font-black font-mono text-slate-700 dark:text-slate-300 leading-none">${denom.label}</span>
                            </div>
                          `).join('');
                        }).join('')}
                      </div>

                      <!-- Décomposition par coupure avec pièces répétées -->
                      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-0.5">
                        ${changeItems.map(([id, cnt]) => {
                          const denom = EURO_DENOMINATIONS.find(d => d.id === id);
                          if (!denom) return '';
                          const isBill = denom.type === 'bill';
                          const imgSrc = isBill ? `/currency/bill_${id}.png` : `/currency/coin_${id}.png`;
                          const imgClass = isBill ? 'h-8 w-13 object-contain rounded' : 'w-8 h-8 object-contain drop-shadow-sm';

                          return `
                            <div class="p-2 rounded-xl bg-white dark:bg-slate-800/90 border border-emerald-500/30 flex flex-col justify-between gap-1 shadow-2xs">
                              <div class="flex items-center justify-between">
                                <span class="text-xs font-black font-mono text-slate-900 dark:text-white">${cnt} × ${denom.label}</span>
                                <span class="text-xs font-black text-emerald-600 dark:text-emerald-400 font-mono-nums">${(cnt * denom.value).toFixed(2)} €</span>
                              </div>
                              <div class="flex items-center gap-1.5 flex-wrap">
                                ${Array.from({ length: cnt }).map(() => `
                                  <img src="${imgSrc}" alt="${denom.label}" class="${imgClass} transition-transform hover:scale-105" />
                                `).join('')}
                              </div>
                            </div>
                          `;
                        }).join('')}
                      </div>
                    </div>
                  </div>
                ` : `
                  <div class="p-4 rounded-3xl bg-slate-100 dark:bg-slate-800/80 border-2 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 space-y-3 shadow-md animate-enter">
                    <div class="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700">
                      <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-xl bg-slate-700 text-white flex items-center justify-center flex-shrink-0 shadow-sm">
                          ${Icons.banknote('w-6 h-6')}
                        </div>
                        <div>
                          <div class="flex items-center gap-2">
                            <span class="text-xs font-black uppercase tracking-wider block text-slate-800 dark:text-slate-200">RENDU DE MONNAIE</span>
                            <span class="text-[9px] font-black text-slate-600 dark:text-slate-300 bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-600 uppercase tracking-wider">Mode Manuel Libre</span>
                            <button type="button" id="btn-toggle-auto-calc" class="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer ml-1" title="Activer le calcul automatique pour cette vente">Calculer auto</button>
                          </div>
                          <span class="text-xs text-slate-500 dark:text-slate-400 font-medium">Calcul des pièces libre (aucun comptage imposé)</span>
                        </div>
                      </div>
                      <div class="text-right">
                        <span class="font-mono-nums font-black text-3xl text-emerald-600 dark:text-emerald-400 block">${changeDue.toFixed(2)} €</span>
                      </div>
                    </div>

                    <div class="p-3.5 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-750 flex items-center justify-between gap-3 text-xs">
                      <div class="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                        ${Icons.info('w-4 h-4 text-slate-400 flex-shrink-0')}
                        <span>Rendez librement <strong>${changeDue.toFixed(2)} €</strong> selon les pièces ou billets de votre choix dans le tiroir.</span>
                      </div>
                    </div>
                  </div>
                `}
              ` : ''}
            </div>

            <!-- Bouton de Validation Encaisser -->
            ${this.selectedMethod === 'especes' ? `
              <div class="pt-1 flex-shrink-0">
                <button 
                  id="btn-confirm-cash" 
                  class="w-full py-3.5 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-base flex items-center justify-center gap-3 shadow-lg shadow-emerald-600/30 active:scale-[0.98] transition-all disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                  ${!isCashValid ? 'disabled' : ''}
                >
                  ${Icons.check('w-6 h-6')}
                  <span>Encaisser ${this.totalAmount.toFixed(2)} € (Espèces) [Entrée]</span>
                </button>
              </div>
            ` : ''}

          </div>

          <!-- Colonne Droite : Visualisation Billets & Pièces Réels (7 colonnes) -->
          <div class="lg:col-span-7 xl:col-span-7 bg-slate-50/80 dark:bg-slate-800/40 p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between h-full overflow-y-auto space-y-3">
            
            <div class="space-y-3">
              <div class="flex items-center justify-between pb-1.5 border-b border-slate-200 dark:border-slate-700/80">
                <div>
                  <h3 class="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">Coupures Reçues du Client</h3>
                  <p class="text-[11px] text-slate-500 dark:text-slate-400">Clic gauche pour ajouter (+1), clic droit pour retirer (-1)</p>
                </div>
                <span class="text-xs font-bold px-2.5 py-0.5 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/25 shadow-2xs">
                  Caisse Active
                </span>
              </div>

              <!-- 1. VRAIS BILLETS EUROS (50€, 20€, 10€, 5€) -->
              <div class="space-y-1.5">
                <span class="text-[11px] uppercase font-black text-slate-400 tracking-wider block">Billets de Banque</span>
                <div class="grid grid-cols-2 gap-3">
                  ${billDenoms.map(d => {
                    const count = this.givenCounts[d.id] || 0;
                    return `
                      <button 
                        type="button" 
                        data-cash-denom="${d.id}"
                        class="group relative rounded-2xl border-2 transition-all cursor-pointer p-2 flex flex-col items-center justify-center bg-white dark:bg-slate-900 shadow-sm hover:shadow-md ${
                          count > 0 ? 'border-orange-500 ring-2 ring-orange-500/20 bg-orange-500/5' : 'border-slate-200 dark:border-slate-700/80 hover:border-orange-400'
                        }"
                        title="Clic gauche: +1 (${d.label}), Clic droit: -1"
                      >
                        ${CheckoutModalComponent.renderEuroBillVisual(d.id, count, false)}
                        <div class="mt-1.5 flex items-center justify-between w-full px-2">
                          <span class="text-xs font-black font-mono text-slate-800 dark:text-slate-200">${d.label}</span>
                          <span class="text-[10px] text-slate-400 font-bold uppercase">Billet</span>
                        </div>
                      </button>
                    `;
                  }).join('')}
                </div>
              </div>

              <!-- 2. VRAIES PIÈCES EUROS (2€, 1€, 0.50€, 0.20€, 0.10€, 0.05€, 0.02€, 0.01€) -->
              <div class="space-y-1.5">
                <span class="text-[11px] uppercase font-black text-slate-400 tracking-wider block">Pièces de Monnaie</span>
                <div class="grid grid-cols-4 gap-2.5">
                  ${coinDenoms.map(d => {
                    const count = this.givenCounts[d.id] || 0;
                    return `
                      <button 
                        type="button" 
                        data-cash-denom="${d.id}"
                        class="group relative rounded-2xl border-2 transition-all cursor-pointer p-2 flex flex-col items-center justify-center bg-white dark:bg-slate-900 shadow-sm hover:shadow-md ${
                          count > 0 ? 'border-orange-500 ring-2 ring-orange-500/20 bg-orange-500/5' : 'border-slate-200 dark:border-slate-700/80 hover:border-orange-400'
                        }"
                        title="Clic gauche: +1 (${d.label}), Clic droit: -1"
                      >
                        ${CheckoutModalComponent.renderEuroCoinVisual(d.id, count, false)}
                        <span class="mt-1.5 text-xs font-black font-mono text-slate-800 dark:text-slate-200">${d.label}</span>
                      </button>
                    `;
                  }).join('')}
                </div>
              </div>
            </div>

            <div class="pt-2 text-center text-[11px] text-slate-400 border-t border-slate-200 dark:border-slate-700/80">
              Astuce Rush : Tapez directement le montant ou appuyez sur <strong>Entrée</strong> dès que le compte est bon.
            </div>

          </div>

        </div>

      </div>
    `;

    this.attachEventListeners(isAutoCalc);
  }

  private attachEventListeners(isAutoCalc: boolean): void {
    if (!this.container) return;

    // Événements
    this.container.querySelector('#modal-close-btn')?.addEventListener('click', () => this.hide());

    this.container.querySelector('#btn-method-especes')?.addEventListener('click', () => {
      this.stopTpePolling();
      this.selectedMethod = 'especes';
      this.cashGiven = 0;
      this.givenCounts = {};
      this.render();
    });

    this.container.querySelector('#btn-method-tpe')?.addEventListener('click', () => {
      this.selectedMethod = 'tpe';
      this.render();
    });

    this.container.querySelector('#btn-switch-cash-fallback')?.addEventListener('click', () => {
      this.stopTpePolling();
      this.selectedMethod = 'especes';
      this.cashGiven = 0;
      this.givenCounts = {};
      this.render();
    });

    this.container.querySelector('#btn-exact-amount')?.addEventListener('click', () => {
      this.cashGiven = this.totalAmount;
      this.givenCounts = decomposeCashAmount(this.totalAmount);
      this.render();
    });

    this.container.querySelector('#btn-reset-cash')?.addEventListener('click', () => {
      this.cashGiven = 0;
      this.givenCounts = {};
      this.render();
    });

    // Boutons raccourcis rapides (+1, +2, +5, +10, +20, +50)
    this.container.querySelectorAll('[data-quick-add]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const val = parseFloat((e.currentTarget as HTMLElement).getAttribute('data-quick-add') || '0');
        this.cashGiven = Number((this.cashGiven + val).toFixed(2));
        this.givenCounts = decomposeCashAmount(this.cashGiven);
        this.render();
      });
    });

    // Clics sur les billets et pièces réels
    this.container.querySelectorAll('[data-cash-denom]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = (e.currentTarget as HTMLElement).getAttribute('data-cash-denom') || '';
        if (!id) return;
        this.givenCounts[id] = (this.givenCounts[id] || 0) + 1;
        this.cashGiven = calculateCashTotal(this.givenCounts);
        this.render();
      });

      btn.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const id = (e.currentTarget as HTMLElement).getAttribute('data-cash-denom') || '';
        if (!id) return;
        if (this.givenCounts[id] && this.givenCounts[id] > 0) {
          this.givenCounts[id]--;
          if (this.givenCounts[id] === 0) {
            delete this.givenCounts[id];
          }
          this.cashGiven = calculateCashTotal(this.givenCounts);
          this.render();
        }
      });
    });

    // Saisie manuelle directe dans l'input
    const cashInput = this.container.querySelector('#input-cash-given') as HTMLInputElement;
    if (cashInput) {
      cashInput.addEventListener('input', () => {
        this.cashGiven = parseFloat(cashInput.value) || 0;
        this.givenCounts = decomposeCashAmount(this.cashGiven);
        this.render();
        const reInput = this.container?.querySelector('#input-cash-given') as HTMLInputElement;
        if (reInput) {
          reInput.focus();
          const valLen = reInput.value.length;
          reInput.setSelectionRange(valLen, valLen);
        }
      });
    }

    // Validation Espèces
    this.container.querySelector('#btn-toggle-auto-calc')?.addEventListener('click', () => {
      this.autoCalcOverride = !isAutoCalc;
      this.render();
    });

    this.container.querySelector('#btn-confirm-cash')?.addEventListener('click', () => {
      this.confirmCashSale();
    });

    // TPE Events
    this.container.querySelector('#btn-start-tpe')?.addEventListener('click', () => {
      this.startTpePayment();
    });

    this.container.querySelector('#btn-retry-tpe')?.addEventListener('click', () => {
      this.startTpePayment();
    });

    this.container.querySelector('#btn-confirm-manual-tpe')?.addEventListener('click', () => {
      this.confirmManualTpeSale();
    });

    this.container.querySelector('#btn-fallback-manual-tpe')?.addEventListener('click', () => {
      this.confirmManualTpeSale();
    });

    this.container.querySelector('#btn-cancel-tpe')?.addEventListener('click', () => {
      this.cancelTpePayment();
    });
  }

  private confirmManualTpeSale(): void {
    const saleItems = this.items.map(item => ({
      productId: item.product.id,
      productName: item.product.name,
      unitPrice: item.product.price,
      quantity: item.quantity,
      totalPrice: item.product.price * item.quantity
    }));

    db.recordTpePayment({
      amount: this.totalAmount,
      cardBrand: 'Saisie Manuelle TPE',
      status: 'SUCCESS'
    });

    db.recordSale({
      items: saleItems,
      totalAmount: this.totalAmount,
      paymentMethod: 'tpe'
    });

    this.playTpeSound();
    this.hide();
    this.onCompleteCallback();
  }

  private confirmCashSale(): void {
    const saleItems = this.items.map(item => ({
      productId: item.product.id,
      productName: item.product.name,
      unitPrice: item.product.price,
      quantity: item.quantity,
      totalPrice: item.product.price * item.quantity
    }));

    if (Object.keys(this.givenCounts).length === 0 && this.cashGiven > 0) {
      this.givenCounts = decomposeCashAmount(this.cashGiven);
    }

    const changeDue = Number(Math.max(0, this.cashGiven - this.totalAmount).toFixed(2));
    const drawerState = db.getCurrentDrawerState(this.givenCounts);
    const cashFloatSettings = db.getCashFloatSettings();
    const isAutoCalc = this.autoCalcOverride !== null ? this.autoCalcOverride : (cashFloatSettings.autoCalculationEnabled !== false);
    const changeBreakdown = (isAutoCalc && changeDue > 0) ? decomposeSmartCashChange(changeDue, drawerState) : undefined;

    db.recordSale({
      items: saleItems,
      totalAmount: this.totalAmount,
      paymentMethod: 'especes',
      cashReceived: this.cashGiven,
      cashReturned: changeDue,
      cashBreakdown: {
        given: { ...this.givenCounts },
        returned: changeBreakdown
      }
    });

    this.hide();
    this.onCompleteCallback();
  }
}
