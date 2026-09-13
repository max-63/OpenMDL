import { db } from '../services/db';
import { Icons } from '../components/Icons';
import { Product } from '../types';
import { escapeHtml } from '../utils/security';

export class RestockView {
  private onRestockDone: () => void;
  private selectedProductId: string | null = null;
  private quantityToAdd = 24;
  private successMessage: string | null = null;

  constructor(onRestockDone: () => void) {
    this.onRestockDone = onRestockDone;
  }

  public render(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'flex-1 flex gap-3 h-full min-h-0 overflow-hidden';
    this.renderInto(container);
    return container;
  }

  private renderInto(container: HTMLElement): void {
    container.innerHTML = '';

    const products = db.getProducts();
    const restocks = db.getRestocks();
    const isAdmin = db.getCurrentVolunteer()?.isAdmin === true;

    if (!this.selectedProductId && products.length > 0) {
      this.selectedProductId = products[0].id;
    }

    const selectedProduct = products.find(p => p.id === this.selectedProductId) || products[0];

    const leftIsland = document.createElement('div');
    leftIsland.className = 'flex-1 flex flex-col min-w-0 rounded-3xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800/80 shadow-md overflow-hidden h-full';

    leftIsland.innerHTML = `
      <!-- En-tête Îlot Restock -->
      <div class="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/80 flex items-center justify-between flex-shrink-0">
        <div>
          <div class="flex items-center gap-2.5">
            ${Icons.package('w-5 h-5 text-orange-500')}
            <h1 class="text-base font-black tracking-tight text-slate-900 dark:text-white">Réapprovisionnement (Restock)</h1>
          </div>
          <p class="text-xs font-medium text-slate-500">Ajout rapide de stock par carton et mise à jour des coûts d'achat</p>
        </div>
        <div class="flex items-center gap-2">
          ${!isAdmin ? `
            <div class="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold text-xs flex items-center gap-1.5 border border-slate-200 dark:border-slate-700">
              ${Icons.shield('w-3.5 h-3.5 text-slate-400')}
              <span>Mode consultation</span>
            </div>
          ` : ''}
          ${this.successMessage ? `
            <div class="px-3.5 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center gap-1.5 animate-enter">
              ${Icons.check('w-3.5 h-3.5')}
              <span>${this.successMessage}</span>
            </div>
          ` : ''}
        </div>
      </div>

      <!-- Contenu défilable -->
      <div class="flex-1 min-h-0 overflow-y-auto p-6 space-y-5">
        
        <!-- 1. Sélection de l'article -->
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold uppercase tracking-wider text-slate-400">1. Sélectionner l'article reçu</span>
            <span class="text-xs text-slate-400 font-mono-nums">${products.length} articles au catalogue</span>
          </div>

          <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 max-h-56 overflow-y-auto p-1 border border-slate-100 dark:border-slate-800/60 rounded-2xl" id="restock-products-grid">
            ${products.length === 0 ? `
              <div class="col-span-full py-8 text-center text-xs text-slate-400 font-sans">
                Aucun article au catalogue. Rendez-vous dans "Catalogue & Tarifs" pour créer vos premiers produits.
              </div>
            ` : products.map(p => {
              const safeId = escapeHtml(p.id);
              const safeName = escapeHtml(p.name);
              const safeImg = escapeHtml(p.imageUrl);
              return `
              <button 
                type="button"
                data-select-prod="${safeId}" 
                class="p-2.5 rounded-2xl border text-left flex items-center gap-2.5 transition-all ${
                  p.id === selectedProduct?.id
                    ? 'border-orange-500 bg-orange-500/10 text-orange-950 dark:text-orange-200 ring-2 ring-orange-500/30 shadow-sm'
                    : 'border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/60 text-slate-800 dark:text-slate-200 hover:border-orange-300 dark:hover:border-slate-700'
                }"
              >
                <div class="w-9 h-9 rounded-xl bg-slate-200 dark:bg-slate-700 overflow-hidden flex-shrink-0">
                  <img src="${safeImg}" alt="${safeName}" class="w-full h-full object-cover" onerror="this.style.display='none'" />
                </div>
                <div class="min-w-0 flex-1">
                  <div class="text-xs font-bold truncate">${safeName}</div>
                  <div class="text-[11px] font-mono-nums font-semibold text-slate-400">${p.stock} u en stock</div>
                </div>
              </button>
            `}).join('')}
          </div>
        </div>

        ${selectedProduct ? `
          <!-- 2. Récapitulatif et projection -->
          <div class="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 flex items-center justify-between shadow-xs">
            <div class="flex items-center gap-3">
              <div class="w-12 h-12 rounded-xl bg-slate-200 dark:bg-slate-700 overflow-hidden flex-shrink-0">
                <img src="${escapeHtml(selectedProduct.imageUrl)}" alt="${escapeHtml(selectedProduct.name)}" class="w-full h-full object-cover" onerror="this.style.display='none'" />
              </div>
              <div>
                <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Article sélectionné</span>
                <div class="font-extrabold text-sm text-slate-900 dark:text-white">${escapeHtml(selectedProduct.name)}</div>
                <div class="text-xs font-mono-nums font-semibold text-slate-500">Stock actuel : ${selectedProduct.stock} unités</div>
              </div>
            </div>

