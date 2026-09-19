import { Icons } from './Icons';
import { escapeHtml } from '../utils/security';

export interface AlertOptions {
  title?: string;
  message: string;
  type?: 'success' | 'info' | 'warning' | 'error';
  confirmText?: string;
  details?: Array<{ label: string; value: string }>;
  onClose?: () => void;
}

export interface ConfirmOptions {
  title?: string;
  message: string;
  type?: 'danger' | 'warning' | 'info';
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
}

export class AppDialog {
  /**
   * Modale d'alerte stylisée "maison" (remplace nativement alert())
   */
  public static alert(options: AlertOptions | string): Promise<void> {
    return new Promise((resolve) => {
      const opts: AlertOptions = typeof options === 'string' 
        ? { message: options } 
        : options;

      const title = opts.title || (opts.type === 'error' ? 'Erreur' : opts.type === 'success' ? 'Succès' : 'Information');
      const type = opts.type || 'info';
      const confirmText = opts.confirmText || 'Compris';

      const overlay = document.createElement('div');
      overlay.className = 'fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-enter';

      let iconHtml = `
        <svg xmlns="http://www.w3.org/2000/svg" class="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>
        </svg>`;
      let iconColorClasses = 'bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/20';
      let btnColorClasses = 'bg-sky-600 hover:bg-sky-700 text-white';

      if (type === 'success') {
        iconHtml = Icons.checkCircle('w-7 h-7');
        iconColorClasses = 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20';
        btnColorClasses = 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20';
      } else if (type === 'warning') {
        iconHtml = Icons.alertTriangle('w-7 h-7');
        iconColorClasses = 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20';
        btnColorClasses = 'bg-amber-600 hover:bg-amber-700 text-white shadow-md shadow-amber-600/20';
      } else if (type === 'error') {
        iconHtml = Icons.xCircle('w-7 h-7');
        iconColorClasses = 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/20';
        btnColorClasses = 'bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/20';
      }

      // Rendu des détails éventuels (clé: valeur)
      let detailsHtml = '';
      if (opts.details && opts.details.length > 0) {
        detailsHtml = `
          <div class="p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-1.5 font-mono text-xs text-left">
            ${opts.details.map(d => `
              <div class="flex items-center justify-between gap-2">
                <span class="text-slate-500 dark:text-slate-400 font-medium">${escapeHtml(d.label)}</span>
                <span class="font-bold text-slate-800 dark:text-slate-100">${escapeHtml(d.value)}</span>
              </div>
            `).join('')}
          </div>
        `;
      }

      overlay.innerHTML = `
        <div class="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4 text-center">
          <div class="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center ${iconColorClasses}">
            ${iconHtml}
          </div>

          <div class="space-y-2">
            <h3 class="text-lg font-black text-slate-900 dark:text-white tracking-tight">${escapeHtml(title)}</h3>
            <p class="text-sm text-slate-600 dark:text-slate-300 font-medium leading-relaxed whitespace-pre-line text-left bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800">
              ${escapeHtml(opts.message)}
            </p>
          </div>

          ${detailsHtml}

          <div class="pt-2">
            <button id="dialog-confirm-btn" class="w-full py-3 px-5 rounded-2xl font-black text-sm active:scale-98 transition-all cursor-pointer ${btnColorClasses}">
              ${escapeHtml(confirmText)}
            </button>
          </div>
        </div>
      `;

      const cleanup = () => {
        overlay.remove();
        if (opts.onClose) opts.onClose();
        resolve();
      };

      overlay.querySelector('#dialog-confirm-btn')?.addEventListener('click', cleanup);
      document.body.appendChild(overlay);
    });
  }

