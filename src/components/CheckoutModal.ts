import { CartItem, PaymentMethod } from '../types';
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
  private onCompleteCallback: () => void;

  // État du paiement TPE SumUp
  private tpeState: 'idle' | 'starting' | 'waiting_card' | 'approved' | 'refused' = 'idle';
  private tpeCheckoutId: string = '';
  private tpeReaderCheckoutId?: string = '';
  private tpePollingTimer: any = null;
  private tpeErrorMessage: string = '';
  private tpeTxDetails: { cardBrand?: string; last4?: string; transactionCode?: string } | null = null;

  constructor(items: CartItem[], onComplete: () => void) {
    this.items = items;
    this.totalAmount = items.reduce((sum, i) => sum + (i.product.price * i.quantity), 0);
    this.cashGiven = this.totalAmount;
    this.onCompleteCallback = onComplete;
  }

  public show(): void {
    this.container = document.createElement('div');
    this.container.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-enter';
    this.render();
    document.body.appendChild(this.container);
  }

  public hide(): void {
    this.stopTpePolling();
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

    // Boucle de polling toutes les 1.5 secondes (timeout de 90 secondes)
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
          // Paiement accepté par la banque / terminal
          this.tpeState = 'approved';
          this.tpeTxDetails = {
            cardBrand: statusRes.cardBrand || 'Carte Bancaire',
            last4: statusRes.last4,
            transactionCode: statusRes.transactionCode || this.tpeCheckoutId
          };
          this.playTpeSound();
          this.render();

          // Enregistrer la vente en DB
          this.completeTpeSale();

          // Fermer automatiquement après un court instant
          setTimeout(() => {
            this.hide();
            this.onCompleteCallback();
          }, 1800);
        } else {
          // Paiement refusé ou annulé
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

  private render(): void {
    if (!this.container) return;

    const changeDue = Math.max(0, this.cashGiven - this.totalAmount);
    const isCashValid = this.selectedMethod === 'especes' && this.cashGiven >= this.totalAmount;
    const tpe = db.getTpeSettings();

    this.container.innerHTML = `
      <div class="relative w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden text-slate-900 dark:text-slate-100">
        
        <!-- Header -->
        <div class="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-800/50">
          <div class="flex items-center gap-2.5">
            ${Icons.creditCard('w-5 h-5 text-orange-500')}
            <h2 class="text-sm font-bold tracking-tight text-slate-900 dark:text-white">Règlement de la commande</h2>
          </div>
          <button id="modal-close-btn" class="p-1.5 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div class="p-6 space-y-5">
          
          <!-- Affichage du montant total -->
          <div class="p-4 rounded-2xl bg-orange-500/10 border border-orange-500/30 flex items-baseline justify-between shadow-xs">
            <span class="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Total à payer</span>
            <span class="font-mono-nums font-black text-3xl text-orange-600 dark:text-orange-400">${this.totalAmount.toFixed(2)} €</span>
          </div>

          <!-- Sélecteur de méthode -->
          <div class="grid grid-cols-2 gap-2.5">
            <button 
              id="btn-method-especes" 
              class="py-3 px-4 rounded-2xl text-xs font-black flex items-center justify-center gap-2 border transition-all ${
                this.selectedMethod === 'especes'
                  ? 'bg-orange-500 text-white border-orange-500 shadow-sm shadow-orange-500/25'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200'
              }"
            >
              ${Icons.banknote('w-4 h-4')}
              <span>Espèces</span>
            </button>

            <button 
              id="btn-method-tpe" 
              class="py-3 px-4 rounded-2xl text-xs font-black flex items-center justify-center gap-2 border transition-all ${
                this.selectedMethod === 'tpe'
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-600/25'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200'
              }"
            >
              ${Icons.creditCard('w-4 h-4')}
              <span>Carte (TPE SumUp)</span>
            </button>
          </div>

          <!-- Écran Espèces (avec boutons de monnaie rapides) -->
          ${this.selectedMethod === 'especes' ? `
            <div class="space-y-4 pt-1">
              <div class="flex items-center justify-between text-xs">
                <span class="text-slate-500 dark:text-slate-400 font-bold">Somme reçue</span>
                <button id="btn-exact-amount" class="px-2.5 py-1 rounded-full bg-emerald-500/15 hover:bg-emerald-500 hover:text-white text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 font-bold font-mono-nums transition-all text-[11px]">
                  Somme exacte (${this.totalAmount.toFixed(2)} €)
                </button>
              </div>

              <!-- Champ montant reçu -->
              <div class="relative">
                <input 
                  type="number" 
                  step="0.10" 
                  id="input-cash-given" 
                  value="${this.cashGiven.toFixed(2)}" 
                  class="w-full text-2xl font-mono-nums font-black px-4 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 text-right pr-9 shadow-inner"
                />
                <span class="absolute right-3.5 top-1/2 -translate-y-1/2 text-base font-mono-nums font-bold text-slate-400">€</span>
              </div>

              <!-- Boutons de monnaie rapides -->
              <div class="grid grid-cols-4 sm:grid-cols-7 gap-1.5 pt-1">
                <button data-quick-cash="0.50" class="py-2.5 px-2 rounded-xl bg-amber-500/10 hover:bg-amber-500 hover:text-white text-amber-900 dark:text-amber-200 font-mono-nums font-black text-xs border border-amber-500/30 transition-all active:scale-95 shadow-2xs flex items-center justify-center text-center cursor-pointer">0.50 €</button>
                <button data-quick-cash="1.00" class="py-2.5 px-2 rounded-xl bg-amber-500/10 hover:bg-amber-500 hover:text-white text-amber-900 dark:text-amber-200 font-mono-nums font-black text-xs border border-amber-500/30 transition-all active:scale-95 shadow-2xs flex items-center justify-center text-center cursor-pointer">1 €</button>
                <button data-quick-cash="2.00" class="py-2.5 px-2 rounded-xl bg-amber-500/10 hover:bg-amber-500 hover:text-white text-amber-900 dark:text-amber-200 font-mono-nums font-black text-xs border border-amber-500/30 transition-all active:scale-95 shadow-2xs flex items-center justify-center text-center cursor-pointer">2 €</button>
                <button data-quick-cash="5.00" class="py-2.5 px-2 rounded-xl bg-amber-500/10 hover:bg-amber-500 hover:text-white text-amber-900 dark:text-amber-200 font-mono-nums font-black text-xs border border-amber-500/30 transition-all active:scale-95 shadow-2xs flex items-center justify-center text-center cursor-pointer">5 €</button>
                <button data-quick-cash="10.00" class="py-2.5 px-2 rounded-xl bg-amber-500/10 hover:bg-amber-500 hover:text-white text-amber-900 dark:text-amber-200 font-mono-nums font-black text-xs border border-amber-500/30 transition-all active:scale-95 shadow-2xs flex items-center justify-center text-center cursor-pointer">10 €</button>
                <button data-quick-cash="20.00" class="py-2.5 px-2 rounded-xl bg-amber-500/10 hover:bg-amber-500 hover:text-white text-amber-900 dark:text-amber-200 font-mono-nums font-black text-xs border border-amber-500/30 transition-all active:scale-95 shadow-2xs flex items-center justify-center text-center cursor-pointer">20 €</button>
                <button id="btn-reset-cash" class="py-2.5 px-2 rounded-xl bg-rose-500/10 hover:bg-rose-500 hover:text-white text-rose-600 dark:text-rose-400 font-mono-nums font-black text-xs border border-rose-500/30 transition-all active:scale-95 shadow-2xs flex items-center justify-center text-center cursor-pointer">0 €</button>
              </div>

              <!-- Ligne Rendu de monnaie -->
              <div class="p-4 rounded-2xl ${
                this.cashGiven < this.totalAmount
                  ? 'bg-rose-500/15 border border-rose-500/40 text-rose-700 dark:text-rose-300'
                  : 'bg-emerald-500/15 border border-emerald-500/40 text-emerald-800 dark:text-emerald-300'
              } flex items-center justify-between shadow-xs">
                <span class="text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
                  ${this.cashGiven < this.totalAmount ? Icons.alertTriangle('w-4 h-4') : Icons.banknote('w-4 h-4')}
                  <span>${this.cashGiven < this.totalAmount ? 'Somme Insuffisante' : 'Rendu de monnaie'}</span>
                </span>
                <span class="font-mono-nums font-black text-2xl">
                  ${this.cashGiven < this.totalAmount ? `-${(this.totalAmount - this.cashGiven).toFixed(2)} €` : `${changeDue.toFixed(2)} €`}
                </span>
              </div>

              <!-- Bouton de validation Espèces -->
              <div class="pt-2">
                <button 
                  id="btn-confirm-cash" 
                  class="w-full py-4 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-base flex items-center justify-center gap-2 shadow-sm shadow-emerald-600/25 active:scale-[0.98] transition-all disabled:opacity-30 disabled:pointer-events-none"
                  ${!isCashValid ? 'disabled' : ''}
                >
                  ${Icons.check('w-5 h-5')}
                  <span>Encaisser ${this.totalAmount.toFixed(2)} € (Espèces)</span>
                </button>
              </div>
            </div>
          ` : `
            <!-- Écran TPE SumUp Réel -->
            ${!tpe.isConnected || !tpe.apiKey ? `
              <div class="p-5 rounded-3xl bg-indigo-500/10 border border-indigo-500/30 text-center space-y-3.5">
                <div class="flex items-center justify-between px-2 pb-2 border-b border-indigo-500/20 text-[11px] font-bold">
                  <span class="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                    <span class="w-2 h-2 rounded-full bg-slate-400"></span>
                    <span>${tpe.readerName || 'TPE SumUp (Saisie Manuelle)'}</span>
                  </span>
                  <span class="text-slate-400 text-[10px] font-mono">
                    Sans clé API
                  </span>
                </div>

                <div class="w-14 h-14 rounded-2xl bg-indigo-600 text-white flex items-center justify-center mx-auto shadow-sm shadow-indigo-600/25">
                  ${Icons.creditCard('w-7 h-7')}
                </div>

                <div>
                  <h3 class="text-sm font-black text-slate-900 dark:text-white">
                    Entrez le montant sur le TPE
                  </h3>
                  <p class="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs mx-auto leading-relaxed">
                    Saisissez <strong>${this.totalAmount.toFixed(2)} €</strong> directement sur le clavier de votre boîtier SumUp et faites badger le client.
                  </p>
                </div>

                <div class="font-mono-nums font-black text-3xl text-indigo-600 dark:text-indigo-400 py-1">
                  ${this.totalAmount.toFixed(2)} €
                </div>

                <div class="space-y-2 pt-1">
                  <button 
                    id="btn-confirm-manual-tpe" 
                    type="button"
                    class="w-full py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center justify-center gap-2 shadow-sm shadow-emerald-600/25 active:scale-[0.98] transition-all cursor-pointer"
                  >
                    ${Icons.check('w-4 h-4')}
                    <span>Valider l'encaissement TPE (${this.totalAmount.toFixed(2)} €)</span>
                  </button>

                  <button 
                    id="btn-switch-cash-fallback"
                    type="button"
                    class="w-full py-2.5 px-4 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    ${Icons.banknote('w-3.5 h-3.5')}
                    <span>Payer en Espèces à la place</span>
                  </button>
                </div>
              </div>
            ` : `
              <!-- TPE Prêt ou en transaction -->
              <div class="p-5 rounded-3xl bg-indigo-500/10 border border-indigo-500/30 text-center space-y-4">
                
                <!-- Barre d'état du terminal -->
                <div class="flex items-center justify-between px-2 pb-2 border-b border-indigo-500/20 text-[11px] font-bold">
                  <span class="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                    <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span>${tpe.readerName || 'SumUp Solo'}</span>
                  </span>
                  <span class="flex items-center gap-2 text-slate-500 dark:text-slate-400 font-mono-nums">
                    <span class="flex items-center gap-1">${Icons.wifi('w-3 h-3')} Connecté HTTPS</span>
                  </span>
                </div>

                <!-- État 1 : Prêt (idle) -->
                ${this.tpeState === 'idle' ? `
                  <div class="py-2 space-y-3">
                    <div class="w-14 h-14 rounded-2xl bg-indigo-600 text-white flex items-center justify-center mx-auto shadow-lg shadow-indigo-600/30">
                      ${Icons.creditCard('w-7 h-7')}
                    </div>
                    <div>
                      <p class="text-xs font-bold text-slate-700 dark:text-slate-200">Terminal SumUp prêt pour l'encaissement</p>
                      <p class="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">L'ordre sera envoyé directement sur l'écran du lecteur</p>
                    </div>
                    <div class="font-mono-nums font-black text-3xl text-indigo-600 dark:text-indigo-400 pt-1">
                      ${this.totalAmount.toFixed(2)} €
                    </div>
                    <button 
                      id="btn-start-tpe" 
                      class="w-full py-3.5 px-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm flex items-center justify-center gap-2 shadow-sm shadow-indigo-600/25 active:scale-[0.98] transition-all cursor-pointer"
                    >
                      ${Icons.zap('w-4 h-4')}
                      <span>Envoyer au terminal SumUp</span>
                    </button>
                  </div>
                ` : ''}

                <!-- État 2 : Connexion API (starting) -->
                ${this.tpeState === 'starting' ? `
                  <div class="py-6 space-y-3">
                    <div class="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                    <p class="text-xs font-black text-slate-800 dark:text-slate-100">Communication avec SumUp...</p>
                    <p class="text-[11px] text-slate-500">Transmission de l'ordre de paiement sécurisé</p>
                  </div>
                ` : ''}

                <!-- État 3 : En attente de la carte sur le TPE (waiting_card) -->
                ${this.tpeState === 'waiting_card' ? `
                  <div class="py-3 space-y-3.5">
                    <div class="relative w-16 h-16 mx-auto flex items-center justify-center">
                      <div class="absolute inset-0 rounded-full bg-indigo-500/20 animate-ping"></div>
                      <div class="w-14 h-14 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-600/30">
                        ${Icons.creditCard('w-7 h-7 animate-pulse')}
                      </div>
                    </div>

                    <div>
                      <p class="text-sm font-black text-slate-900 dark:text-white">Présentez la carte bancaire</p>
                      <p class="text-xs text-indigo-600 dark:text-indigo-400 font-bold mt-0.5">Sans-contact, Apple/Google Pay ou insertion</p>
                    </div>

                    <div class="font-mono-nums font-black text-3xl text-indigo-600 dark:text-indigo-400">
                      ${this.totalAmount.toFixed(2)} €
                    </div>

                    <div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 text-xs font-semibold">
                      <span class="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
                      <span>En attente de la réponse du client...</span>
                    </div>

                    <div class="pt-2">
                      <button 
                        id="btn-cancel-tpe" 
                        class="w-full py-2.5 px-3 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all cursor-pointer"
                      >
                        Annuler la transaction
                      </button>
                    </div>
                  </div>
                ` : ''}

                <!-- État 4 : Paiement Accepté (approved) -->
                ${this.tpeState === 'approved' ? `
                  <div class="py-4 space-y-3 animate-enter">
                    <div class="w-16 h-16 rounded-full bg-emerald-500 text-white flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/30">
                      ${Icons.check('w-9 h-9')}
                    </div>
                    <div>
                      <p class="text-base font-black text-emerald-600 dark:text-emerald-400">Paiement Accepté !</p>
                      <p class="text-xs text-slate-500 mt-0.5">${this.tpeTxDetails?.cardBrand || 'Carte Bancaire'} ${this.tpeTxDetails?.last4 ? '•••• ' + this.tpeTxDetails.last4 : ''}</p>
                    </div>
                    <div class="font-mono-nums font-black text-2xl text-emerald-600 dark:text-emerald-400">
                      ${this.totalAmount.toFixed(2)} €
                    </div>
                    <p class="text-[11px] text-slate-400">Vente enregistrée en caisse...</p>
                  </div>
                ` : ''}

                <!-- État 5 : Paiement Refusé ou Annulé (refused) -->
                ${this.tpeState === 'refused' ? `
                  <div class="py-3 space-y-3 animate-enter">
                    <div class="w-14 h-14 rounded-2xl bg-rose-500 text-white flex items-center justify-center mx-auto shadow-lg shadow-rose-500/30">
                      ${Icons.alertTriangle('w-7 h-7')}
                    </div>
                    <div>
                      <p class="text-sm font-black text-rose-600 dark:text-rose-400">Paiement Refusé ou Interrompu</p>
                      <p class="text-xs text-slate-600 dark:text-slate-300 mt-1 max-w-xs mx-auto leading-relaxed">
                        ${escapeHtml(this.tpeErrorMessage || 'La transaction a été refusée ou annulée sur le terminal.')}
                      </p>
                    </div>

                    <!-- Actions suite au refus : Réessayer, Saisie manuelle ou Espèces -->
                    <div class="space-y-2 pt-2">
                      <button 
                        id="btn-retry-tpe" 
                        class="w-full py-3.5 px-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs flex items-center justify-center gap-2 shadow-sm shadow-indigo-600/25 active:scale-[0.98] transition-all cursor-pointer"
                      >
                        ${Icons.refresh('w-4 h-4')}
                        <span>Réessayer sur le terminal TPE</span>
                      </button>

                      <button 
                        id="btn-fallback-manual-tpe" 
                        class="w-full py-3 px-4 rounded-2xl bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-700 dark:text-indigo-300 font-bold text-xs flex items-center justify-center gap-2 border border-indigo-500/30 transition-all cursor-pointer"
                      >
                        ${Icons.creditCard('w-4 h-4')}
                        <span>Saisir manuellement le montant (${this.totalAmount.toFixed(2)} €)</span>
                      </button>

                      <button 
                        id="btn-refused-to-cash" 
                        class="w-full py-2.5 px-4 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                      >
                        ${Icons.banknote('w-4 h-4')}
                        <span>Payer en Espèces à la place</span>
                      </button>
                    </div>
                  </div>
                ` : ''}

              </div>
            `}
          `}

        </div>

      </div>
    `;

    // Événements du modal
    this.container.querySelector('#modal-close-btn')?.addEventListener('click', () => this.hide());

    this.container.querySelector('#btn-method-especes')?.addEventListener('click', () => {
      this.stopTpePolling();
      this.selectedMethod = 'especes';
      this.cashGiven = this.totalAmount;
      this.render();
    });

    this.container.querySelector('#btn-method-tpe')?.addEventListener('click', () => {
      this.selectedMethod = 'tpe';
      this.render();
    });

    this.container.querySelector('#btn-switch-cash-fallback')?.addEventListener('click', () => {
      this.selectedMethod = 'especes';
      this.cashGiven = this.totalAmount;
      this.render();
    });

    this.container.querySelector('#btn-refused-to-cash')?.addEventListener('click', () => {
      this.selectedMethod = 'especes';
      this.cashGiven = this.totalAmount;
      this.tpeState = 'idle';
      this.render();
    });

    this.container.querySelector('#btn-exact-amount')?.addEventListener('click', () => {
      this.cashGiven = this.totalAmount;
      this.render();
    });

    this.container.querySelector('#btn-reset-cash')?.addEventListener('click', () => {
      this.cashGiven = 0;
      this.render();
    });

    this.container.querySelectorAll('[data-quick-cash]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const val = parseFloat((e.currentTarget as HTMLElement).getAttribute('data-quick-cash') || '0');
        if (this.cashGiven === this.totalAmount) {
          this.cashGiven = val;
        } else {
          this.cashGiven = Number((this.cashGiven + val).toFixed(2));
        }
        this.render();
      });
    });

    const cashInput = this.container.querySelector('#input-cash-given') as HTMLInputElement;
    if (cashInput) {
      cashInput.addEventListener('input', () => {
        this.cashGiven = parseFloat(cashInput.value) || 0;
        this.render();
      });
    }

    // Validation Espèces
    this.container.querySelector('#btn-confirm-cash')?.addEventListener('click', () => {
      this.confirmCashSale();
    });

    // Lancer ou Réessayer TPE
    this.container.querySelector('#btn-start-tpe')?.addEventListener('click', () => {
      this.startTpePayment();
    });

    this.container.querySelector('#btn-retry-tpe')?.addEventListener('click', () => {
      this.startTpePayment();
    });

    // Encaissement manuel sur le TPE (quand pas de clé API ou repli après échec)
    this.container.querySelector('#btn-confirm-manual-tpe')?.addEventListener('click', () => {
      this.confirmManualTpeSale();
    });

    this.container.querySelector('#btn-fallback-manual-tpe')?.addEventListener('click', () => {
      this.confirmManualTpeSale();
    });

    // Annuler TPE
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

    db.recordSale({
      items: saleItems,
      totalAmount: this.totalAmount,
      paymentMethod: 'especes',
      cashReceived: this.cashGiven,
      cashReturned: Math.max(0, this.cashGiven - this.totalAmount)
    });

    this.hide();
    this.onCompleteCallback();
  }
}
