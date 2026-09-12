import { Session } from '../types';
import { db } from '../services/db';
import { Icons } from './Icons';

export class CloseSessionModalComponent {
  private container: HTMLElement | null = null;
  private session: Session | null = null;
  private onClosedCallback: () => void;

  constructor(onClosed: () => void) {
    this.session = db.getActiveSession();
    this.onClosedCallback = onClosed;
  }

  public show(): void {
    this.session = db.getActiveSession();
    if (!this.session) {
      alert('Aucune séance active trouvée.');
      return;
    }

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
    if (!this.container || !this.session) return;

    const startTimeFormatted = new Date(this.session.startTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const nowFormatted = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

    this.container.innerHTML = `
      <div class="relative w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden text-slate-900 dark:text-slate-100">
        
        <!-- En-tête -->
        <div class="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-800/50">
          <div class="flex items-center gap-2.5">
            ${Icons.clipboardCheck('w-5 h-5 text-orange-500')}
            <div>
              <h2 class="text-sm font-bold tracking-tight text-slate-900 dark:text-white">Clôture de la séance</h2>
              <p class="text-[11px] text-slate-400 font-mono-nums mt-0.5">${this.session.volunteerName} (${startTimeFormatted} - ${nowFormatted})</p>
            </div>
          </div>
          <button id="close-modal-x" class="p-1.5 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <!-- Corps -->
        <div class="p-6 space-y-5">
          
          <!-- Chiffres clés de la séance avec peps -->
          <div class="grid grid-cols-3 gap-2.5 text-center">
            <div class="p-3.5 rounded-2xl bg-orange-500/10 border border-orange-500/20 shadow-xs">
              <span class="text-[10px] font-bold text-orange-700 dark:text-orange-400 uppercase tracking-wider">Recette</span>
              <p class="font-mono-nums font-black text-xl text-orange-600 dark:text-orange-400 mt-0.5">${this.session.totalSales.toFixed(2)} €</p>
              <span class="text-[10px] font-medium text-slate-500">${this.session.salesCount} ventes</span>
            </div>

            <div class="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 shadow-xs">
              <span class="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Espèces</span>
              <p class="font-mono-nums font-black text-xl text-emerald-600 dark:text-emerald-400 mt-0.5">${this.session.totalCash.toFixed(2)} €</p>
              <span class="text-[10px] font-medium text-slate-500">Tiroir caisse</span>
            </div>

            <div class="p-3.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 shadow-xs">
              <span class="text-[10px] font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider">TPE (Cartes)</span>
              <p class="font-mono-nums font-black text-xl text-indigo-600 dark:text-indigo-400 mt-0.5">${this.session.totalTpe.toFixed(2)} €</p>
              <span class="text-[10px] font-medium text-slate-500">Télécollecte</span>
            </div>
          </div>

          <!-- Cahier de transmission / Incidents -->
          <div class="space-y-1.5">
            <label class="block text-xs font-bold text-slate-700 dark:text-slate-200">
              Cahier de transmission & Incidents (dégradations, matériel, remarques...)
            </label>
            <textarea 
              id="incident-notes-input" 
              rows="4" 
              placeholder="Ex: Queue de billard recollée, babyfoot OK, manque de pièces de 0.50€ dans le tiroir..."
              class="w-full p-3.5 text-xs rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 transition-all resize-none placeholder:text-slate-400 font-sans shadow-inner"
            ></textarea>
          </div>

          <!-- Note sur l'action automatique -->
          <div class="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed font-medium flex items-center gap-2.5">
            ${Icons.save('w-4 h-4 flex-shrink-0 text-amber-600 dark:text-amber-400')}
            <span>La clôture génère automatiquement une sauvegarde horodatée SQLite dans <code class="font-mono font-bold bg-amber-500/20 px-1.5 py-0.5 rounded-md">backups/</code> et ferme la séance.</span>
          </div>

          <!-- Boutons -->
          <div class="pt-1 flex items-center gap-3">
            <button id="cancel-btn" class="flex-1 py-3 px-4 rounded-2xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold transition-all">
              Annuler
            </button>

            <button id="confirm-close-btn" class="flex-[2] py-3.5 px-4 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs flex items-center justify-center gap-2 shadow-sm shadow-amber-600/20 active:scale-98 transition-all">
              ${Icons.check('w-4 h-4')}
              <span>Valider la clôture & Sauvegarder</span>
            </button>
          </div>

        </div>

      </div>
    `;

    this.container.querySelector('#close-modal-x')?.addEventListener('click', () => this.hide());
    this.container.querySelector('#cancel-btn')?.addEventListener('click', () => this.hide());

    this.container.querySelector('#confirm-close-btn')?.addEventListener('click', () => {
      const notes = (this.container?.querySelector('#incident-notes-input') as HTMLTextAreaElement)?.value || '';
      
      const { session, backupName } = db.closeSession(notes);
      
      this.hide();

      alert(`Séance clôturée :\n- Total : ${session.totalSales.toFixed(2)} €\n- Espèces : ${session.totalCash.toFixed(2)} €\n- TPE : ${session.totalTpe.toFixed(2)} €\n- Backup créé : ${backupName}`);
      
      this.onClosedCallback();
    });
  }
}