            ${isAdmin ? `
              <div class="text-right">
                <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Nouveau stock prévu</span>
                <div class="font-mono-nums font-black text-2xl text-emerald-600 dark:text-emerald-400" id="preview-new-stock">
                  ${selectedProduct.stock + this.quantityToAdd} u
                </div>
              </div>
            ` : `
              <div class="text-right">
                <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Prix de vente</span>
                <div class="font-mono-nums font-black text-xl text-slate-900 dark:text-white">
                  ${selectedProduct.price.toFixed(2)} €
                </div>
              </div>
            `}
          </div>

          ${isAdmin ? `
            <!-- 3. Quantité reçue -->
            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <label class="block text-xs font-bold text-slate-600 dark:text-slate-300">2. Quantité reçue (sélection rapide ou sur-mesure)</label>
                <span class="text-[11px] font-mono-nums font-bold text-orange-500" id="selected-qty-indicator">+${this.quantityToAdd} unités sélectionnées</span>
              </div>
              
              <div class="grid grid-cols-4 sm:grid-cols-5 gap-2 font-mono-nums">
                <button type="button" data-quick-qty="6" class="py-2.5 rounded-xl text-xs font-bold border transition-all ${this.quantityToAdd === 6 ? 'bg-orange-500 text-white border-orange-500 shadow-md shadow-orange-500/25 ring-2 ring-orange-500/30' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'}">+6</button>
                <button type="button" data-quick-qty="12" class="py-2.5 rounded-xl text-xs font-bold border transition-all ${this.quantityToAdd === 12 ? 'bg-orange-500 text-white border-orange-500 shadow-md shadow-orange-500/25 ring-2 ring-orange-500/30' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'}">+12</button>
                <button type="button" data-quick-qty="24" class="py-2.5 rounded-xl text-xs font-bold border transition-all ${this.quantityToAdd === 24 ? 'bg-orange-500 text-white border-orange-500 shadow-md shadow-orange-500/25 ring-2 ring-orange-500/30' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'}">+24 (carton)</button>
                <button type="button" data-quick-qty="48" class="py-2.5 rounded-xl text-xs font-bold border transition-all ${this.quantityToAdd === 48 ? 'bg-orange-500 text-white border-orange-500 shadow-md shadow-orange-500/25 ring-2 ring-orange-500/30' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'}">+48</button>
                
                <!-- Bouton / Champ Sur-Mesure avec style actif orange visible -->
                <div class="relative">
                  <input 
                    type="number" 
                    min="1" 
                    id="custom-qty-input" 
                    value="${[6, 12, 24, 48].includes(this.quantityToAdd) ? '' : this.quantityToAdd}" 
                    class="w-full text-center py-2.5 text-xs font-bold rounded-xl border transition-all font-mono-nums ${
                      ![6, 12, 24, 48].includes(this.quantityToAdd)
                        ? 'bg-orange-500 text-white border-orange-500 shadow-md shadow-orange-500/25 ring-2 ring-orange-500/40 font-black placeholder:text-white/70'
                        : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white hover:bg-slate-200 dark:hover:bg-slate-700 focus:bg-orange-500 focus:text-white focus:border-orange-500 focus:ring-2 focus:ring-orange-500/40'
                    }" 
                    placeholder="Autre..." 
                  />
                </div>
              </div>
            </div>

            <!-- 4. Ajustement des prix -->
            <div class="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label class="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Prix de Vente (€)</label>
                <input type="number" step="0.05" id="restock-new-price" value="${selectedProduct.price.toFixed(2)}" class="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono-nums font-bold text-xs focus:ring-2 focus:ring-orange-500/30" />
              </div>

              <div>
                <label class="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Coût d'Achat Fournisseur (€)</label>
                <input type="number" step="0.05" id="restock-new-cost" value="${selectedProduct.costPrice.toFixed(2)}" class="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono-nums font-bold text-xs focus:ring-2 focus:ring-orange-500/30" />
              </div>
            </div>

            <div class="pt-2">
              <button type="button" id="btn-submit-restock" class="w-full py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center justify-center gap-2 shadow-sm shadow-emerald-600/20 active:scale-98 transition-all">
                ${Icons.check('w-4 h-4')}
                <span>Confirmer le restock (+${this.quantityToAdd} sur ${selectedProduct.name})</span>
              </button>
            </div>
          ` : `
            <div class="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 flex items-start gap-3.5 text-slate-600 dark:text-slate-300 shadow-xs">
              <div class="w-10 h-10 rounded-2xl bg-orange-500/10 text-orange-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                ${Icons.shield('w-5 h-5')}
              </div>
              <div class="space-y-1">
                <h3 class="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">Accès restreint aux administrateurs</h3>
                <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                  Seuls les délégués administrateurs sont autorisés à réceptionner les arrivages, incrémenter les quantités en stock et ajuster les tarifs ou coûts d'achat.
                </p>
                <div class="pt-1 text-[11px] text-slate-400 font-medium">
                  Vous êtes en mode consultation : vous pouvez parcourir l'état des stocks et consulter l'historique des réceptions.
                </div>
              </div>
            </div>
          `}
        ` : ''}

      </div>
    `;

