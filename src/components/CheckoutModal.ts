import { CartItem, PaymentMethod } from '../types';
import { db } from '../services/db';
import { Icons } from './Icons';

export class CheckoutModalComponent {
  private container: HTMLElement | null = null;
  private items: CartItem[] = [];
  private totalAmount = 0;
  private selectedMethod: PaymentMethod = 'especes';
  private cashGiven = 0;
  private onCompleteCallback: () => void;

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
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
      this.container = null;
    }
  }

  private render(): void {
    if (!this.container) return;

    const changeDue = Math.max(0, this.cashGiven - this.totalAmount);
    const isCashValid = this.selectedMethod === 'tpe' || this.cashGiven >= this.totalAmount;

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
              <span>Carte (TPE)</span>
            </button>
          </div>

          <!-- Écran Espèces (avec boutons pills rapides) -->
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

              <!-- Boutons de monnaie rapides en superbes pills arrondis -->
              <div class="grid grid-cols-4 sm:grid-cols-7 gap-1.5 pt-1">
                <button data-quick-cash="0.50" class="py-2.5 rounded-full bg-amber-500/10 hover:bg-amber-500 hover:text-white text-amber-800 dark:text-amber-300 font-mono-nums font-bold text-xs border border-amber-500/30 transition-all active:scale-95 shadow-2xs">+0.50</button>
                <button data-quick-cash="1.00" class="py-2.5 rounded-full bg-amber-500/10 hover:bg-amber-500 hover:text-white text-amber-800 dark:text-amber-300 font-mono-nums font-bold text-xs border border-amber-500/30 transition-all active:scale-95 shadow-2xs">+1 €</button>
                <button data-quick-cash="2.00" class="py-2.5 rounded-full bg-amber-500/10 hover:bg-amber-500 hover:text-white text-amber-800 dark:text-amber-300 font-mono-nums font-bold text-xs border border-amber-500/30 transition-all active:scale-95 shadow-2xs">+2 €</button>
                <button data-quick-cash="5.00" class="py-2.5 rounded-full bg-amber-500/10 hover:bg-amber-500 hover:text-white text-amber-800 dark:text-amber-300 font-mono-nums font-bold text-xs border border-amber-500/30 transition-all active:scale-95 shadow-2xs">+5 €</button>
                <button data-quick-cash="10.00" class="py-2.5 rounded-full bg-amber-500/10 hover:bg-amber-500 hover:text-white text-amber-800 dark:text-amber-300 font-mono-nums font-bold text-xs border border-amber-500/30 transition-all active:scale-95 shadow-2xs">+10 €</button>
                <button data-quick-cash="20.00" class="py-2.5 rounded-full bg-amber-500/10 hover:bg-amber-500 hover:text-white text-amber-800 dark:text-amber-300 font-mono-nums font-bold text-xs border border-amber-500/30 transition-all active:scale-95 shadow-2xs">+20 €</button>
                <button id="btn-reset-cash" class="py-2.5 rounded-full bg-rose-500/10 hover:bg-rose-500 hover:text-white text-rose-600 dark:text-rose-400 font-mono-nums font-bold text-xs border border-rose-500/30 transition-all active:scale-95 shadow-2xs">0 €</button>
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
            </div>
          ` : `
            <!-- Écran TPE -->
            <div class="p-6 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-center space-y-3">
              <div class="w-12 h-12 rounded-2xl bg-indigo-500 text-white flex items-center justify-center mx-auto shadow-sm shadow-indigo-500/30">
                ${Icons.creditCard('w-6 h-6')}
              </div>
              <p class="text-xs font-bold text-slate-700 dark:text-slate-200">Insérer ou badger la carte sur le TPE</p>
              <div class="font-mono-nums font-black text-2xl text-indigo-600 dark:text-indigo-400">${this.totalAmount.toFixed(2)} €</div>
            </div>
          `}

          <!-- Bouton de confirmation -->
          <div class="pt-2">
            <button 
              id="btn-confirm-payment" 
              class="w-full py-4 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-base flex items-center justify-center gap-2 shadow-sm shadow-emerald-600/25 active:scale-[0.98] transition-all disabled:opacity-30 disabled:pointer-events-none"
              ${!isCashValid ? 'disabled' : ''}
            >
              ${Icons.check('w-5 h-5')}
              <span>Valider l'encaissement</span>
            </button>
          </div>

        </div>

      </div>
    `;

    this.container.querySelector('#modal-close-btn')?.addEventListener('click', () => this.hide());

    this.container.querySelector('#btn-method-especes')?.addEventListener('click', () => {
      this.selectedMethod = 'especes';
      this.cashGiven = this.totalAmount;
      this.render();
    });

    this.container.querySelector('#btn-method-tpe')?.addEventListener('click', () => {
      this.selectedMethod = 'tpe';
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

    this.container.querySelector('#btn-confirm-payment')?.addEventListener('click', () => {
      this.confirmSale();
    });
  }

  private confirmSale(): void {
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
      paymentMethod: this.selectedMethod,
      cashReceived: this.selectedMethod === 'especes' ? this.cashGiven : undefined,
      cashReturned: this.selectedMethod === 'especes' ? Math.max(0, this.cashGiven - this.totalAmount) : undefined
    });

    this.hide();
    this.onCompleteCallback();
  }
}
