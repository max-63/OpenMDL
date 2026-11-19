import { db } from '../services/db';
import { CartComponent } from '../components/Cart';
import { ProductCardComponent } from '../components/ProductCard';
import { Icons } from '../components/Icons';
import { escapeHtml } from '../utils/security';
import { AppDialog } from '../components/AppDialog';

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

          <!-- Conso bénévole en cours de séance + Champ recherche -->
          <div class="flex flex-wrap items-center gap-2.5 w-full sm:w-auto justify-end">
            <div id="dashboard-perk-slot" class="flex items-center"></div>

            <div class="relative w-full sm:w-72 md:w-80">
              <input 
                type="text" 
                id="search-products-input" 
                placeholder="Rechercher par nom (coca, bueno, café...)" 
                value="${escapeHtml(this.searchQuery)}"
                class="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 transition-all font-medium"
              />
              <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                ${Icons.search('w-3.5 h-3.5')}
              </span>
            </div>
          </div>

        </div>

        <!-- Grille de Produits (défilement interne) -->
        <div class="flex-1 overflow-y-auto p-5 space-y-4" id="products-grid-container">
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

    this.renderPerkSlot(container);
    this.renderProductsGrid(container);
    return container;
  }

  private renderPerkSlot(parent: HTMLElement): void {
    const slot = parent.querySelector('#dashboard-perk-slot') as HTMLElement | null;
    if (!slot) return;

    const volunteer = db.getCurrentVolunteer();
    if (!volunteer) {
      slot.innerHTML = '';
      return;
    }

    const activeSession = db.getActiveSession();
    const perkCheck = db.canClaimVolunteerPerk(volunteer.id, activeSession?.id);

    if (!perkCheck.enabled || perkCheck.policyMode === 'none') {
      slot.innerHTML = '';
      return;
    }

    if (perkCheck.allowed) {
      const label = perkCheck.maxPerSession > 1
        ? `Conso offerte (${perkCheck.remainingInSession}/${perkCheck.maxPerSession})`
        : 'Prendre ma conso';
      slot.innerHTML = `
        <button
          type="button"
          id="btn-claim-session-perk"
          class="px-3 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95 whitespace-nowrap"
          title="${escapeHtml(perkCheck.claimedInSession > 0 ? `${perkCheck.claimedInSession} déjà prise(s) sur ${perkCheck.maxPerSession} cette séance` : 'Choisir et prendre votre conso offerte pendant la séance')}"
        >
          ${Icons.gift('w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400')}
          <span>${escapeHtml(label)}</span>
        </button>
      `;
      slot.querySelector('#btn-claim-session-perk')?.addEventListener('click', () => {
        this.openSessionPerkModal(parent, perkCheck);
      });
      return;
    }

    if (perkCheck.sessionsUntilEligible > 0) {
      slot.innerHTML = `
        <span
          class="px-2.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 text-[11px] font-bold flex items-center gap-1.5 whitespace-nowrap"
          title="${escapeHtml(perkCheck.reason || '')}"
        >
          ${Icons.gift('w-3.5 h-3.5 text-slate-400')}
          <span>Conso dans ${perkCheck.sessionsUntilEligible} séance${perkCheck.sessionsUntilEligible > 1 ? 's' : ''}</span>
        </span>
      `;
      return;
    }

    if (perkCheck.claimedInSession > 0 && perkCheck.remainingInSession === 0) {
      slot.innerHTML = `
        <span
          class="px-2.5 py-2 rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 text-[11px] font-bold flex items-center gap-1.5 whitespace-nowrap"
          title="${escapeHtml(perkCheck.reason || 'Conso déjà prise sur cette séance')}"
        >
          ${Icons.check('w-3.5 h-3.5 text-emerald-500')}
          <span>Conso prise (${perkCheck.claimedInSession}/${perkCheck.maxPerSession})</span>
        </span>
      `;
      return;
    }

    slot.innerHTML = `
      <span
        class="px-2.5 py-2 rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 text-[11px] font-bold flex items-center gap-1.5 font-mono-nums whitespace-nowrap"
        title="${escapeHtml(perkCheck.reason || 'Objectif en cours pour débloquer la conso')}"
      >
        ${Icons.gift('w-3.5 h-3.5 text-amber-500')}
        <span>Conso : ${perkCheck.current}/${perkCheck.required}</span>
      </span>
    `;
  }

  private openSessionPerkModal(
    parent: HTMLElement,
    perkCheck: ReturnType<typeof db.canClaimVolunteerPerk>
  ): void {
    const volunteer = db.getCurrentVolunteer();
    if (!volunteer) return;

    const allInStock = db.getProducts().filter(p => p.isActive && p.stock > 0);
    const consumables = allInStock.filter(p =>
      p.category === 'boissons' || p.category === 'snacks' || p.category === 'chaud' || p.category === 'bonbons'
    );
    const availableProducts = consumables.length > 0 ? consumables : allInStock;

    if (availableProducts.length === 0) {
      AppDialog.alert({
        title: 'Stock insuffisant',
        message: 'Aucun article en stock n’est disponible pour la conso offerte.',
        type: 'warning'
      });
      return;
    }

    const activeSession = db.getActiveSession();
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-enter';

    modal.innerHTML = `
      <div class="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
        <div class="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/60 flex items-center justify-between gap-3">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 flex items-center justify-center">
              ${Icons.gift('w-5 h-5')}
            </div>
            <div>
              <h3 class="text-base font-black text-slate-900 dark:text-white">Prendre une conso offerte</h3>
              <p class="text-xs text-slate-500 dark:text-slate-400">
                ${escapeHtml(volunteer.name)} • ${perkCheck.remainingInSession} restante${perkCheck.remainingInSession > 1 ? 's' : ''} sur ${perkCheck.maxPerSession} pour cette séance
              </p>
            </div>
          </div>
          <button type="button" id="perk-modal-close-x" class="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div class="p-5 overflow-y-auto flex-1">
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
            ${availableProducts.map(p => `
              <button
                type="button"
                data-pick-perk-id="${escapeHtml(p.id)}"
                class="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/60 hover:border-emerald-500 hover:bg-emerald-500/10 text-left flex items-center gap-3 transition-all cursor-pointer group active:scale-[0.98]"
              >
                <div class="w-11 h-11 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-700 overflow-hidden flex-shrink-0">
                  <img src="${escapeHtml(p.imageUrl)}" alt="${escapeHtml(p.name)}" class="w-full h-full object-cover" onerror="this.style.display='none'" />
                </div>
                <div class="min-w-0 flex-1">
                  <div class="text-xs font-extrabold text-slate-900 dark:text-white truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                    ${escapeHtml(p.name)}
                  </div>
                  <div class="flex items-center gap-1.5 mt-0.5 text-[11px] font-mono-nums">
                    <span class="line-through text-slate-400">${p.price.toFixed(2)} €</span>
                    <span class="px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-black text-[10px]">OFFERT</span>
                  </div>
                  <div class="text-[10px] text-slate-400 mt-0.5 font-mono-nums">${p.stock} u dispo</div>
                </div>
              </button>
            `).join('')}
          </div>
        </div>

        <div class="px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/80 flex items-center justify-end">
          <button type="button" id="perk-modal-cancel" class="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
            Annuler
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const closeModal = () => {
      if (modal.parentNode) modal.parentNode.removeChild(modal);
    };

    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
    modal.querySelector('#perk-modal-close-x')?.addEventListener('click', closeModal);
    modal.querySelector('#perk-modal-cancel')?.addEventListener('click', closeModal);

    modal.querySelectorAll('[data-pick-perk-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        const productId = (btn as HTMLElement).getAttribute('data-pick-perk-id');
        if (!productId) return;
        const res = db.claimVolunteerPerk(volunteer.id, productId, activeSession?.id);
        closeModal();
        this.refreshAll(parent);
        AppDialog.alert({
          title: res.success ? 'Conso offerte enregistrée' : 'Attribution impossible',
          message: res.message,
          type: res.success ? 'success' : 'error'
        });
      });
    });
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
            ${this.searchQuery ? `Aucun produit trouvé pour "${escapeHtml(this.searchQuery)}"` : 'Le catalogue est actuellement vide'}
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
    this.renderPerkSlot(parent);
    this.renderProductsGrid(parent);
  }
}
