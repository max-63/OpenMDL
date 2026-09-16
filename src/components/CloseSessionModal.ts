import { Session } from '../types';
import { db } from '../services/db';
import { Icons } from './Icons';
import { escapeHtml } from '../utils/security';

export class CloseSessionModalComponent {
  private container: HTMLElement | null = null;
  private session: Session | null = null;
  private onClosedCallback: () => void;
  private selectedPerkId: string = '';

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

    this.selectedPerkId = this.session.draftPerkProductId || '';

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

    const perkCheck = db.canClaimVolunteerPerk(this.session.volunteerId, this.session.id);
    const perkSettings = db.getPerkSettings();
    const itemsSoldCount = db.getSessionItemsSoldCount(this.session.id);
    const salesCount = this.session.salesCount;

    // Produits consommables éligibles à la collation (stock > 0)
    const availableProducts = db.getProducts().filter(p => 
      p.isActive && p.stock > 0 && 
      (p.category === 'boissons' || p.category === 'snacks' || p.category === 'chaud' || p.category === 'bonbons')
    );

    const draftNotes = this.session.draftNotes || '';
    const hasDraft = Boolean(draftNotes || this.selectedPerkId);

    // Calcul du pourcentage de progression du seuil
    const progressPercent = perkCheck.required > 0 
      ? Math.min(100, Math.round((perkCheck.current / perkCheck.required) * 100))
      : 100;

    let perkStatusHtml = '';
    if (!perkSettings.enabled) {
      perkStatusHtml = `
        <div class="p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2">
          ${Icons.gift('w-4 h-4 text-slate-400 flex-shrink-0')}
          <span>La collation bénévole offerte est actuellement désactivée par les administrateurs.</span>
        </div>
      `;
    } else if (perkCheck.allowed) {
      perkStatusHtml = `
        <div class="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-slate-800 dark:text-slate-200 space-y-2.5">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <div class="w-7 h-7 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                ${Icons.gift('w-4 h-4')}
              </div>
              <div>
                <span class="text-xs font-bold text-emerald-700 dark:text-emerald-300">Collation bénévole débloquée !</span>
                <p class="text-[10px] text-slate-500 dark:text-slate-400">1 article au choix offert pour votre permanence</p>
              </div>
            </div>
            <span class="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
              Offert
            </span>
          </div>

          <div class="space-y-1">
            <label for="perk-product-select" class="block text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">
              Sélectionnez votre boisson ou snack :
            </label>
            <select 
              id="perk-product-select" 
              class="w-full px-3 py-2.5 text-xs rounded-xl bg-white dark:bg-slate-800 border border-emerald-500/30 text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/30 cursor-pointer"
            >
              <option value="">-- Aucun pour le moment (ne rien prendre) --</option>
              ${availableProducts.map(p => `
                <option value="${p.id}" ${p.id === this.selectedPerkId ? 'selected' : ''}>
                  ${escapeHtml(p.name)} (${p.price.toFixed(2)} € - Stock dispo: ${p.stock})
                </option>
              `).join('')}
            </select>
          </div>
        </div>
      `;
    } else {
      const metricLabel = perkSettings.rule === 'sales_count' ? 'ventes' : 'articles vendus';
      perkStatusHtml = `
        <div class="p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-2">
          <div class="flex items-center justify-between text-[11px]">
            <div class="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-300">
              ${Icons.gift('w-3.5 h-3.5 text-orange-500')}
              <span>Collation offerte</span>
            </div>
            <span class="font-mono-nums text-[10px] font-bold text-orange-600 dark:text-orange-400">
              ${perkCheck.current} / ${perkCheck.required} ${metricLabel}
            </span>
          </div>

          <div class="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
            <div 
              class="h-full bg-orange-500 transition-all duration-300"
              style="width: ${progressPercent}%;"
            ></div>
          </div>

          <p class="text-[10px] text-slate-500 dark:text-slate-400">
            ${escapeHtml(perkCheck.reason || 'Objectif non atteint.')}
          </p>
        </div>
      `;
    }