  /**
   * Modale de confirmation stylisée "maison" (remplace nativement confirm())
   */
  public static confirm(options: ConfirmOptions): Promise<boolean> {
    return new Promise((resolve) => {
      const title = options.title || 'Confirmation requise';
      const type = options.type || 'warning';
      const confirmText = options.confirmText || 'Confirmer';
      const cancelText = options.cancelText || 'Annuler';

      const overlay = document.createElement('div');
      overlay.className = 'fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-enter';

      let iconHtml = Icons.alertTriangle('w-7 h-7');
      let iconColorClasses = 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20';
      let btnColorClasses = 'bg-amber-600 hover:bg-amber-700 text-white shadow-md shadow-amber-600/20';

      if (type === 'danger') {
        iconHtml = Icons.xCircle('w-7 h-7');
        iconColorClasses = 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/20';
        btnColorClasses = 'bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/20';
      } else if (type === 'info') {
        iconHtml = `
          <svg xmlns="http://www.w3.org/2000/svg" class="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>
          </svg>`;
        iconColorClasses = 'bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/20';
        btnColorClasses = 'bg-sky-600 hover:bg-sky-700 text-white shadow-md shadow-sky-600/20';
      }

      overlay.innerHTML = `
        <div class="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4 text-center">
          <div class="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center ${iconColorClasses}">
            ${iconHtml}
          </div>

          <div class="space-y-2">
            <h3 class="text-lg font-black text-slate-900 dark:text-white tracking-tight">${escapeHtml(title)}</h3>
            <p class="text-sm text-slate-600 dark:text-slate-300 font-medium leading-relaxed whitespace-pre-line text-left bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800">
              ${escapeHtml(options.message)}
            </p>
          </div>

          <div class="grid grid-cols-2 gap-3 pt-2">
            <button id="dialog-cancel-btn" class="py-3 px-4 rounded-2xl font-bold text-sm bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-all cursor-pointer">
              ${escapeHtml(cancelText)}
            </button>
            <button id="dialog-confirm-btn" class="py-3 px-4 rounded-2xl font-black text-sm active:scale-98 transition-all cursor-pointer ${btnColorClasses}">
              ${escapeHtml(confirmText)}
            </button>
          </div>
        </div>
      `;

      overlay.querySelector('#dialog-cancel-btn')?.addEventListener('click', () => {
        overlay.remove();
        if (options.onCancel) options.onCancel();
        resolve(false);
      });

      overlay.querySelector('#dialog-confirm-btn')?.addEventListener('click', async () => {
        overlay.remove();
        await options.onConfirm();
        resolve(true);
      });

      document.body.appendChild(overlay);
    });
  }

  /**
   * Boîte modale personnalisée avec contenu HTML arbitraire
   */
  public static custom(options: {
    title: string;
    content: HTMLElement | string;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    onClose?: () => void;
  }): () => void {
    const sizeMap = {
      sm: 'max-w-md',
      md: 'max-w-lg',
      lg: 'max-w-2xl',
      xl: 'max-w-4xl'
    };
    const maxW = sizeMap[options.size || 'md'];

    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-enter';

    overlay.innerHTML = `
      <div class="w-full ${maxW} max-h-[90vh] rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden animate-scale-up">
        <div class="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h3 class="text-base font-black text-slate-900 dark:text-white tracking-tight">${escapeHtml(options.title)}</h3>
          <button id="modal-close-x" class="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 transition-colors cursor-pointer">
            ${Icons.x('w-4 h-4')}
          </button>
        </div>
        <div id="modal-body-container" class="p-5 overflow-y-auto flex-1 text-xs"></div>
      </div>
    `;

    const bodyEl = overlay.querySelector('#modal-body-container');
    if (bodyEl) {
      if (typeof options.content === 'string') {
        bodyEl.innerHTML = options.content;
      } else {
        bodyEl.appendChild(options.content);
      }
    }

    const close = () => {
      overlay.remove();
      if (options.onClose) options.onClose();
    };

    overlay.querySelector('#modal-close-x')?.addEventListener('click', close);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });

    document.body.appendChild(overlay);
    return close;
  }
}
