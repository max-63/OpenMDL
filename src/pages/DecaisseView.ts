import { db } from '../services/db';
import { syncService } from '../services/syncService';
import { Icons } from '../components/Icons';
import { AppDialog } from '../components/AppDialog';
import { escapeHtml } from '../utils/security';
import { SessionCashWithdrawal, EnrichedCashWithdrawal, EURO_DENOMINATIONS } from '../types';

export class DecaisseView {
  private container: HTMLElement;
  private selectedFilter: 'all' | 'pending' | 'signed' = 'all';

  constructor() {
    this.container = document.createElement('div');
    this.container.className = 'flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6';
  }

  public render(): HTMLElement {
    this.container.innerHTML = '';
    const isOnline = syncService.isServerReachable;
    const localHash = db.getDatabaseHash();
    const lastSync = syncService.lastSyncTime
      ? new Date(syncService.lastSyncTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      : 'Aucune';

    const withdrawals = db.getCashWithdrawals();
    const pendingCount = withdrawals.filter(w => !w.visaBy).length;
    const signedCount = withdrawals.filter(w => Boolean(w.visaBy)).length;

    const totalWithdrawnAll = withdrawals.reduce((sum, w) => sum + (w.totalWithdrawn || 0), 0);
    const totalRemainingFloat = db.getCashFloatSettings().baseCounts;
    const floatBaseVal = db.calculateBaseCashFloatTotal(totalRemainingFloat);

    const filteredWithdrawals = withdrawals.filter(w => {
      if (this.selectedFilter === 'pending') return !w.visaBy;
      if (this.selectedFilter === 'signed') return Boolean(w.visaBy);
      return true;
    });

    const activeUsers = db.getVolunteers().filter(v => v.role !== 'inactive');

    this.container.innerHTML = `
      <div class="max-w-7xl mx-auto space-y-6 animate-enter">
        
        <!-- En-tête Vie Scolaire & Statut de réplication -->
        <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div class="flex items-center gap-4">
            <div class="w-12 h-12 rounded-2xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center flex-shrink-0">
              ${Icons.vault('w-7 h-7')}
            </div>
            <div>
              <div class="flex items-center gap-2.5">
                <h1 class="text-xl font-black text-slate-900 dark:text-white tracking-tight">Poste Vie Scolaire - Décaisse & Coffre</h1>
                <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/30">
                  Mode Contrôle & Coffre
                </span>
              </div>
              <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Supervision des remises d'espèces, visas des décaissements et gestion des bénévoles habilités.
              </p>
            </div>
          </div>

          <!-- Badge Statut Réseau Foyer -->
          <div class="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
            <div class="flex items-center gap-2 px-3 py-2 rounded-xl border ${isOnline
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-300'
              : 'bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-300'
            } text-xs font-semibold">
              <span class="w-2.5 h-2.5 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}"></span>
              <div class="flex flex-col text-left">
                <span>${isOnline ? 'Serveur Foyer En Ligne' : 'Foyer Éteint (Copie Locale Sécurisée)'}</span>
                <span class="text-[10px] font-mono opacity-80">CRC32: ${localHash} | Synchro: ${lastSync}</span>
              </div>
            </div>

            <button id="btn-force-sync" class="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors" title="Vérifier et forcer la synchronisation">
              ${Icons.refresh('w-4 h-4')}
            </button>
          </div>
        </div>

        <!-- Alerte si le foyer est éteint -->
        ${!isOnline ? `
          <div class="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-200 flex items-start gap-3">
            ${Icons.hardDrive('w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5')}
            <div class="text-xs leading-relaxed">
              <span class="font-bold">Mode Hors-Ligne Actif :</span> Le poste Foyer est actuellement inaccessible ou éteint. Toutes vos données restent parfaitement consultables grâce à la copie miroir locale. Vos visas et consultations sont conservés en toute sécurité.
            </div>
          </div>
        ` : ''}

        <!-- Grille de Métriques Clés -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <!-- Total Décaissé -->
          <div class="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Espèces Décaissées</span>
              <div class="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                ${Icons.banknote('w-4 h-4')}
              </div>
            </div>
            <div class="mt-3">
              <span class="text-2xl font-black text-slate-900 dark:text-white">${totalWithdrawnAll.toFixed(2)} €</span>
              <p class="text-xs text-slate-400 mt-1">Cumul total des retraits enregistrés</p>
            </div>
          </div>

          <!-- Fond de Caisse Théorique -->
          <div class="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Fond de Roulement</span>
              <div class="w-8 h-8 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center">
                ${Icons.coins('w-4 h-4')}
              </div>
            </div>
            <div class="mt-3">
              <span class="text-2xl font-black text-slate-900 dark:text-white">${floatBaseVal.toFixed(2)} €</span>
              <p class="text-xs text-slate-400 mt-1">Monnaie laissée en tiroir par défaut</p>
            </div>
          </div>

          <!-- Visas en Attente -->
          <div class="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">En Attente de Visa</span>
              <div class="w-8 h-8 rounded-xl ${pendingCount > 0 ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400' : 'bg-emerald-500/10 text-emerald-600'} flex items-center justify-center">
                ${Icons.clipboardCheck('w-4 h-4')}
              </div>
            </div>
            <div class="mt-3">
              <div class="flex items-baseline gap-2">
                <span class="text-2xl font-black ${pendingCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-white'}">${pendingCount}</span>
                <span class="text-xs font-semibold text-slate-400">/ ${withdrawals.length} remises</span>
              </div>
              <p class="text-xs ${pendingCount > 0 ? 'text-amber-600 dark:text-amber-400 font-bold' : 'text-slate-400'} mt-1">
                ${pendingCount > 0 ? 'Vérification requise par Vie Scolaire' : 'Toutes les remises sont visées'}
              </p>
            </div>
          </div>

          <!-- Bénévoles Habilités -->
          <div class="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Bénévoles Actifs</span>
              <div class="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                ${Icons.user('w-4 h-4')}
              </div>
            </div>
            <div class="mt-3">
              <span class="text-2xl font-black text-slate-900 dark:text-white">${activeUsers.length}</span>
              <p class="text-xs text-slate-400 mt-1">Comptes habilités à la tenue de caisse</p>
            </div>
          </div>
        </div>

        <!-- Section Principale : Tableau des Décaissements & Coffre -->
        <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          
          <!-- Filtres et Titre -->
          <div class="p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 class="text-base font-bold text-slate-900 dark:text-white">Registre des Décaissements de Séances</h2>
              <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Historique des fermetures de caisse, montants déposés au coffre et visas administratifs.
              </p>
            </div>

            <!-- Filtres -->
            <div class="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold">
              <button data-filter="all" class="px-3 py-1.5 rounded-lg transition-all ${this.selectedFilter === 'all'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-bold'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900'
              }">
                Tous (${withdrawals.length})
              </button>
              <button data-filter="pending" class="px-3 py-1.5 rounded-lg transition-all ${this.selectedFilter === 'pending'
                ? 'bg-amber-500 text-white shadow-xs font-bold'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900'
              }">
                A viser (${pendingCount})
              </button>
              <button data-filter="signed" class="px-3 py-1.5 rounded-lg transition-all ${this.selectedFilter === 'signed'
                ? 'bg-emerald-500 text-white shadow-xs font-bold'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900'
              }">
                Visés (${signedCount})
              </button>
            </div>
          </div>

          <!-- Liste des Décaissements -->
          ${filteredWithdrawals.length === 0 ? `
            <div class="p-12 text-center text-slate-400">
              <div class="w-12 h-12 mx-auto rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-3">
                ${Icons.vault('w-6 h-6')}
              </div>
              <p class="text-sm font-semibold text-slate-600 dark:text-slate-300">Aucun décaissement pour ce filtre</p>
              <p class="text-xs mt-1">Les décaissements apparaîtront ici dès la clôture des permanences foyer.</p>
            </div>
          ` : `
            <div class="divide-y divide-slate-100 dark:divide-slate-800">
              ${filteredWithdrawals.map(w => this.renderWithdrawalRow(w)).join('')}
            </div>
          `}
        </div>

        <!-- Section Utilisateurs Habilités Vie Scolaire -->
        <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 space-y-4">
          <div class="flex items-center justify-between">
            <div>
              <h2 class="text-base font-bold text-slate-900 dark:text-white">Bénévoles & Gestionnaires Habilités</h2>
              <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Utilisateurs autorisés à ouvrir la caisse et manipuler les fonds du Foyer.
              </p>
            </div>
            <span class="text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
              ${activeUsers.length} actifs
            </span>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            ${activeUsers.map(u => `
              <div class="p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex items-center justify-between gap-3">
                <div class="flex items-center gap-3 min-w-0">
                  <div class="w-9 h-9 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center font-bold flex-shrink-0 text-xs">
                    ${escapeHtml(u.name.substring(0, 2).toUpperCase())}
                  </div>
                  <div class="min-w-0">
                    <div class="text-xs font-bold text-slate-900 dark:text-white truncate">${escapeHtml(u.name)}</div>
                    <div class="text-[10px] text-slate-400 capitalize mt-0.5">${escapeHtml(u.role)}</div>
                  </div>
                </div>
                <div class="flex items-center gap-1.5 flex-shrink-0">
                  ${u.isAdmin ? `
                    <span class="px-2 py-0.5 rounded bg-orange-500/15 text-orange-600 dark:text-orange-400 text-[10px] font-extrabold">ADMIN</span>
                  ` : `
                    <span class="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[10px] font-bold">Bénévole</span>
                  `}
                </div>
              </div>
            `).join('')}
          </div>
        </div>

      </div>
    `;

    this.attachEvents();
    return this.container;
  }

  private renderWithdrawalRow(w: EnrichedCashWithdrawal): string {
    const isSigned = Boolean(w.visaBy);
    const dateFormatted = new Date(w.sessionEndTime).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
    const timeFormatted = new Date(w.sessionEndTime).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    });

