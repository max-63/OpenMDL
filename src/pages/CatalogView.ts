import { Product } from '../types';
import { db } from '../services/db';
import { Icons } from '../components/Icons';
import { escapeHtml } from '../utils/security';

export class CatalogView {
  private onUpdate: () => void;
  private catalogSearchQuery = '';

  constructor(onUpdate: () => void) {
    this.onUpdate = onUpdate;
  }

  public render(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'flex-1 flex flex-col min-w-0 rounded-3xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800/80 shadow-md overflow-hidden h-full';

    this.renderInto(container);
    return container;
  }

  private renderInto(container: HTMLElement): void {
    container.innerHTML = '';
    const products = db.getProducts();

    // Calculs de synthèse catalogue
    const totalRef = products.length;
    const totalStock = products.reduce((acc, p) => acc + p.stock, 0);
    const totalRetailValue = products.reduce((acc, p) => acc + (p.stock * p.price), 0);
    const totalCostValue = products.reduce((acc, p) => acc + (p.stock * p.costPrice), 0);
    const avgMarginPct = totalCostValue > 0 ? Math.round(((totalRetailValue - totalCostValue) / totalCostValue) * 100) : 0;
    const lowStockCount = products.filter(p => p.stock <= p.minStockAlert).length;

    const filtered = products.filter(p => 
      p.name.toLowerCase().includes(this.catalogSearchQuery.toLowerCase()) ||
      p.category.toLowerCase().includes(this.catalogSearchQuery.toLowerCase())
    );

    const isAdmin = db.getCurrentVolunteer()?.isAdmin === true;

    // 1. En-tête principal de l'îlot
    const header = document.createElement('div');
    header.className = 'px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/80 flex flex-wrap items-center justify-between gap-4 flex-shrink-0';
    header.innerHTML = `
      <div>
        <div class="flex items-center gap-2.5">
          ${Icons.tag('w-5 h-5 text-orange-500')}
          <h1 class="text-base font-black tracking-tight text-slate-900 dark:text-white">Catalogue & Tarifs</h1>
        </div>
        <p class="text-xs font-medium text-slate-500">Tarifs de vente, coûts d'achat fournisseurs, stocks et marges du foyer</p>
      </div>

      <div class="flex items-center gap-3">
        <!-- Recherche rapide d'article dans le catalogue -->
        <div class="relative w-56 sm:w-64">
          <input 
            type="text" 
            id="catalog-search-input" 
            placeholder="Filtrer un article..." 
            value="${escapeHtml(this.catalogSearchQuery)}"
            class="w-full pl-8 pr-3 py-2 text-xs rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 transition-all font-medium"
          />
          <span class="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400">
            ${Icons.search('w-3.5 h-3.5')}
          </span>
        </div>

        ${isAdmin ? `
          <button id="btn-add-product" class="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs flex items-center gap-2 shadow-sm shadow-orange-500/20 active:scale-95 transition-all">
            ${Icons.plus('w-4 h-4')}
            <span>Nouveau produit</span>
          </button>
        ` : `
          <div class="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold text-xs flex items-center gap-2 border border-slate-200 dark:border-slate-700">
            ${Icons.shield('w-3.5 h-3.5 text-slate-400')}
            <span>Mode consultation</span>
          </div>
        `}
      </div>
    `;
    container.appendChild(header);

    // 2. Zone défilable interne
    const content = document.createElement('div');
    content.className = 'flex-1 min-h-0 overflow-y-auto p-6 space-y-4';

    content.innerHTML = `
      <!-- Synthèse rapide en îlots arrondis (KPIs) -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono-nums">
        
        <div class="p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <span class="text-[10px] font-sans font-bold text-slate-400 uppercase tracking-wider block">Références actives</span>
            <span class="text-base font-black text-slate-900 dark:text-white">${totalRef} articles</span>
          </div>
          <div class="p-2 rounded-xl bg-slate-200/60 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
            ${Icons.tag('w-4 h-4')}
          </div>
        </div>

        <div class="p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <span class="text-[10px] font-sans font-bold text-slate-400 uppercase tracking-wider block">Stock global</span>
            <span class="text-base font-black text-slate-900 dark:text-white">${totalStock} u</span>
          </div>
          <div class="p-2 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
            ${Icons.package('w-4 h-4')}
          </div>
        </div>

        <div class="p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <span class="text-[10px] font-sans font-bold text-slate-400 uppercase tracking-wider block">Valeur marchande</span>
            <span class="text-base font-black text-slate-900 dark:text-white">${totalRetailValue.toFixed(2)} €</span>
          </div>
          <div class="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            ${Icons.banknote('w-4 h-4')}
          </div>
        </div>

        <div class="p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <span class="text-[10px] font-sans font-bold text-slate-400 uppercase tracking-wider block">Marge brute moy.</span>
            <span class="text-base font-black text-emerald-600 dark:text-emerald-400">+${avgMarginPct}%</span>
          </div>
          <div class="p-2 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400">
            ${Icons.trendingUp('w-4 h-4')}
          </div>
        </div>

      </div>

      <!-- Liste de cartes arrondies modernes ("assume ses arrondis") -->
      <div class="space-y-2.5" id="catalog-cards-list">
        ${filtered.length === 0 ? `
          <div class="py-16 text-center flex flex-col items-center justify-center gap-3 text-slate-400">
            <div class="w-12 h-12 rounded-2xl bg-orange-500/10 text-orange-500 flex items-center justify-center">
              ${Icons.package('w-6 h-6')}
            </div>
            <div class="text-sm font-extrabold text-slate-700 dark:text-slate-300">
              ${this.catalogSearchQuery ? `Aucun article ne correspond à "${escapeHtml(this.catalogSearchQuery)}"` : 'Votre catalogue est actuellement vide'}
            </div>
            <p class="text-xs text-slate-400 max-w-sm">
              ${this.catalogSearchQuery ? 'Essayez un autre mot-clé ou réinitialisez les filtres.' : 'Cliquez sur le bouton "Ajouter un article" ci-dessus pour enregistrer vos boissons, snacks et friandises.'}
            </p>
          </div>
        ` : filtered.map(p => {
          const margin = p.price - p.costPrice;
          const marginPct = p.costPrice > 0 ? Math.round((margin / p.costPrice) * 100) : 100;
          const isOutOfStock = p.stock <= 0;
          const isLowStock = p.stock > 0 && p.stock <= p.minStockAlert;

          let catBadge = 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700';
          if (p.category === 'boissons') catBadge = 'bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 border-sky-200 dark:border-sky-800/40';
          else if (p.category === 'snacks') catBadge = 'bg-orange-50 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300 border-orange-200 dark:border-orange-800/40';
          else if (p.category === 'bonbons') catBadge = 'bg-pink-50 text-pink-700 dark:bg-pink-950/60 dark:text-pink-300 border-pink-200 dark:border-pink-800/40';
          else if (p.category === 'chaud') catBadge = 'bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800/40';

          return `
            <div class="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:border-orange-500/50 hover:bg-slate-50 dark:hover:bg-slate-800/80 shadow-xs transition-all flex flex-col md:flex-row md:items-center justify-between gap-4">
              
              <!-- Identité de l'article -->
              <div class="flex items-center gap-3.5 min-w-[240px]">
                <div class="w-12 h-12 rounded-2xl bg-white dark:bg-slate-800 overflow-hidden flex-shrink-0 shadow-xs border border-slate-200/70 dark:border-slate-700/70">
                  <img src="${escapeHtml(p.imageUrl)}" alt="${escapeHtml(p.name)}" class="w-full h-full object-cover" onerror="this.style.display='none'" />
                </div>
                <div class="min-w-0">
                  <div class="flex items-center gap-2">
                    <h3 class="font-extrabold text-sm text-slate-900 dark:text-white truncate">${escapeHtml(p.name)}</h3>
                    <span class="text-[9px] font-bold px-2 py-0.5 rounded-full border ${catBadge} uppercase tracking-wider">
                      ${escapeHtml(p.category)}
                    </span>
                  </div>
                  <div class="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400">
                    <span>Alerte stock : ${p.minStockAlert} u</span>
                    <span>•</span>
                    <span class="font-mono-nums">Réf: ${escapeHtml(p.id)}</span>
                  </div>
                </div>
              </div>

              <!-- Colonnes de données financières & stock -->
              <div class="grid grid-cols-4 gap-4 sm:gap-6 flex-1 max-w-xl font-mono-nums">
                
                <div>
                  <span class="text-[10px] font-sans font-bold uppercase text-slate-400 block mb-0.5">Prix Vente</span>
                  <span class="font-black text-sm text-slate-900 dark:text-white">${p.price.toFixed(2)} €</span>
                </div>

                <div>
                  <span class="text-[10px] font-sans font-bold uppercase text-slate-400 block mb-0.5">Coût Achat</span>
                  <span class="font-medium text-xs text-slate-500 dark:text-slate-400">${p.costPrice.toFixed(2)} €</span>
                </div>

                <div>
                  <span class="text-[10px] font-sans font-bold uppercase text-slate-400 block mb-0.5">Marge Nette</span>
                  <div class="font-bold text-xs text-emerald-600 dark:text-emerald-400">
                    +${margin.toFixed(2)} € <span class="text-[10px] opacity-75">(${marginPct}%)</span>
                  </div>
                </div>

                <div>
                  <span class="text-[10px] font-sans font-bold uppercase text-slate-400 block mb-0.5">Stock Actuel</span>
                  <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-black ${
                    isOutOfStock
                      ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                      : isLowStock
                        ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                        : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                  }">
                    ${p.stock} u
                  </span>
                </div>

              </div>

              <!-- Bouton Modifier arrondi (Admin uniquement) -->
              <div class="flex-shrink-0 flex items-center justify-end">
                ${isAdmin ? `
                  <button 
                    data-edit-id="${p.id}" 
                    class="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-orange-500 hover:bg-orange-500 hover:text-white text-slate-700 dark:text-slate-200 font-sans font-bold text-xs transition-all shadow-xs flex items-center gap-1.5 active:scale-95"
                  >
                    ${Icons.edit('w-3.5 h-3.5')}
                    <span>Modifier</span>
                  </button>
                ` : `
                  <span class="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/60 text-slate-400 dark:text-slate-500 text-xs font-semibold border border-slate-200/60 dark:border-slate-800 flex items-center gap-1.5">
                    ${Icons.lock('w-3.5 h-3.5')}
                    <span>Tarif fixe</span>
                  </span>
                `}
              </div>

            </div>
          `;
        }).join('')}
      </div>
    `;

    container.appendChild(content);

    // Écouteur recherche
    const searchInput = container.querySelector('#catalog-search-input') as HTMLInputElement;
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        this.catalogSearchQuery = searchInput.value;
        this.renderInto(container);
        const nextInput = container.querySelector('#catalog-search-input') as HTMLInputElement;
        if (nextInput) {
          nextInput.focus();
          nextInput.setSelectionRange(nextInput.value.length, nextInput.value.length);
        }
      });
    }

    container.querySelector('#btn-add-product')?.addEventListener('click', () => {
      this.showProductModal(null, container);
    });

    container.querySelectorAll('[data-edit-id]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = (e.currentTarget as HTMLElement).getAttribute('data-edit-id');
        if (id) {
          const prod = db.getProductById(id);
          if (prod) this.showProductModal(prod, container);
        }
      });
    });
  }

  private showProductModal(product: Product | null, container: HTMLElement): void {
    if (!db.getCurrentVolunteer()?.isAdmin) return;
    const isEdit = !!product;
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-enter';

    modal.innerHTML = `
      <div class="relative w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden text-slate-900 dark:text-slate-100">
        
        <!-- En-tête de la modale sans rupture de couleur -->
        <div class="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-800/50">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-2xl bg-orange-500/10 text-orange-500 flex items-center justify-center text-sm font-bold">
              ${isEdit ? Icons.edit('w-4 h-4') : Icons.sparkles('w-4 h-4')}
            </div>
            <div>
              <h2 class="text-sm font-extrabold text-slate-900 dark:text-white">
                ${isEdit ? 'Modifier le produit' : 'Nouveau produit au foyer'}
              </h2>
              <p class="text-[11px] text-slate-400 font-medium">
                ${isEdit ? 'Ajuster les tarifs, stocks et visuel' : 'Ajouter une nouvelle référence à la carte'}
              </p>
            </div>
          </div>

          <button id="modal-close-x" class="p-2 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <form id="product-form" class="p-6 space-y-4 text-xs">
          <div>
            <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Nom de l'article</label>
            <input type="text" id="prod-name" required value="${product ? escapeHtml(product.name) : ''}" class="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 font-medium transition-all" placeholder="Ex: Ice Tea Pêche 33cl" />
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Catégorie</label>
              <select id="prod-cat" class="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 font-medium transition-all">
                <option value="boissons" ${product?.category === 'boissons' ? 'selected' : ''}>Boissons</option>
                <option value="snacks" ${product?.category === 'snacks' ? 'selected' : ''}>Snacks</option>
                <option value="bonbons" ${product?.category === 'bonbons' ? 'selected' : ''}>Bonbons</option>
                <option value="chaud" ${product?.category === 'chaud' ? 'selected' : ''}>Chaud</option>
                <option value="autre" ${product?.category === 'autre' ? 'selected' : ''}>Autre</option>
              </select>
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Stock actuel</label>
              <input type="number" id="prod-stock" min="0" required value="${product ? product.stock : 24}" class="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono-nums font-bold focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 transition-all" />
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Prix de Vente (€)</label>
              <input type="number" step="0.05" id="prod-price" min="0.10" required value="${product ? product.price.toFixed(2) : '1.00'}" class="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono-nums font-black text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 transition-all" />
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Coût d'Achat Fournisseur (€)</label>
              <input type="number" step="0.05" id="prod-cost" min="0.00" required value="${product ? product.costPrice.toFixed(2) : '0.50'}" class="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono-nums font-medium focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 transition-all" />
            </div>
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Photo du Produit</label>
            <input type="file" id="prod-file-input" accept="image/png, image/jpeg, image/webp, image/svg+xml" class="hidden" />
            
            <div id="image-upload-zone" class="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-orange-500 dark:hover:border-orange-500 rounded-2xl p-4 transition-all cursor-pointer bg-slate-50 dark:bg-slate-800/50 flex flex-col items-center justify-center gap-2.5 group">
              <!-- Aperçu de la photo -->
              <div id="image-preview-wrapper" class="${product?.imageUrl ? '' : 'hidden'} relative w-24 h-24 rounded-2xl overflow-hidden shadow-xs border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
                <img id="image-preview-img" src="${product?.imageUrl || ''}" alt="Aperçu" class="w-full h-full object-cover" />
                <button type="button" id="btn-remove-photo" title="Supprimer la photo" class="absolute top-1 right-1 bg-rose-600 hover:bg-rose-700 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-black shadow-xs transition-transform hover:scale-110">
                  ✕
                </button>
              </div>

              <!-- Zone de drop quand pas d'image -->
              <div id="image-empty-placeholder" class="${product?.imageUrl ? 'hidden' : 'flex'} flex-col items-center gap-1.5 text-center py-2">
                <div class="w-10 h-10 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                  ${Icons.image('w-5 h-5')}
                </div>
                <div class="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Choisir une photo sur votre PC
                </div>
                <div class="text-[10px] text-slate-400 font-medium">
                  PNG, JPG, WebP (glisser-déposer accepté)
                </div>
              </div>

              <div id="image-change-hint" class="${product?.imageUrl ? 'block' : 'hidden'} text-[11px] text-orange-600 dark:text-orange-400 font-bold group-hover:underline">
                Changer de photo...
              </div>
            </div>
          </div>

          <div class="pt-3 flex items-center justify-end gap-2.5 border-t border-slate-200 dark:border-slate-800">
            <button type="button" id="modal-cancel" class="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold transition-all">
              Annuler
            </button>
            <button type="submit" class="px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-black shadow-sm shadow-orange-500/20 active:scale-98 transition-all">
              ${isEdit ? 'Enregistrer' : 'Ajouter'}
            </button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modal);

    let currentImageUrl = product ? product.imageUrl : '';

    const closeModal = () => {
      if (modal.parentNode) modal.parentNode.removeChild(modal);
    };

    modal.querySelector('#modal-close-x')?.addEventListener('click', closeModal);
    modal.querySelector('#modal-cancel')?.addEventListener('click', closeModal);

    const uploadZone = modal.querySelector('#image-upload-zone') as HTMLElement;
    const fileInput = modal.querySelector('#prod-file-input') as HTMLInputElement;
    const previewWrapper = modal.querySelector('#image-preview-wrapper') as HTMLElement;
    const previewImg = modal.querySelector('#image-preview-img') as HTMLImageElement;
    const emptyPlaceholder = modal.querySelector('#image-empty-placeholder') as HTMLElement;
    const changeHint = modal.querySelector('#image-change-hint') as HTMLElement;
    const btnRemove = modal.querySelector('#btn-remove-photo') as HTMLElement;

    const handleFile = async (file: File) => {
      if (!file.type.startsWith('image/')) return;
      const optimized = await this.processImageFile(file);
      currentImageUrl = optimized;
      previewImg.src = optimized;
      previewWrapper.classList.remove('hidden');
      emptyPlaceholder.classList.add('hidden');
      changeHint.classList.remove('hidden');
    };

    uploadZone.addEventListener('click', (e) => {
      if (e.target === btnRemove || btnRemove.contains(e.target as Node)) return;
      fileInput.click();
    });

    fileInput.addEventListener('change', () => {
      if (fileInput.files && fileInput.files[0]) {
        handleFile(fileInput.files[0]);
      }
    });

    uploadZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      uploadZone.classList.add('border-orange-500', 'bg-orange-50/20');
    });

    uploadZone.addEventListener('dragleave', () => {
      uploadZone.classList.remove('border-orange-500', 'bg-orange-50/20');
    });

    uploadZone.addEventListener('drop', (e) => {
      e.preventDefault();
      uploadZone.classList.remove('border-orange-500', 'bg-orange-50/20');
      if (e.dataTransfer?.files && e.dataTransfer.files[0]) {
        handleFile(e.dataTransfer.files[0]);
      }
    });

    btnRemove?.addEventListener('click', (e) => {
      e.stopPropagation();
      currentImageUrl = '';
      previewImg.src = '';
      fileInput.value = '';
      previewWrapper.classList.add('hidden');
      emptyPlaceholder.classList.remove('hidden');
      changeHint.classList.add('hidden');
    });

    modal.querySelector('#product-form')?.addEventListener('submit', (e) => {
      e.preventDefault();

      const name = (modal.querySelector('#prod-name') as HTMLInputElement).value;
      const category = (modal.querySelector('#prod-cat') as HTMLSelectElement).value as any;
      const stock = parseInt((modal.querySelector('#prod-stock') as HTMLInputElement).value, 10);
      const price = parseFloat((modal.querySelector('#prod-price') as HTMLInputElement).value);
      const costPrice = parseFloat((modal.querySelector('#prod-cost') as HTMLInputElement).value);
      const imageUrl = currentImageUrl;

      if (isEdit && product) {
        db.updateProduct({
          ...product,
          name,
          category,
          stock,
          price,
          costPrice,
          imageUrl
        });
      } else {
        db.addProduct({
          name,
          category,
          stock,
          price,
          costPrice,
          minStockAlert: 8,
          imageUrl,
          isActive: true
        });
      }

      closeModal();
      this.renderInto(container);
      this.onUpdate();
    });
  }

  private processImageFile(file: File, maxWidth = 360, maxHeight = 360): Promise<string> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          if (width > height) {
            if (width > maxWidth) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve((e.target?.result as string) || '');
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/webp', 0.85));
        };
        img.onerror = () => resolve((e.target?.result as string) || '');
        img.src = e.target?.result as string;
      };
      reader.onerror = () => resolve('');
      reader.readAsDataURL(file);
    });
  }
}
