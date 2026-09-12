import { db } from '../services/db';
import { CartComponent } from '../components/Cart';
import { ProductCardComponent } from '../components/ProductCard';
import { Icons } from '../components/Icons';

export class DashboardView {
  private searchQuery = '';
  private cart: CartComponent;

  constructor(cart: CartComponent) {
    this.cart = cart;
  }

  public render(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'flex-1 flex gap-3 h-full min-h-0 overflow-hidden';

    const products = db.getProducts().filter(p => p.isActive);
    
    container.innerHTML = `
      <!-- Zone Catalogue Produits (Îlot Gauche 100% Hauteur) -->
      <div class="flex-1 flex flex-col min-w-0 rounded-3xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800/80 shadow-md overflow-hidden h-full">
        
        <!-- Barre d'en-tête & recherche (tous les articles au même endroit) -->
        <div class="px-6 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/80 flex flex-wrap items-center justify-between gap-4 flex-shrink-0">
          
          <div class="flex items-center gap-3">
            <span class="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">Catalogue Caisse</span>
            <span class="px-2.5 py-0.5 rounded-full text-xs font-mono-nums font-bold bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-300" id="products-count-badge">
              ${products.length} articles
            </span>
          </div>

          <!-- Champ recherche avec icône SVG -->
          <div class="relative w-full sm:w-80">
            <input 
              type="text" 
              id="search-products-input" 
              placeholder="Rechercher par nom (coca, bueno, café...)" 
              value="${this.searchQuery}"
              class="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 transition-all font-medium"
            />
            <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              ${Icons.search('w-3.5 h-3.5')}
            </span>
          </div>

        </div>

        <!-- Grille de Produits (défilement interne) -->
        <div class="flex-1 overflow-y-auto p-5" id="products-grid-container">
          <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5" id="products-grid">
            <!-- Les cartes sont injectées ici -->
          </div>
        </div>

      </div>

      <!-- Colonne Panier (Îlot Droite 100% Hauteur) -->
      <div class="w-80 sm:w-96 flex-shrink-0 h-full flex flex-col rounded-3xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800/80 shadow-md overflow-hidden" id="cart-container">
        <!-- Le panier est injecté ici -->
      </div>
    `;

    const searchInput = container.querySelector('#search-products-input') as HTMLInputElement;
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        this.searchQuery = searchInput.value;
        this.renderProductsGrid(container);
      });
    }

    const cartSlot = container.querySelector('#cart-container');
    if (cartSlot) {
      cartSlot.appendChild(this.cart.render());
    }

    this.renderProductsGrid(container);
    return container;
  }

  private renderProductsGrid(parent: HTMLElement): void {
    const grid = parent.querySelector('#products-grid');
    if (!grid) return;

    grid.innerHTML = '';
    const products = db.getProducts().filter(p => p.isActive);
    
    const filtered = products.filter(p => {
      return p.name.toLowerCase().includes(this.searchQuery.toLowerCase());
    });

    const countBadge = parent.querySelector('#products-count-badge');
    if (countBadge) {
      countBadge.textContent = `${filtered.length} article${filtered.length > 1 ? 's' : ''}`;
    }

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div class="col-span-full py-16 flex flex-col items-center justify-center gap-3 text-center">
          <div class="w-12 h-12 rounded-2xl bg-orange-500/10 text-orange-500 flex items-center justify-center">
            ${Icons.package('w-6 h-6')}
          </div>
          <div class="text-sm font-extrabold text-slate-700 dark:text-slate-300">
            ${this.searchQuery ? `Aucun produit trouvé pour "${this.searchQuery}"` : 'Le catalogue est actuellement vide'}
          </div>
          <p class="text-xs text-slate-400 max-w-sm">
            ${this.searchQuery ? 'Vérifiez l\'orthographe de votre recherche.' : 'Rendez-vous dans l\'onglet "Catalogue & Tarifs" pour ajouter vos boissons, snacks et friandises.'}
          </p>
        </div>
      `;
      return;
    }

    filtered.forEach(prod => {
      const cartQty = this.cart.getItemQuantity(prod.id);
      const card = ProductCardComponent.render(
        prod,
        cartQty,
        (p) => {
          this.cart.addItem(p, 1);
          this.refreshAll(parent);
        },
        (p) => {
          this.cart.removeItem(p.id, 1);
          this.refreshAll(parent);
        }
      );
      grid.appendChild(card);
    });
  }

  private refreshAll(parent: HTMLElement): void {
    const cartSlot = parent.querySelector('#cart-container');
    if (cartSlot) {
      cartSlot.innerHTML = '';
      cartSlot.appendChild(this.cart.render());
    }
    this.renderProductsGrid(parent);
  }
}