    // Îlot Historique Droite
    const rightIsland = document.createElement('div');
    rightIsland.className = 'w-80 sm:w-96 flex-shrink-0 h-full flex flex-col rounded-3xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800/80 shadow-md overflow-hidden';

    rightIsland.innerHTML = `
      <div class="px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/80 flex items-center justify-between flex-shrink-0">
        <div class="flex items-center gap-2">
          ${Icons.history('w-4 h-4 text-orange-500')}
          <h2 class="font-bold text-sm text-slate-900 dark:text-white">Dernières réceptions</h2>
        </div>
        <span class="text-xs font-bold text-slate-400 font-mono-nums">${restocks.length} entrées</span>
      </div>

      <div class="flex-1 min-h-0 overflow-y-auto p-4 space-y-2.5 font-mono-nums text-xs">
        ${restocks.length === 0 ? `
          <div class="h-full flex flex-col items-center justify-center text-center text-slate-400 dark:text-slate-500 py-16 space-y-2">
            <div class="w-12 h-12 rounded-2xl bg-orange-500/10 text-orange-500 flex items-center justify-center mb-1">
              ${Icons.package('w-6 h-6')}
            </div>
            <p class="text-xs font-bold text-slate-600 dark:text-slate-300">Aucun restock récent</p>
            <p class="text-[11px] text-slate-400 max-w-[200px]">Les réceptions de commandes fournisseur s'afficheront ici</p>
          </div>
        ` : restocks.slice(0, 15).map(r => `
          <div class="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/70 dark:border-slate-800 space-y-1 hover:border-orange-400 dark:hover:border-slate-700 transition-colors shadow-xs">
            <div class="flex items-center justify-between font-sans font-bold text-slate-900 dark:text-slate-100">
              <span class="truncate">${escapeHtml(r.productName)}</span>
              <span class="text-emerald-600 dark:text-emerald-400 font-mono-nums font-black text-xs">+${r.quantityAdded} u</span>
            </div>
            <div class="flex items-center justify-between text-[11px] text-slate-400">
              <span>Stock : ${r.previousStock} → <strong class="text-slate-700 dark:text-slate-200">${r.newStock} u</strong></span>
              <span>${new Date(r.timestamp).toLocaleDateString('fr-FR')}</span>
            </div>
          </div>
        `).join('')}
      </div>
    `;

    container.appendChild(leftIsland);
    container.appendChild(rightIsland);

