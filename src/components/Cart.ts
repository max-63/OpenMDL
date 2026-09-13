import { CartItem, Product } from '../types';
import { Icons } from './Icons';
import { escapeHtml } from '../utils/security';

export class CartComponent {
  private items: CartItem[] = [];
  private onCheckoutCallback: () => void;
  private onUpdateCallback: () => void;

  constructor(onCheckout: () => void, onUpdate: () => void) {
    this.onCheckoutCallback = onCheckout;
    this.onUpdateCallback = onUpdate;
  }

  public getItems(): CartItem[] {
    return this.items;
  }

  public getTotal(): number {
    return this.items.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
  }

  public getItemQuantity(productId: string): number {
    const item = this.items.find(i => i.product.id === productId);
    return item ? item.quantity : 0;
  }

  public addItem(product: Product, quantity = 1): void {
    if (product.stock <= 0) return;

    const existing = this.items.find(i => i.product.id === product.id);
    if (existing) {
      if (existing.quantity + quantity <= product.stock) {
        existing.quantity += quantity;
      }
    } else {
      this.items.push({ product, quantity: Math.min(quantity, product.stock) });
    }
    this.onUpdateCallback();
  }

  public removeItem(productId: string, quantity = 1): void {
    const existingIndex = this.items.findIndex(i => i.product.id === productId);
    if (existingIndex === -1) return;

    const existing = this.items[existingIndex];
    if (existing.quantity > quantity) {
      existing.quantity -= quantity;
    } else {
      this.items.splice(existingIndex, 1);
    }
    this.onUpdateCallback();
  }

  public clear(): void {
    this.items = [];
    this.onUpdateCallback();
  }

  public render(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'flex flex-col h-full w-full overflow-hidden';

    const total = this.getTotal();
    const totalCount = this.items.reduce((sum, i) => sum + i.quantity, 0);

    // En-tête du Panier
    const header = document.createElement('div');
    header.className = 'px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50';
    header.innerHTML = `
      <div class="flex items-center gap-2.5">
        ${Icons.receipt('w-4 h-4 text-orange-500')}
        <h2 class="font-bold text-sm text-slate-900 dark:text-white tracking-tight">Commande en cours</h2>
      </div>
      <span class="font-mono-nums text-xs font-bold px-2.5 py-1 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20">
        ${totalCount} ${totalCount > 1 ? 'articles' : 'article'}
      </span>
    `;
    container.appendChild(header);

    // Liste des Articles
    const listContainer = document.createElement('div');
    listContainer.className = 'flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-2 bg-slate-50/30 dark:bg-slate-950/40';

    if (this.items.length === 0) {
      listContainer.innerHTML = `
        <div class="h-full flex flex-col items-center justify-center text-center text-slate-400 dark:text-slate-500 py-16 space-y-2">
          <div class="w-12 h-12 rounded-2xl bg-orange-500/10 text-orange-500 flex items-center justify-center mb-1">
            ${Icons.cart('w-6 h-6')}
          </div>
          <p class="text-xs font-bold text-slate-600 dark:text-slate-300">Ticket vide</p>
          <p class="text-[11px] text-slate-400 max-w-[180px]">Cliquez sur les touches [+] des produits pour les ajouter</p>
        </div>
      `;
    } else {
      this.items.forEach(item => {
        const itemRow = document.createElement('div');
        itemRow.className = 'flex items-center justify-between py-2.5 px-3 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 shadow-xs hover:border-orange-200 transition-colors';

        const itemSubtotal = (item.product.price * item.quantity).toFixed(2);

        const safeName = escapeHtml(item.product.name);
        const safeId = escapeHtml(item.product.id);

        itemRow.innerHTML = `
          <div class="flex-1 min-w-0 pr-3">
            <h4 class="font-bold text-xs text-slate-900 dark:text-slate-100 truncate">${safeName}</h4>
            <div class="font-mono-nums text-[11px] text-slate-400 mt-0.5">
              ${item.product.price.toFixed(2)} € /u
            </div>
          </div>
          
          <div class="flex items-center gap-2.5">
            <div class="flex items-center rounded-lg bg-slate-100 dark:bg-slate-700/80 p-0.5 border border-slate-200 dark:border-slate-600">
              <button data-action="minus" data-id="${safeId}" class="p-1 hover:bg-white dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 rounded transition-colors active:scale-95" title="Diminuer">
                ${Icons.minus('w-3.5 h-3.5')}
              </button>
              <span class="px-2 text-xs font-mono-nums font-black text-slate-900 dark:text-white min-w-[22px] text-center">${item.quantity}</span>
              <button data-action="plus" data-id="${safeId}" class="p-1 hover:bg-white dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 rounded transition-colors active:scale-95 ${item.quantity >= item.product.stock ? 'opacity-30 cursor-not-allowed' : ''}" title="Augmenter">
                ${Icons.plus('w-3.5 h-3.5')}
              </button>
            </div>
            
            <div class="text-right min-w-[50px]">
              <span class="font-mono-nums font-black text-xs text-orange-600 dark:text-orange-400">${itemSubtotal} €</span>
            </div>
          </div>
        `;

        itemRow.querySelector('[data-action="minus"]')?.addEventListener('click', () => {
          this.removeItem(item.product.id, 1);
        });

        itemRow.querySelector('[data-action="plus"]')?.addEventListener('click', () => {
          this.addItem(item.product, 1);
        });

        listContainer.appendChild(itemRow);
      });
    }

    container.appendChild(listContainer);

    // Pied du Panier (Total & Action d'encaissement avec peps)
    const footer = document.createElement('div');
    footer.className = 'p-5 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4';

    footer.innerHTML = `
      <div class="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 flex items-baseline justify-between shadow-xs">
        <span class="text-xs font-bold uppercase tracking-wider text-slate-500">Total à payer</span>
        <span class="font-mono-nums font-black text-2xl text-slate-900 dark:text-white">${total.toFixed(2)} €</span>
      </div>

      <div class="flex items-center gap-2">
        <button id="btn-clear-cart" class="p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-rose-500/10 hover:text-rose-600 hover:border-rose-500/30 text-slate-400 transition-all disabled:opacity-20 disabled:pointer-events-none" ${this.items.length === 0 ? 'disabled' : ''} title="Annuler le ticket">
          ${Icons.trash('w-4 h-4')}
        </button>

        <button id="btn-checkout" class="flex-1 py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm shadow-sm shadow-emerald-600/20 active:scale-[0.98] transition-all disabled:opacity-30 disabled:pointer-events-none flex items-center justify-between" ${this.items.length === 0 ? 'disabled' : ''}>
          <span class="flex items-center gap-2">
            ${Icons.check('w-4 h-4')}
            <span>Encaisser</span>
          </span>
          <span class="font-mono-nums font-black text-base">${total.toFixed(2)} €</span>
        </button>
      </div>
    `;

    footer.querySelector('#btn-clear-cart')?.addEventListener('click', () => {
      this.clear();
    });

    footer.querySelector('#btn-checkout')?.addEventListener('click', () => {
      if (this.items.length > 0) {
        this.onCheckoutCallback();
      }
    });

    container.appendChild(footer);
    return container;
  }
}