    // Détail des coupures décaissées
    const withdrawnPieces = w.items
      .filter(it => it.withdrawnCount > 0)
      .map(it => `${it.withdrawnCount}x ${it.name}`)
      .join(', ') || 'Aucun retrait unitaire';

    const discSign = w.cashDiscrepancy >= 0 ? '+' : '';
    const discColor = w.cashDiscrepancy === 0
      ? 'text-slate-500 dark:text-slate-400'
      : w.cashDiscrepancy > 0
        ? 'text-emerald-600 dark:text-emerald-400 font-bold'
        : 'text-rose-600 dark:text-rose-400 font-bold';

    return `
      <div class="p-5 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        
        <!-- Info Séance & Bénévole -->
        <div class="flex items-start gap-4 min-w-0">
          <div class="w-10 h-10 rounded-xl ${isSigned ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'} flex items-center justify-center flex-shrink-0 mt-1">
            ${isSigned ? Icons.check('w-5 h-5') : Icons.alertTriangle('w-5 h-5')}
          </div>
          <div>
            <div class="flex items-center gap-2.5">
              <span class="text-sm font-bold text-slate-900 dark:text-white">Séance du ${dateFormatted} à ${timeFormatted}</span>
              ${isSigned ? `
                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                  Visé par ${escapeHtml(w.visaBy || '')}
                </span>
              ` : `
                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                  En attente de signature
                </span>
              `}
            </div>
            <div class="text-xs text-slate-500 dark:text-slate-400 mt-1 flex flex-wrap items-center gap-3">
              <span>Bénévole : <strong class="text-slate-700 dark:text-slate-200">${escapeHtml(w.volunteerName)}</strong></span>
              <span>Fond laissé : <strong>${w.totalRemainingFloat.toFixed(2)} €</strong></span>
              <span>Écart : <strong class="${discColor}">${discSign}${w.cashDiscrepancy.toFixed(2)} €</strong></span>
            </div>
            <div class="text-[11px] text-slate-500 dark:text-slate-400 mt-2 bg-slate-100 dark:bg-slate-800/80 px-3 py-1.5 rounded-lg">
              <span class="font-bold text-slate-700 dark:text-slate-300">Coupures déposées : </span>
              <span>${escapeHtml(withdrawnPieces)}</span>
            </div>
            ${w.visaNotes ? `
              <div class="text-[11px] text-slate-500 italic mt-1.5">
                Note de visa : ${escapeHtml(w.visaNotes)}
              </div>
            ` : ''}
          </div>
        </div>

        <!-- Montant et Actions -->
        <div class="flex items-center gap-3 w-full lg:w-auto justify-between lg:justify-end border-t lg:border-t-0 pt-3 lg:pt-0 border-slate-100 dark:border-slate-800">
          <div class="text-right">
            <span class="text-xs text-slate-400 font-bold uppercase tracking-wider block">Montant Décaissé</span>
            <span class="text-xl font-black text-slate-900 dark:text-white">${w.totalWithdrawn.toFixed(2)} €</span>
          </div>

          <div class="flex items-center gap-2">
            <button data-print-withdrawal="${w.sessionId}" class="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" title="Imprimer le reçu de décaissement">
              ${Icons.download('w-4 h-4')}
            </button>

            ${!isSigned ? `
              <button data-visa-btn="${w.sessionId}" class="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5">
                ${Icons.clipboardCheck('w-4 h-4')}
                <span>Viser la remise</span>
              </button>
            ` : `
              <button data-visa-btn="${w.sessionId}" class="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-semibold hover:bg-slate-200 transition-colors" title="Modifier le visa">
                Modifier
              </button>
            `}
          </div>
        </div>

      </div>
    `;
  }

  private attachEvents(): void {
    // Boutons de filtre
    this.container.querySelectorAll('[data-filter]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const filter = (e.currentTarget as HTMLElement).getAttribute('data-filter') as any;
        if (filter) {
          this.selectedFilter = filter;
          this.render();
        }
      });
    });

    // Synchronisation forcée
    this.container.querySelector('#btn-force-sync')?.addEventListener('click', async () => {
      const btn = this.container.querySelector('#btn-force-sync') as HTMLButtonElement | null;
      if (btn) btn.classList.add('animate-spin');
      await syncService.checkHashAndSync();
      if (btn) btn.classList.remove('animate-spin');
      this.render();
    });

    // Viser un décaissement
    this.container.querySelectorAll('[data-visa-btn]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const sessionId = (e.currentTarget as HTMLElement).getAttribute('data-visa-btn');
        if (!sessionId) return;
        this.openVisaModal(sessionId);
      });
    });

    // Imprimer / Télécharger reçu de décaissement
    this.container.querySelectorAll('[data-print-withdrawal]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const sessionId = (e.currentTarget as HTMLElement).getAttribute('data-print-withdrawal');
        if (!sessionId) return;
        this.printWithdrawalReceipt(sessionId);
      });
    });
  }

  private openVisaModal(sessionId: string): void {
    const withdrawal = db.getCashWithdrawals().find(w => w.sessionId === sessionId);
    if (!withdrawal) return;

    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-enter';

    modal.innerHTML = `
      <div class="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-5">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center font-bold">
              ${Icons.clipboardCheck('w-5 h-5')}
            </div>
            <div>
              <h3 class="text-base font-bold text-slate-900 dark:text-white">Visa de Décaissement</h3>
              <p class="text-xs text-slate-500">Validation et signature Vie Scolaire</p>
            </div>
          </div>
          <button id="modal-close-x" class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            ${Icons.minus('w-4 h-4')}
          </button>
        </div>

        <div class="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-xs space-y-1.5">
          <div class="flex justify-between">
            <span class="text-slate-400">Séance :</span>
            <span class="font-bold text-slate-700 dark:text-slate-300">${new Date(withdrawal.sessionEndTime).toLocaleDateString('fr-FR')} à ${new Date(withdrawal.sessionEndTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-slate-400">Bénévole caissier :</span>
            <span class="font-bold text-slate-700 dark:text-slate-300">${escapeHtml(withdrawal.volunteerName)}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-slate-400">Montant remis au coffre :</span>
            <span class="font-black text-emerald-600 dark:text-emerald-400">${withdrawal.totalWithdrawn.toFixed(2)} €</span>
          </div>
        </div>

        <div class="space-y-3">
          <div>
            <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Nom & Prénom de l'agent Vie Scolaire / CPE <span class="text-rose-500">*</span>
            </label>
            <input type="text" id="visa-agent-name" value="${escapeHtml(withdrawal.visaBy || '')}" placeholder="ex: M. Dupont (CPE)" class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-sky-500" />
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Observations / Vérification du coffre (Optionnel)
            </label>
            <textarea id="visa-notes" rows="2" placeholder="ex: Montant compté et conforme avec le bénévole. Déposé au coffre central." class="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-sky-500">${escapeHtml(withdrawal.visaNotes || '')}</textarea>
          </div>
        </div>

        <div class="flex items-center justify-end gap-2.5 pt-2">
          <button id="modal-cancel" class="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            Annuler
          </button>
          <button id="modal-submit" class="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition-all shadow-xs">
            Signer & Valider le Visa
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const closeModal = () => {
      if (modal.parentNode) modal.parentNode.removeChild(modal);
    };

    modal.querySelector('#modal-close-x')?.addEventListener('click', closeModal);
    modal.querySelector('#modal-cancel')?.addEventListener('click', closeModal);

    modal.querySelector('#modal-submit')?.addEventListener('click', () => {
      const agentName = (modal.querySelector('#visa-agent-name') as HTMLInputElement)?.value.trim();
      const notes = (modal.querySelector('#visa-notes') as HTMLTextAreaElement)?.value.trim();

      if (!agentName) {
        AppDialog.alert({
          title: 'Champ obligatoire',
          message: 'Veuillez saisir votre nom ou matricule pour signer la réception des espèces.',
          type: 'warning'
        });
        return;
      }

      db.visaCashWithdrawal(sessionId, agentName, notes);
      closeModal();
      this.render();

      AppDialog.alert({
        title: 'Visa enregistré',
        message: `La remise d'espèces de ${withdrawal.totalWithdrawn.toFixed(2)} € a été visée avec succès par ${agentName}.`,
        type: 'success'
      });
    });
  }

  private printWithdrawalReceipt(sessionId: string): void {
    const withdrawal = db.getCashWithdrawals().find(w => w.sessionId === sessionId);
    if (!withdrawal) return;

    const printWin = window.open('', '_blank');
    if (!printWin) {
      AppDialog.alert({
        title: 'Impression bloquée',
        message: 'Veuillez autoriser les popups pour générer le reçu de décaissement.',
        type: 'warning'
      });
      return;
    }

    const itemsRows = withdrawal.items
      .filter(it => it.withdrawnCount > 0)
      .map(it => `<tr><td style="padding: 4px 8px; border-bottom: 1px solid #eee;">${escapeHtml(it.name)}</td><td style="text-align: right; padding: 4px 8px; border-bottom: 1px solid #eee;">${it.withdrawnCount}</td><td style="text-align: right; padding: 4px 8px; border-bottom: 1px solid #eee;">${(it.withdrawnCount * it.value).toFixed(2)} €</td></tr>`)
      .join('');

    printWin.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Récépissé de Décaissement - Foyer des Lycéens</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; padding: 24px; color: #111; max-width: 600px; margin: 0 auto; }
          h1 { font-size: 18px; margin: 0 0 4px 0; }
          .sub { font-size: 12px; color: #666; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; font-size: 13px; margin: 16px 0; }
          th { text-align: left; background: #f4f4f4; padding: 6px 8px; font-weight: bold; border-bottom: 2px solid #ddd; }
          .total { font-size: 16px; font-weight: bold; text-align: right; padding-top: 12px; }
          .signatures { display: flex; justify-content: space-between; margin-top: 40px; font-size: 12px; }
          .box { border: 1px dashed #aaa; width: 45%; height: 90px; padding: 8px; border-radius: 4px; }
        </style>
      </head>
      <body>
        <h1>RÉCÉPISSÉ DE DÉCAISSEMENT & DÉPÔT AU COFFRE</h1>
        <div class="sub">OpenMDL - Foyer des Lycéens | Poste Vie Scolaire</div>
        
        <p style="font-size: 13px;"><strong>Date de séance :</strong> ${new Date(withdrawal.sessionEndTime).toLocaleDateString('fr-FR')} à ${new Date(withdrawal.sessionEndTime).toLocaleTimeString('fr-FR')}</p>
        <p style="font-size: 13px;"><strong>Bénévole dépositaire :</strong> ${escapeHtml(withdrawal.volunteerName)}</p>
        <p style="font-size: 13px;"><strong>Fond restant en caisse :</strong> ${withdrawal.totalRemainingFloat.toFixed(2)} € (théorique)</p>

        <table>
          <thead>
            <tr><th>Coupure</th><th style="text-align: right;">Quantité</th><th style="text-align: right;">Sous-total</th></tr>
          </thead>
          <tbody>
            ${itemsRows}
          </tbody>
        </table>

        <div class="total">
          TOTAL REMIS AU COFFRE : ${withdrawal.totalWithdrawn.toFixed(2)} €
        </div>

        <div style="font-size: 12px; margin-top: 12px; color: #555;">
          ${withdrawal.visaBy ? `<strong>Visé par :</strong> ${escapeHtml(withdrawal.visaBy)} le ${new Date(withdrawal.visaDate || '').toLocaleString('fr-FR')}<br/>` : '<strong>Statut :</strong> Non visé au moment de l\'impression.<br/>'}
          ${withdrawal.visaNotes ? `<strong>Observations :</strong> ${escapeHtml(withdrawal.visaNotes)}` : ''}
        </div>

        <div class="signatures">
          <div class="box">Signature du Bénévole :</div>
          <div class="box">Signature Vie Scolaire / CPE :</div>
        </div>

        <script>
          window.print();
        </script>
      </body>
      </html>
    `);
    printWin.document.close();
  }
}