    // Écouteurs d'événements SANS détruire le composant
    leftIsland.querySelectorAll('[data-select-prod]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.selectedProductId = (e.currentTarget as HTMLElement).getAttribute('data-select-prod');
        this.successMessage = null;
        this.renderInto(container);
      });
    });

    leftIsland.querySelectorAll('[data-quick-qty]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.quantityToAdd = parseInt((e.currentTarget as HTMLElement).getAttribute('data-quick-qty') || '24', 10);
        this.updateQuantityPreview(leftIsland, selectedProduct);
      });
    });

    const customInput = leftIsland.querySelector('#custom-qty-input') as HTMLInputElement;
    if (customInput) {
      customInput.addEventListener('focus', () => {
        if ([6, 12, 24, 48].includes(this.quantityToAdd)) {
          customInput.value = '';
        }
        this.updateQuantityPreview(leftIsland, selectedProduct, true);
      });

      customInput.addEventListener('input', () => {
        const val = parseInt(customInput.value, 10);
        this.quantityToAdd = isNaN(val) || val <= 0 ? 1 : val;
        this.updateQuantityPreview(leftIsland, selectedProduct, true);
      });
    }

    leftIsland.querySelector('#btn-submit-restock')?.addEventListener('click', () => {
      if (!db.getCurrentVolunteer()?.isAdmin) return;
      if (!selectedProduct) return;
      const newPrice = parseFloat((leftIsland.querySelector('#restock-new-price') as HTMLInputElement)?.value) || undefined;
      const newCost = parseFloat((leftIsland.querySelector('#restock-new-cost') as HTMLInputElement)?.value) || undefined;

      db.applyRestock(selectedProduct.id, this.quantityToAdd, newPrice, newCost);
      this.successMessage = `+${this.quantityToAdd} u ajoutés sur ${selectedProduct.name} !`;
      
      // Mettre à jour l'affichage en local
      this.renderInto(container);
    });
  }

  private updateQuantityPreview(leftIsland: HTMLElement, selectedProduct: Product | undefined, isCustomActive: boolean = false): void {
    if (!selectedProduct) return;

    const isPreset = !isCustomActive && [6, 12, 24, 48].includes(this.quantityToAdd);

    // Mettre à jour l'apparence des boutons prédéfinis
    leftIsland.querySelectorAll('[data-quick-qty]').forEach(btn => {
      const q = parseInt(btn.getAttribute('data-quick-qty') || '0', 10);
      if (isPreset && q === this.quantityToAdd) {
        btn.className = 'py-2.5 rounded-xl text-xs font-bold border transition-all bg-orange-500 text-white border-orange-500 shadow-md shadow-orange-500/25 ring-2 ring-orange-500/30';
      } else {
        btn.className = 'py-2.5 rounded-xl text-xs font-bold border transition-all bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700';
      }
    });

    // Mettre en orange le champ custom dès qu'il est actif ou qu'une quantité personnalisée est entrée
    const customInput = leftIsland.querySelector('#custom-qty-input') as HTMLInputElement;
    if (customInput) {
      if (!isPreset) {
        customInput.className = 'w-full text-center py-2.5 text-xs font-black rounded-xl bg-orange-500 text-white border-orange-500 shadow-md shadow-orange-500/25 ring-2 ring-orange-500/40 focus:outline-none placeholder:text-white/70 font-mono-nums transition-all';
        if (document.activeElement !== customInput) {
          customInput.value = this.quantityToAdd.toString();
        }
      } else {
        customInput.className = 'w-full text-center py-2.5 text-xs font-bold rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white hover:bg-slate-200 dark:hover:bg-slate-700 focus:bg-orange-500 focus:text-white focus:border-orange-500 focus:ring-2 focus:ring-orange-500/40 font-mono-nums transition-all';
        customInput.value = '';
      }
    }

    const qtyIndicator = leftIsland.querySelector('#selected-qty-indicator');
    if (qtyIndicator) {
      qtyIndicator.textContent = `+${this.quantityToAdd} unités sélectionnées`;
    }

    const preview = leftIsland.querySelector('#preview-new-stock');
    if (preview) {
      preview.textContent = `${selectedProduct.stock + this.quantityToAdd} u`;
    }

    const submitBtnSpan = leftIsland.querySelector('#btn-submit-restock span');
    if (submitBtnSpan) {
      submitBtnSpan.textContent = `Confirmer le restock (+${this.quantityToAdd} sur ${selectedProduct.name})`;
    }
  }
}
