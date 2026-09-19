import { Product } from '../types';
import { Icons } from './Icons';
import { escapeHtml } from '../utils/security';

export class ProductCardComponent {
  public static render(
    product: Product,
    cartQuantity: number,
    onAdd: (product: Product) => void,
    onRemove: (product: Product) => void
  ): HTMLElement {
    const card = document.createElement('div');
    const isOutOfStock = product.stock <= 0;
    const isLowStock = product.stock > 0 && product.stock <= product.minStockAlert;
    const safeName = escapeHtml(product.name);
    const safeCategory = escapeHtml(product.category);
    const safeImageUrl = escapeHtml(product.imageUrl);

    card.className = `group relative flex flex-col justify-between rounded-2xl bg-white dark:bg-slate-900 border transition-all duration-200 overflow-hidden shadow-xs hover:shadow-md select-none ${
      isOutOfStock
        ? 'border-slate-200 dark:border-slate-800 opacity-40 grayscale pointer-events-none'
        : cartQuantity > 0
        ? 'border-orange-500 ring-2 ring-orange-500/30 shadow-md shadow-orange-500/10 cursor-pointer active:scale-[0.98]'
        : 'border-slate-200 dark:border-slate-800 hover:border-orange-300 dark:hover:border-slate-700 hover:-translate-y-0.5 cursor-pointer active:scale-[0.98]'
    }`;

    // Helper de catégorie pour badge couleur
    let catBadgeColor = 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300';
    if (product.category === 'boissons') catBadgeColor = 'bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 border-sky-200 dark:border-sky-800/50';
    else if (product.category === 'snacks') catBadgeColor = 'bg-orange-50 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300 border-orange-200 dark:border-orange-800/50';
    else if (product.category === 'bonbons') catBadgeColor = 'bg-pink-50 text-pink-700 dark:bg-pink-950/60 dark:text-pink-300 border-pink-200 dark:border-pink-800/50';
    else if (product.category === 'chaud') catBadgeColor = 'bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800/50';

    card.innerHTML = `
      <!-- Partie Supérieure : Image et infos avec peps -->
      <div class="p-3.5 flex flex-col gap-3">
        
        <!-- Image Produit bien arrondie -->
        <div class="w-full aspect-[4/3] rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 relative flex items-center justify-center border border-slate-200/60 dark:border-slate-700/50">
          <img 
            src="${safeImageUrl}" 
            alt="${safeName}" 
            loading="lazy" 
            class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 ${!product.imageUrl ? 'hidden' : ''}"
            onerror="this.style.display='none'; this.nextElementSibling.classList.remove('hidden'); this.nextElementSibling.classList.add('flex');"
          />
          <div class="${product.imageUrl ? 'hidden' : 'flex'} w-full h-full flex-col items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-400 p-2 text-center gap-1.5">
            ${Icons.package('w-7 h-7 text-slate-400/60 dark:text-slate-500/60')}
            <span class="font-bold text-[11px] leading-tight text-slate-500 dark:text-slate-400 line-clamp-2">${safeName}</span>
          </div>

          <!-- Pastille de stock arrondie et colorée -->
          <div class="absolute top-2 left-2 px-2.5 py-0.5 rounded-full text-[11px] font-mono-nums font-bold backdrop-blur-md shadow-xs ${
            isOutOfStock
              ? 'bg-rose-500 text-white'
              : isLowStock
              ? 'bg-amber-500 text-slate-950'
              : 'bg-emerald-500/90 text-white'
          }">
            ${isOutOfStock ? 'Épuisé' : `${product.stock} dispo`}
          </div>
        </div>

        <!-- Libellé, catégorie & Prix -->
        <div>
          <div class="flex items-center justify-between gap-1 mb-1">
            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full border ${catBadgeColor} uppercase tracking-wider">
              ${safeCategory}
            </span>
          </div>
          <h3 class="font-bold text-sm text-slate-900 dark:text-white truncate leading-snug" title="${safeName}">
            ${safeName}
          </h3>
          <div class="flex items-baseline justify-between mt-1.5">
            <span class="font-mono-nums font-extrabold text-base text-orange-600 dark:text-orange-400">
              ${product.price.toFixed(2)} €
            </span>
            ${cartQuantity > 0 ? `
              <span class="text-[11px] font-bold text-slate-400">
                Total: ${(product.price * cartQuantity).toFixed(2)} €
              </span>
            ` : ''}
          </div>
        </div>
      </div>

      <!-- Contrôles Caisse conviviaux : [-] [Qté] [+] -->
      <div class="p-3 pt-0">
        <div class="flex items-center rounded-xl bg-slate-100 dark:bg-slate-800 p-1 border border-slate-200 dark:border-slate-700/80 shadow-inner">
          <button 
            data-action="card-minus" 
            class="flex-1 py-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 active:scale-90 text-slate-700 dark:text-slate-200 flex items-center justify-center transition-all disabled:opacity-20 disabled:pointer-events-none font-bold"
            ${cartQuantity === 0 || isOutOfStock ? 'disabled' : ''}
            title="Retirer"
          >
            ${Icons.minus('w-4 h-4')}
          </button>

          <div class="min-w-[40px] text-center">
            <span class="font-mono-nums font-black text-sm ${cartQuantity > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-slate-400'}">
              ${cartQuantity}
            </span>
          </div>

          <button 
            data-action="card-plus" 
            class="flex-1 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 active:scale-90 text-white flex items-center justify-center transition-all shadow-xs shadow-orange-500/20 disabled:opacity-30 disabled:pointer-events-none font-bold"
            ${isOutOfStock || cartQuantity >= product.stock ? 'disabled' : ''}
            title="Ajouter"
          >
            ${Icons.plus('w-4 h-4')}
          </button>
        </div>
      </div>
    `;

    // Clic sur toute la carte pour ajouter 1 automatiquement avec animation
    card.addEventListener('click', () => {
      if (isOutOfStock || cartQuantity >= product.stock) return;

      card.animate([
        { transform: 'scale(1)' },
        { transform: 'scale(0.95)' },
        { transform: 'scale(1.02)' },
        { transform: 'scale(1)' }
      ], {
        duration: 220,
        easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)'
      });

      onAdd(product);
    });

    card.querySelector('[data-action="card-minus"]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      onRemove(product);
    });

    card.querySelector('[data-action="card-plus"]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      onAdd(product);
    });

    return card;
  }
}