    this.container.innerHTML = `
      <div class="relative w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden text-slate-900 dark:text-slate-100 max-h-[92vh] flex flex-col">
        
        <!-- En-tête -->
        <div class="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-800/50 flex-shrink-0">
          <div class="flex items-center gap-2.5">
            ${Icons.clipboardCheck('w-5 h-5 text-orange-500')}
            <div>
              <div class="flex items-center gap-2">
                <h2 class="text-sm font-bold tracking-tight text-slate-900 dark:text-white">Clôture de la séance</h2>
                <span id="draft-badge" class="${hasDraft ? 'inline-flex' : 'hidden'} items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  ${Icons.refresh('w-2.5 h-2.5 animate-spin-slow')}
                  <span>Brouillon mémorisé</span>
                </span>
              </div>
              <p class="text-[11px] text-slate-400 font-mono-nums mt-0.5">${escapeHtml(this.session.volunteerName)} (${startTimeFormatted} - ${nowFormatted})</p>
            </div>
          </div>
          <button id="close-modal-x" class="p-1.5 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <!-- Corps avec défilement fluide -->
        <div class="p-6 space-y-4 overflow-y-auto flex-1">
          
          <!-- Chiffres clés de la séance -->
          <div class="grid grid-cols-3 gap-2.5 text-center">
            <div class="p-3 rounded-2xl bg-orange-500/10 border border-orange-500/20 shadow-xs">
              <span class="text-[10px] font-bold text-orange-700 dark:text-orange-400 uppercase tracking-wider">Recette</span>
              <p class="font-mono-nums font-black text-lg text-orange-600 dark:text-orange-400 mt-0.5">${this.session.totalSales.toFixed(2)} €</p>
              <span class="text-[10px] font-medium text-slate-500">${salesCount} ventes (${itemsSoldCount} art.)</span>
            </div>

            <div class="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 shadow-xs">
              <span class="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Espèces</span>
              <p class="font-mono-nums font-black text-lg text-emerald-600 dark:text-emerald-400 mt-0.5">${this.session.totalCash.toFixed(2)} €</p>
              <span class="text-[10px] font-medium text-slate-500">Tiroir caisse</span>
            </div>

            <div class="p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 shadow-xs">
              <span class="text-[10px] font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider">TPE (Cartes)</span>
              <p class="font-mono-nums font-black text-lg text-indigo-600 dark:text-indigo-400 mt-0.5">${this.session.totalTpe.toFixed(2)} €</p>
              <span class="text-[10px] font-medium text-slate-500">Télécollecte</span>
            </div>
          </div>

          <!-- Section Collation Bénévole (Offerte / Progression) -->
          ${perkStatusHtml}

          <!-- Cahier de transmission / Incidents avec sauvegarde automatique -->
          <div class="space-y-1.5">
            <div class="flex items-center justify-between">
              <label for="incident-notes-input" class="block text-xs font-bold text-slate-700 dark:text-slate-200">
                Cahier de transmission & Remarques de séance
              </label>
              <span class="text-[10px] text-slate-400">Sauvegarde auto</span>
            </div>
            <textarea 
              id="incident-notes-input" 
              rows="3" 
              placeholder="Ex: Restock canettes OK, manque de monnaie de 1€ dans le tiroir, queue de billard réparée..."
              class="w-full p-3.5 text-xs rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 transition-all resize-none placeholder:text-slate-400 font-sans shadow-inner"
            >${escapeHtml(draftNotes)}</textarea>
          </div>

          <!-- Note sur l'action automatique -->
          <div class="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed font-medium flex items-center gap-2">
            ${Icons.save('w-4 h-4 flex-shrink-0 text-amber-600 dark:text-amber-400')}
            <span>La clôture sauvegarde la séance, valide la collation offerte et crée une archive horodatée.</span>
          </div>

        </div>

        <!-- Boutons fixes en bas -->
        <div class="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/80 flex items-center gap-3 flex-shrink-0">
          <button id="cancel-btn" class="flex-1 py-3 px-4 rounded-2xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold transition-all cursor-pointer">
            Garder en brouillon & Quitter
          </button>

          <button id="confirm-close-btn" class="flex-[2] py-3 px-4 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs flex items-center justify-center gap-2 shadow-sm shadow-amber-600/20 active:scale-98 transition-all cursor-pointer">
            ${Icons.check('w-4 h-4')}
            <span>Valider la clôture définitive</span>
          </button>
        </div>

      </div>
    `;

    const notesInput = this.container.querySelector('#incident-notes-input') as HTMLTextAreaElement | null;
    const perkSelect = this.container.querySelector('#perk-product-select') as HTMLSelectElement | null;
    const draftBadge = this.container.querySelector('#draft-badge') as HTMLElement | null;

    // Enregistrement continu en brouillon
    const handleDraftUpdate = () => {
      const currentNotes = notesInput?.value || '';
      const currentPerk = perkSelect?.value || this.selectedPerkId || '';
      db.saveSessionDraft(currentNotes, currentPerk);
      if (draftBadge) {
        draftBadge.classList.remove('hidden');
        draftBadge.classList.add('inline-flex');
      }
    };

    notesInput?.addEventListener('input', handleDraftUpdate);
    perkSelect?.addEventListener('change', (e) => {
      this.selectedPerkId = (e.target as HTMLSelectElement).value;
      handleDraftUpdate();
    });

    // Boutons de fermeture (conservent le brouillon)
    this.container.querySelector('#close-modal-x')?.addEventListener('click', () => {
      handleDraftUpdate();
      this.hide();
    });

    this.container.querySelector('#cancel-btn')?.addEventListener('click', () => {
      handleDraftUpdate();
      this.hide();
    });

    // Validation définitive de la séance
    this.container.querySelector('#confirm-close-btn')?.addEventListener('click', () => {
      const notes = notesInput?.value || '';
      const perkId = perkSelect?.value || this.selectedPerkId || undefined;
      
      const { session, backupName, perkResult } = db.closeSession(notes, perkId);
      
      this.hide();

      let alertMsg = `Séance clôturée avec succès :\n` +
        `- Recette totale : ${session.totalSales.toFixed(2)} € (${session.salesCount} ventes)\n` +
        `- Espèces : ${session.totalCash.toFixed(2)} €\n` +
        `- TPE : ${session.totalTpe.toFixed(2)} €\n` +
        `- Backup créé : ${backupName}`;

      if (perkResult && perkResult.success) {
        alertMsg += `\n- Collation bénévole : ${perkResult.message}`;
      }

      alert(alertMsg);
      this.onClosedCallback();
    });
  }
}
