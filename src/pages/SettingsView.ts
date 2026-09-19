import { db } from '../services/db';
import { Icons } from '../components/Icons';
import { escapeHtml } from '../utils/security';
import { updater, UpdateState } from '../services/updater';
import { PerkEligibilityRule, EURO_DENOMINATIONS, CashFloatSettings } from '../types';
import { syncService, SyncConfig, LanServerStatus } from '../services/syncService';
import { AppDialog } from '../components/AppDialog';
import { packBackupBinary, unpackBackupBinary, listDiskBackups, readBackupFromDisk, triggerFileDownload } from '../services/binaryCodec';

export class SettingsView {
  private feedbackMessage: { text: string; type: 'success' | 'error' } | null = null;
  private syncFeedbackMessage: { text: string; type: 'success' | 'error' | 'info' } | null = null;
  private editingPasswordUserId: string | null = null;
  private editingNameUserId: string | null = null;
  private revealedPasswords: Set<string> = new Set();

  public render(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'w-full h-full flex flex-col gap-4 overflow-y-auto pr-1 animate-enter select-none';

    this.renderContent(container);
    this.attachEventListeners(container);

    return container;
  }

  private renderContent(container: HTMLElement): void {
    container.innerHTML = '';

    const volunteers = db.getVolunteers();
    const currentVolunteer = db.getCurrentVolunteer();
    const adminCount = volunteers.filter(v => v.isAdmin).length;
    const activeCount = volunteers.filter(v => !v.isSuspended).length;
    const suspendedCount = volunteers.filter(v => v.isSuspended).length;
    const perkSettings = db.getPerkSettings();
    const cashFloatSettings = db.getCashFloatSettings();
    const baseCashFloatTotal = db.calculateBaseCashFloatTotal(cashFloatSettings.baseCounts);
    const carriedDifferencesEntries = Object.entries(cashFloatSettings.carriedOverDifferences || {}).filter(([_, diff]) => diff !== 0);
    const syncConfig = syncService.getConfig();
    const serverStatus = syncService.cachedServerStatus;
    const isServerRunning = !!serverStatus?.running;
    const serverIp = syncService.cachedLocalIp || '127.0.0.1';
    const serverPort = serverStatus?.port || syncConfig.lan.port || 4123;

    container.innerHTML = `
      <!-- En-tête de la page Paramètres -->
      <div class="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div class="flex items-center gap-3.5">
          <div class="w-12 h-12 rounded-2xl bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20 flex items-center justify-center font-bold">
            ${Icons.settings('w-6 h-6')}
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h1 class="text-lg font-black text-slate-900 dark:text-white tracking-tight">Gestion des Utilisateurs & Sécurité</h1>
              <span class="px-2.5 py-0.5 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 text-[10px] font-extrabold uppercase tracking-wide border border-orange-500/20">
                Espace Délégué CVL
              </span>
            </div>
            <p class="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
              Créez les comptes bénévoles avec leurs mots de passe, suspendez ou supprimez les accès au foyer de la MDL.
            </p>
          </div>
        </div>

        <!-- Badges statistiques rapides & Bouton Crédits -->
        <div class="flex items-center gap-2 flex-wrap">
          <div class="px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-center">
            <div class="text-[9px] font-bold text-slate-400 uppercase">Total</div>
            <div class="text-xs font-black text-slate-800 dark:text-slate-100">${volunteers.length}</div>
          </div>
          <div class="px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-center">
            <div class="text-[9px] font-bold text-orange-500 uppercase">Admins</div>
            <div class="text-xs font-black text-orange-600 dark:text-orange-400">${adminCount}</div>
          </div>
          <div class="px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-center">
            <div class="text-[9px] font-bold text-emerald-500 uppercase">Actifs</div>
            <div class="text-xs font-black text-emerald-600 dark:text-emerald-400">${activeCount}</div>
          </div>
          <div class="px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-center">
            <div class="text-[9px] font-bold text-rose-500 uppercase">Suspendus</div>
            <div class="text-xs font-black text-rose-600 dark:text-rose-400">${suspendedCount}</div>
          </div>

          <button 
            type="button" 
            id="btn-goto-credits"
            class="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer border border-slate-200 dark:border-slate-700 ml-1"
            title="Consulter les crédits et mentions légales du logiciel"
          >
            ${Icons.shieldCheck('w-4 h-4 text-emerald-500')}
            <span>Crédits</span>
          </button>
        </div>
      </div>

      <!-- Feedback notification -->
      ${this.feedbackMessage ? `
        <div class="p-4 rounded-2xl ${this.feedbackMessage.type === 'success'
          ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-600 dark:text-emerald-400'
          : 'bg-rose-500/10 border-rose-500/25 text-rose-600 dark:text-rose-400'
        } border text-xs font-bold flex items-center justify-between animate-enter">
          <div class="flex items-center gap-2">
            ${this.feedbackMessage.type === 'success' ? Icons.check('w-4 h-4') : Icons.alertTriangle('w-4 h-4')}
            <span>${this.feedbackMessage.text}</span>
          </div>
          <button id="btn-close-feedback" class="hover:opacity-75 text-xs font-black">✕</button>
        </div>
      ` : ''}

      <!-- Carte Réseau & Architecture Multi-Postes -->
      <div class="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-5">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div class="flex items-center gap-3.5">
            <div class="w-11 h-11 rounded-2xl bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20 flex items-center justify-center font-bold flex-shrink-0">
              ${Icons.network('w-5 h-5')}
            </div>
            <div>
              <div class="flex items-center gap-2 flex-wrap">
                <h2 class="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">Réseau & Synchronisation Multi-Postes</h2>
                <span class="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide border ${
                  syncConfig.mode === 'standalone' ? 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20' :
                  syncConfig.mode === 'lan' ? (syncConfig.lan.role === 'server' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' : 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20') :
                  'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                }">
                  ${syncConfig.mode === 'standalone' ? 'Autonome (Solo)' :
                    syncConfig.mode === 'lan' ? (syncConfig.lan.role === 'server' ? 'LAN - Serveur Caisse' : 'LAN - Client Réseau') :
                    'Clé USB / Fichier Partagé'}
                </span>
              </div>
              <p class="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                Choisissez le mode d'opération : caisse unique autonome, partage en direct sur réseau local (Wi-Fi/LAN), ou synchronisation par clé USB.
              </p>
            </div>
          </div>

          <!-- Onglets de sélection du mode d'architecture -->
          <div class="flex items-center gap-1.5 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 self-start md:self-auto flex-wrap">
            <button 
              type="button" 
              data-sync-mode="standalone"
              class="px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                syncConfig.mode === 'standalone'
                  ? 'bg-white dark:bg-slate-900 text-orange-600 dark:text-orange-400 shadow-xs border border-slate-200/60 dark:border-slate-700'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }"
            >
              ${Icons.hardDrive('w-3.5 h-3.5')}
              <span>Autonome (Solo)</span>
            </button>

            <button 
              type="button" 
              data-sync-mode="lan"
              class="px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                syncConfig.mode === 'lan'
                  ? 'bg-white dark:bg-slate-900 text-orange-600 dark:text-orange-400 shadow-xs border border-slate-200/60 dark:border-slate-700'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }"
            >
              ${Icons.network('w-3.5 h-3.5')}
              <span>Réseau Local (LAN)</span>
            </button>

            <button 
              type="button" 
              data-sync-mode="usb"
              class="px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                syncConfig.mode === 'usb'
                  ? 'bg-white dark:bg-slate-900 text-orange-600 dark:text-orange-400 shadow-xs border border-slate-200/60 dark:border-slate-700'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }"
            >
              ${Icons.folder('w-3.5 h-3.5')}
              <span>Clé USB / Fichier</span>
            </button>
          </div>
        </div>

        <!-- Feedback de synchronisation dédié si présent -->
        ${this.syncFeedbackMessage ? `
          <div class="p-3.5 rounded-2xl ${
            this.syncFeedbackMessage.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-600 dark:text-emerald-400'
              : this.syncFeedbackMessage.type === 'error'
              ? 'bg-rose-500/10 border-rose-500/25 text-rose-600 dark:text-rose-400'
              : 'bg-sky-500/10 border-sky-500/25 text-sky-600 dark:text-sky-400'
          } border text-xs font-bold flex items-center justify-between animate-enter">
            <div class="flex items-center gap-2">
              ${this.syncFeedbackMessage.type === 'success' ? Icons.check('w-4 h-4 flex-shrink-0') : Icons.alertTriangle('w-4 h-4 flex-shrink-0')}
              <span>${escapeHtml(this.syncFeedbackMessage.text)}</span>
            </div>
            <button id="btn-close-sync-feedback" class="hover:opacity-75 text-xs font-black cursor-pointer">✕</button>
          </div>
        ` : ''}

        <!-- 1. Vue Mode Autonome -->
        ${syncConfig.mode === 'standalone' ? `
          <div class="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div class="flex items-start gap-3">
              <div class="w-9 h-9 rounded-xl bg-slate-200/70 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 flex items-center justify-center flex-shrink-0 mt-0.5">
                ${Icons.hardDrive('w-4 h-4')}
              </div>
              <div>
                <div class="text-xs font-extrabold text-slate-800 dark:text-slate-200">Fonctionnement 100% Autonome & Hors-Ligne</div>
                <p class="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                  Cette caisse fonctionne de manière indépendante avec sa base de données locale. Aucune connexion réseau ni support amovible n'est utilisé. Idéal pour un foyer avec un seul poste informatique.
                </p>
              </div>
            </div>
            <span class="px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-black border border-emerald-500/20 flex-shrink-0 text-center">
              Prêt pour encaissement
            </span>
          </div>
        ` : ''}

        <!-- 2. Vue Mode Réseau Local (LAN) -->
        ${syncConfig.mode === 'lan' ? `
          <div class="space-y-4">
            <!-- Sélecteur Rôle LAN (Serveur vs Client) -->
            <div class="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3 flex-wrap">
              <button 
                type="button" 
                data-lan-role="server"
                class="px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  syncConfig.lan.role === 'server'
                    ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                }"
              >
                ${Icons.server('w-3.5 h-3.5')}
                <span>Serveur Hôte (Caisse Principale du Foyer)</span>
              </button>
              <button 
                type="button" 
                data-lan-role="client"
                class="px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  syncConfig.lan.role === 'client'
                    ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                }"
              >
                ${Icons.wifi('w-3.5 h-3.5')}
                <span>Client Réseau (Vie Scolaire / Bureau MDL)</span>
              </button>
            </div>

            <!-- Sous-vue Serveur Hôte -->
            ${syncConfig.lan.role === 'server' ? `
              <div class="grid grid-cols-1 md:grid-cols-12 gap-4">
                <!-- Bloc Statut & Adresse IP détectée (7 col) -->
                <div class="md:col-span-7 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 space-y-3">
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                      <span class="w-3 h-3 rounded-full ${isServerRunning ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50 animate-pulse' : 'bg-slate-400'}"></span>
                      <span class="text-xs font-extrabold text-slate-800 dark:text-slate-200">
                        ${isServerRunning ? 'Serveur LAN en écoute active' : 'Serveur LAN inactif'}
                      </span>
                    </div>
                    <button 
                      type="button" 
                      id="btn-refresh-local-ip"
                      class="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer" 
                      title="Réactualiser l'adresse IP locale"
                    >
                      ${Icons.refresh('w-3.5 h-3.5')}
                    </button>
                  </div>

                  <!-- Affichage de l'URL à copier pour les clients -->
                  <div class="space-y-1">
                    <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Adresse URL à renseigner sur les postes clients
                    </label>
                    <div class="flex items-center rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-1.5 focus-within:border-orange-500 transition-colors">
                      <span class="font-mono text-xs font-black text-orange-600 dark:text-orange-400 px-2 flex-1 select-all truncate" id="text-server-full-url">
                        http://${serverIp}:${serverPort}
                      </span>
                      <button 
                        type="button" 
                        id="btn-copy-server-url"
                        class="px-2.5 py-1 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 text-orange-600 dark:text-orange-400 text-[11px] font-extrabold border border-orange-500/20 transition-all flex items-center gap-1 cursor-pointer flex-shrink-0"
                      >
                        ${Icons.clipboardCheck('w-3.5 h-3.5')}
                        <span id="btn-copy-server-text">Copier</span>
                      </button>
                    </div>
                  </div>

                  <p class="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    Les ordinateurs connectés au même réseau Wi-Fi ou câble Ethernet peuvent se synchroniser en direct dès que le serveur est démarré.
                  </p>
                </div>

                <!-- Bloc Configuration Port & PIN + Bouton On/Off (5 col) -->
                <div class="md:col-span-5 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 flex flex-col justify-between gap-3">
                  <div class="space-y-2.5">
                    <div class="grid grid-cols-2 gap-2">
                      <div class="space-y-1">
                        <label for="input-lan-server-port" class="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Port d'écoute</label>
                        <input 
                          type="number" 
                          id="input-lan-server-port" 
                          value="${serverPort}" 
                          min="1024" 
                          max="65535"
                          class="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold text-slate-800 dark:text-white outline-none focus:border-orange-500"
                        />
                      </div>
                      <div class="space-y-1">
                        <label for="input-lan-server-pin" class="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Code PIN (Optionnel)</label>
                        <input 
                          type="text" 
                          id="input-lan-server-pin" 
                          value="${escapeHtml(syncConfig.lan.pin)}" 
                          placeholder="ex: 1234"
                          maxlength="16"
                          class="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold text-slate-800 dark:text-white outline-none focus:border-orange-500"
                        />
                      </div>
                    </div>
                  </div>

                  <button 
                    type="button" 
                    id="btn-toggle-lan-server"
                    class="w-full py-2.5 px-3 rounded-xl font-extrabold text-xs tracking-wide transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm ${
                      isServerRunning
                        ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/20'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20'
                    }"
                  >
                    ${isServerRunning ? Icons.pause('w-4 h-4') : Icons.play('w-4 h-4')}
                    <span>${isServerRunning ? 'Arrêter le Serveur LAN' : 'Démarrer le Serveur LAN'}</span>
                  </button>
                </div>
              </div>
            ` : `
              <!-- Sous-vue Client Réseau -->
              <div class="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 space-y-4">
                <div class="grid grid-cols-1 md:grid-cols-12 gap-3">
                  <div class="md:col-span-6 space-y-1">
                    <label for="input-lan-client-url" class="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">
                      Adresse URL du Serveur de Caisse
                    </label>
                    <input 
                      type="text" 
                      id="input-lan-client-url" 
                      value="${escapeHtml(syncConfig.lan.serverUrl)}" 
                      placeholder="http://192.168.1.50:4123"
                      class="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono font-medium text-slate-800 dark:text-white outline-none focus:border-orange-500"
                    />
                  </div>

                  <div class="md:col-span-3 space-y-1">
                    <label for="input-lan-client-pin" class="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">
                      Code PIN (si configuré)
                    </label>
                    <input 
                      type="text" 
                      id="input-lan-client-pin" 
                      value="${escapeHtml(syncConfig.lan.pin)}" 
                      placeholder="Vide si aucun PIN"
                      class="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono font-medium text-slate-800 dark:text-white outline-none focus:border-orange-500"
                    />
                  </div>

                  <div class="md:col-span-3 space-y-1">
                    <label for="select-lan-auto-sync" class="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">
                      Synchro Automatique
                    </label>
                    <select 
                      id="select-lan-auto-sync"
                      class="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-800 dark:text-white outline-none focus:border-orange-500 cursor-pointer"
                    >
                      <option value="0" ${syncConfig.lan.autoSyncInterval === 0 ? 'selected' : ''}>Manuelle uniquement</option>
                      <option value="10" ${syncConfig.lan.autoSyncInterval === 10 ? 'selected' : ''}>Toutes les 10 secondes</option>
                      <option value="30" ${syncConfig.lan.autoSyncInterval === 30 ? 'selected' : ''}>Toutes les 30 secondes</option>
                      <option value="60" ${syncConfig.lan.autoSyncInterval === 60 ? 'selected' : ''}>Toutes les 60 secondes</option>
                    </select>
                  </div>
                </div>

                <!-- Boutons Tester et Synchroniser -->
                <div class="flex items-center justify-between gap-3 pt-1 flex-wrap">
                  <div class="flex items-center gap-2">
                    <button 
                      type="button" 
                      id="btn-test-lan-client"
                      class="px-3.5 py-2 rounded-xl bg-slate-200/80 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      ${Icons.wifi('w-3.5 h-3.5')}
                      <span>Tester la connexion</span>
                    </button>

                    <button 
                      type="button" 
                      id="btn-sync-lan-now"
                      class="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-extrabold text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-sm shadow-orange-600/20 active:scale-[0.98]"
                    >
                      ${Icons.refresh('w-3.5 h-3.5')}
                      <span>Synchroniser maintenant</span>
                    </button>
                  </div>

                  ${syncService.lastSyncTime ? `
                    <div class="text-[11px] font-mono text-slate-400 flex items-center gap-1.5">
                      <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
                      <span>Dernière synchro : ${syncService.lastSyncTime}</span>
                    </div>
                  ` : ''}
                </div>
              </div>
            `}
          </div>
        ` : ''}

        <!-- 3. Vue Mode Clé USB / Fichier Partagé -->
        ${syncConfig.mode === 'usb' ? `
          <div class="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 space-y-4">
            <div class="space-y-1.5">
              <label for="input-usb-filepath" class="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">
                Chemin d'accès au fichier de synchronisation (Clé USB ou lecteur réseau partagé P:\\)
              </label>
              <div class="flex items-center gap-2">
                <input 
                  type="text" 
                  id="input-usb-filepath" 
                  value="${escapeHtml(syncConfig.usb.filePath)}" 
                  placeholder="/media/usb/openmdl_sync.json ou E:\\openmdl_sync.json"
                  class="flex-1 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono font-medium text-slate-800 dark:text-white outline-none focus:border-orange-500"
                />
              </div>
              <p class="text-[11px] text-slate-400 leading-relaxed">
                Renseignez le chemin complet du fichier JSON (ex: sous Windows <code>E:\openmdl_sync.json</code>, sous Linux <code>/media/usb/openmdl_sync.json</code>).
              </p>
            </div>

            <div class="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between gap-3">
              <div>
                <div class="text-xs font-bold text-slate-800 dark:text-slate-200">Export automatique lors de la clôture de caisse</div>
                <div class="text-[10px] text-slate-400">Écrit automatiquement l'état à jour sur la clé dès qu'un bénévole ferme sa session</div>
              </div>
              <input 
                type="checkbox" 
                id="check-usb-auto-close" 
                ${syncConfig.usb.autoSyncOnClose ? 'checked' : ''} 
                class="w-4 h-4 rounded text-orange-600 focus:ring-orange-500 cursor-pointer accent-orange-600"
              />
            </div>

            <div class="flex items-center justify-between gap-3 pt-1 flex-wrap">
              <div class="flex items-center gap-2">
                <button 
                  type="button" 
                  id="btn-export-usb"
                  class="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-sm shadow-emerald-600/20 active:scale-[0.98]"
                >
                  ${Icons.save('w-3.5 h-3.5')}
                  <span>Exporter la base vers la clé USB</span>
                </button>

                <button 
                  type="button" 
                  id="btn-import-usb"
                  class="px-4 py-2 rounded-xl bg-slate-200/80 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  ${Icons.download('w-3.5 h-3.5')}
                  <span>Importer depuis la clé USB</span>
                </button>
              </div>

              ${syncService.lastSyncTime ? `
                <div class="text-[11px] font-mono text-slate-400 flex items-center gap-1.5">
                  <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span>Dernière opération : ${syncService.lastSyncTime}</span>
                </div>
              ` : ''}
            </div>
          </div>
        ` : ''}
      </div>

      <!-- Grille Principale Réorganisée (Disposition ultra-optimisée anti-scroll et sans vide) -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 min-h-0">
        
        <!-- ==================== LIGNE 1 : ÉQUIPE & UTILISATEURS ==================== -->
        
        <!-- 1.1 Formulaire de Création d'Utilisateur (5 colonnes) -->
        <div class="lg:col-span-5 flex flex-col">
          <div class="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-3.5 h-full flex flex-col justify-between">
            
            <div class="space-y-3">
              <div class="flex items-center gap-2 text-xs font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                ${Icons.userPlus('w-4 h-4 text-orange-500')}
                <span>Créer un nouvel utilisateur</span>
              </div>

              <p class="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Le délégué saisit les informations du bénévole (par exemple Jérémy) avec le mot de passe choisi par ce dernier.
              </p>

              <form id="create-user-form" class="space-y-3">
                
                <!-- Nom complet -->
                <div class="space-y-1">
                  <label for="new-user-name" class="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase">
                    Nom et prénom
                  </label>
                  <input 
                    type="text" 
                    id="new-user-name" 
                    required
                    placeholder="ex: Jérémy Martin"
                    class="w-full px-3.5 py-2 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-900 dark:text-white outline-none focus:border-orange-500 transition-colors placeholder:text-slate-400"
                  />
                </div>

                <!-- Identifiant -->
                <div class="space-y-1">
                  <label for="new-user-username" class="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase">
                    Identifiant de connexion (unique)
                  </label>
                  <div class="relative">
                    <span class="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 font-mono text-xs">@</span>
                    <input 
                      type="text" 
                      id="new-user-username" 
                      required
                      placeholder="ex: jeremy"
                      class="w-full pl-7 pr-3.5 py-2 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-mono font-medium text-slate-900 dark:text-white outline-none focus:border-orange-500 transition-colors placeholder:text-slate-400"
                    />
                  </div>
                </div>

                <!-- Mot de passe -->
                <div class="space-y-1">
                  <label for="new-user-password" class="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase">
                    Mot de passe de connexion
                  </label>
                  <input 
                    type="text" 
                    id="new-user-password" 
                    required
                    placeholder="Choisi avec le lycéen"
                    class="w-full px-3.5 py-2 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-mono font-medium text-slate-900 dark:text-white outline-none focus:border-orange-500 transition-colors placeholder:text-slate-400"
                  />
                </div>

                <!-- Rôle au sein de la MDL -->
                <div class="space-y-1">
                  <label for="new-user-role" class="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase">
                    Rôle ou fonction au foyer
                  </label>
                  <select 
                    id="new-user-role" 
                    class="w-full px-3 py-2 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-900 dark:text-white outline-none focus:border-orange-500 transition-colors"
                  >
                    <option value="Bénévole Permanence">Bénévole Permanence</option>
                    <option value="Membre CVL">Membre CVL</option>
                    <option value="Trésorier MDL">Trésorier MDL</option>
                    <option value="Secrétaire MDL">Secrétaire MDL</option>
                    <option value="Délégué élu CVL">Délégué élu CVL</option>
                  </select>
                </div>

                <!-- Privilèges Admin -->
                <div class="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between gap-3">
                  <div class="flex items-center gap-2">
                    ${Icons.shield('w-4 h-4 text-orange-500')}
                    <div>
                      <div class="text-xs font-bold text-slate-800 dark:text-slate-200">Droits Délégué Admin (CVL)</div>
                      <div class="text-[10px] text-slate-400">Accès à cette page des réglages</div>
                    </div>
                  </div>
                  <input 
                    type="checkbox" 
                    id="new-user-is-admin" 
                    class="w-4 h-4 rounded text-orange-600 focus:ring-orange-500 cursor-pointer accent-orange-600"
                  />
                </div>

                <button 
                  type="submit" 
                  class="w-full py-2.5 px-4 rounded-2xl bg-orange-600 hover:bg-orange-500 text-white font-extrabold text-xs tracking-wide shadow-md shadow-orange-600/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  ${Icons.userPlus('w-4 h-4')}
                  <span>Créer le compte utilisateur</span>
                </button>
              </form>
            </div>

          </div>
        </div>

        <!-- 1.2 Liste & Gestion des Utilisateurs (7 colonnes) -->
        <div class="lg:col-span-7 flex flex-col">
          <div class="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-sm flex flex-col h-full">
            
            <div class="flex items-center justify-between pb-3.5 border-b border-slate-100 dark:border-slate-800">
              <div class="flex items-center gap-2">
                ${Icons.users('w-4 h-4 text-orange-500')}
                <h2 class="text-xs font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                  Comptes Enregistrés (${volunteers.length})
                </h2>
              </div>
              <span class="text-[11px] text-slate-400 font-medium">
                Connecté en tant que: <strong class="text-slate-700 dark:text-slate-200">${currentVolunteer?.name || 'Admin'}</strong>
              </span>
            </div>

            <!-- Liste des utilisateurs avec scroll élégant -->
            <div class="space-y-2 overflow-y-auto pt-3 flex-1 pr-1 max-h-[380px]">
              ${volunteers.map(v => {
                const isCurrent = v.id === currentVolunteer?.id;
                const isSuspended = !!v.isSuspended;
                const isEditingPassword = this.editingPasswordUserId === v.id;
                const isEditingName = this.editingNameUserId === v.id;

                return `
                  <div class="p-3 rounded-2xl border ${isSuspended
                    ? 'border-rose-200 dark:border-rose-950/60 bg-rose-50/30 dark:bg-rose-950/10'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-850/60'
                  } transition-all space-y-2">
                    
                    <div class="flex items-center justify-between gap-3 flex-wrap">
                      
                      <!-- Infos utilisateur -->
                      <div class="flex items-center gap-2.5 min-w-0">
                        <div class="w-8 h-8 rounded-xl flex items-center justify-center text-white font-black text-xs shadow-xs flex-shrink-0" style="background-color: ${v.avatarColor}">
                          ${v.name.charAt(0)}
                        </div>
                        
                        <div class="min-w-0">
                          <div class="flex items-center gap-2 flex-wrap">
                            <span class="font-extrabold text-xs text-slate-900 dark:text-white truncate">
                              ${escapeHtml(v.name)}
                            </span>
                            <span class="font-mono text-[11px] text-slate-400">
                              @${escapeHtml(v.username)}
                            </span>
                            ${isCurrent ? `
                              <span class="px-1.5 py-0.2 rounded-md bg-orange-500/10 text-orange-600 dark:text-orange-400 text-[9px] font-bold border border-orange-500/20">
                                Vous
                              </span>
                            ` : ''}
                          </div>
                          
                          <div class="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                            <span>${escapeHtml(v.role)}</span>
                            <span>•</span>
                            <div class="flex items-center gap-1 font-mono text-[10px] text-slate-400">
                              <span>Mot de passe:</span>
                              <span class="${this.revealedPasswords.has(v.id) ? 'text-amber-600 dark:text-amber-400 font-bold bg-amber-500/10 px-1.5 py-0.2 rounded border border-amber-500/20 font-mono text-xs' : 'font-bold tracking-widest text-slate-500'}">
                                ${this.revealedPasswords.has(v.id) ? escapeHtml(v.password) : '••••••••'}
                              </span>
                              <button 
                                type="button" 
                                data-toggle-reveal-pwd="${v.id}"
                                class="p-0.5 rounded text-slate-400 hover:text-orange-500 hover:bg-slate-200 dark:hover:bg-slate-800 transition-all cursor-pointer"
                                title="${this.revealedPasswords.has(v.id) ? 'Masquer' : 'Afficher'}"
                              >
                                ${this.revealedPasswords.has(v.id) ? Icons.eyeOff('w-3 h-3') : Icons.eye('w-3 h-3')}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>

                      <!-- Badges Statut & Rôle -->
                      <div class="flex items-center gap-1.5 flex-shrink-0">
                        ${v.isAdmin ? `
                          <span class="px-2 py-0.5 rounded-lg bg-orange-500/15 text-orange-600 dark:text-orange-400 font-extrabold text-[10px] border border-orange-500/20 flex items-center gap-1">
                            ${Icons.shield('w-3 h-3')}
                            Délégué CVL
                          </span>
                        ` : `
                          <span class="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold text-[10px]">
                            Bénévole
                          </span>
                        `}

                        ${isSuspended ? `
                          <span class="px-2 py-0.5 rounded-lg bg-rose-500/15 text-rose-600 dark:text-rose-400 font-extrabold text-[10px] border border-rose-500/20 flex items-center gap-1">
                            ${Icons.userX('w-3 h-3')}
                            Suspendu
                          </span>
                        ` : `
                          <span class="px-2 py-0.5 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-extrabold text-[10px] border border-emerald-500/20 flex items-center gap-1">
                            ${Icons.check('w-3 h-3')}
                            Actif
                          </span>
                        `}
                      </div>
                    </div>

                    <!-- Barre d'actions -->
                    <div class="pt-1.5 border-t border-slate-200/60 dark:border-slate-800 flex items-center justify-between gap-2 flex-wrap">
                      
                      <div class="flex items-center gap-1.5">
                        <!-- Bouton modifier le nom / pseudo -->
                        <button 
                          type="button" 
                          data-toggle-name-edit="${v.id}"
                          class="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
                          title="Modifier le nom affiché"
                        >
                          ${Icons.userCheck('w-3 h-3 text-slate-500')}
                          <span>${isEditingName ? 'Annuler' : 'Modifier nom'}</span>
                        </button>

                        <!-- Bouton modifier le mot de passe -->
                        <button 
                          type="button" 
                          data-toggle-pwd-edit="${v.id}"
                          class="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          ${Icons.key('w-3 h-3 text-slate-500')}
                          <span>${isEditingPassword ? 'Annuler' : 'Modifier mot de passe'}</span>
                        </button>
                      </div>

                      <div class="flex items-center gap-1.5">
                        
                        <!-- Suspendre / Activer -->
                        ${!isCurrent ? `
                          <button 
                            type="button" 
                            data-action-suspend="${v.id}"
                            class="px-2 py-1 rounded-lg ${isSuspended
                              ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                              : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/20'
                            } font-bold text-[11px] transition-colors cursor-pointer flex items-center gap-1"
                          >
                            <span>${isSuspended ? 'Réactiver' : 'Suspendre'}</span>
                          </button>

                          <!-- Supprimer -->
                          <button 
                            type="button" 
                            data-action-delete="${v.id}"
                            data-action-delete-name="${v.name}"
                            class="px-2 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 font-bold text-[11px] transition-colors cursor-pointer flex items-center gap-1"
                            title="Supprimer ce compte définitivement"
                          >
                            ${Icons.trash('w-3 h-3')}
                            <span>Supprimer</span>
                          </button>
                        ` : `
                          <span class="text-[10px] font-medium text-slate-400 italic">
                            Compte principal (protégé)
                          </span>
                        `}
                      </div>
                    </div>

                    <!-- Sous-formulaire de modification de mot de passe si actif -->
                    ${isEditingPassword ? `
                      <form data-form-reset-pwd="${v.id}" class="mt-1.5 p-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center gap-2 animate-enter">
                        <input 
                          type="text" 
                          placeholder="Nouveau mot de passe" 
                          required
                          data-input-new-pass="${v.id}"
                          class="flex-1 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono font-medium text-slate-900 dark:text-white outline-none focus:border-orange-500"
                        />
                        <button 
                          type="submit" 
                          class="px-2.5 py-1 rounded-lg bg-orange-600 hover:bg-orange-500 text-white font-extrabold text-xs shadow-xs cursor-pointer"
                        >
                          Enregistrer
                        </button>
                      </form>
                    ` : ''}

                    <!-- Sous-formulaire de modification de nom si actif -->
                    ${isEditingName ? `
                      <form data-form-edit-name="${v.id}" class="mt-1.5 p-2 rounded-xl bg-orange-500/10 dark:bg-orange-950/30 border border-orange-500/30 flex items-center gap-2 animate-enter">
                        <input 
                          type="text" 
                          value="${escapeHtml(v.name)}" 
                          placeholder="Nouveau nom (ex: Adrien M.)" 
                          required
                          data-input-new-name="${v.id}"
                          class="flex-1 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-orange-500"
                        />
                        <button 
                          type="submit" 
                          class="px-3 py-1 rounded-lg bg-orange-600 hover:bg-orange-500 text-white font-extrabold text-xs shadow-xs cursor-pointer flex-shrink-0"
                        >
                          Enregistrer
                        </button>
                      </form>
                    ` : ''}

                  </div>
                `;
              }).join('')}
            </div>

          </div>
        </div>


        <!-- ==================== LIGNE 2 : CAISSE & OUTILS SYSTÈME ==================== -->

        <!-- 2.1 Fond de Caisse & Décaisse Programmée (7 colonnes : espace optimal pour billets/pièces) -->
        <div class="lg:col-span-7 flex flex-col">
          <div class="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-3.5 h-full flex flex-col justify-between">
            <div class="space-y-3">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2 text-xs font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                  ${Icons.coins('w-4 h-4 text-orange-500')}
                  <span>Fond de Caisse & Décaisse Programmée</span>
                </div>
                <span id="badge-cash-float-active" class="text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${cashFloatSettings.enabled ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' : 'bg-slate-500/10 text-slate-500 border border-slate-500/20'}">
                  ${cashFloatSettings.enabled ? 'Actif' : 'Désactivé'}
                </span>
              </div>

              <p class="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                Définissez la composition cible du tiroir-caisse. L'application calcule le montant exact à décaisser pour la banque à chaque clôture.
              </p>

              <form id="cash-float-settings-form" class="space-y-3.5 pt-0.5">
                <!-- Toggle Activer / Désactiver -->
                <div 
                  id="row-cash-float-enabled" 
                  class="p-3 rounded-2xl bg-slate-50 hover:bg-slate-100/80 dark:bg-slate-800/50 dark:hover:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between gap-3 cursor-pointer transition-colors"
                >
                  <div>
                    <div class="text-xs font-bold text-slate-800 dark:text-slate-200">Activer le module de fond de caisse & décaisse</div>
                    <div class="text-[10px] text-slate-400">Assiste les bénévoles lors du comptage et de la décaisse</div>
                  </div>
                  <div class="flex items-center gap-2">
                    <span id="label-cash-float-enabled" class="text-[10px] font-black uppercase ${cashFloatSettings.enabled ? 'text-emerald-500' : 'text-slate-400'}">
                      ${cashFloatSettings.enabled ? 'Activé' : 'Désactivé'}
                    </span>
                    <button 
                      type="button" 
                      id="btn-toggle-cash-float-enabled"
                      class="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out ${cashFloatSettings.enabled ? 'bg-orange-600' : 'bg-slate-300 dark:bg-slate-700'}"
                    >
                      <span id="dot-cash-float-enabled" class="inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition duration-200 ease-in-out my-0.5 ml-0.5 ${cashFloatSettings.enabled ? 'translate-x-5' : 'translate-x-0'}"></span>
                    </button>
                  </div>
                </div>

                <!-- Options dépliables -->
                <div id="cash-float-options-collapsible" class="space-y-3.5 ${cashFloatSettings.enabled ? 'block' : 'hidden'}">
                  
                  ${carriedDifferencesEntries.length > 0 ? `
                    <div class="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <div class="flex items-start gap-2">
                        <div class="text-amber-600 dark:text-amber-400 pt-0.5">
                          ${Icons.alertTriangle('w-4 h-4')}
                        </div>
                        <div>
                          <div class="text-xs font-bold text-amber-800 dark:text-amber-300">
                            Écarts / manques en cours de report (${carriedDifferencesEntries.length})
                          </div>
                          <div class="text-[10px] text-amber-700/80 dark:text-amber-400/80 font-mono mt-0.5">
                            ${carriedDifferencesEntries.map(([id, diff]) => {
                              const denom = EURO_DENOMINATIONS.find(d => d.id === id);
                              const sign = diff > 0 ? `+${diff}` : `${diff}`;
                              return `${denom?.label || id}: ${sign}`;
                            }).join(' • ')}
                          </div>
                        </div>
                      </div>
                      <button 
                        type="button" 
                        id="btn-reset-carried-deficits" 
                        class="px-2.5 py-1 rounded-xl bg-amber-600/15 hover:bg-amber-600/25 text-amber-800 dark:text-amber-300 border border-amber-500/30 text-[10px] font-extrabold uppercase tracking-wide transition-colors cursor-pointer flex-shrink-0"
                      >
                        Remettre à zéro
                      </button>
                    </div>
                  ` : ''}

                  <!-- Grille Billets -->
                  <div class="space-y-1.5">
                    <div class="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      ${Icons.banknote('w-3.5 h-3.5 text-orange-500')}
                      <span>Billets prévus au fond</span>
                    </div>
                    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      ${EURO_DENOMINATIONS.filter(d => d.type === 'bill').map(d => {
                        const count = cashFloatSettings.baseCounts[d.id] || 0;
                        const subtotal = count * d.value;
                        return `
                          <div class="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex flex-col justify-between gap-1.5">
                            <div class="flex items-center justify-between">
                              <span class="px-1.5 py-0.2 rounded-md bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20 text-[11px] font-black font-mono">
                                ${d.label}
                              </span>
                              <span data-base-subtotal="${d.id}" id="base-subtotal-${d.id.replace('.', '_')}" class="text-[10px] font-mono font-bold text-slate-400">
                                ${subtotal.toFixed(2)} €
                              </span>
                            </div>
                            <div class="flex items-center gap-1">
                              <button type="button" data-cash-step-down="${d.id}" class="w-6 h-6 rounded-lg bg-white dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600 font-bold text-xs flex items-center justify-center cursor-pointer transition-colors active:scale-95">
                                -
                              </button>
                              <input 
                                type="number" 
                                min="0" 
                                step="1" 
                                id="base-count-${d.id.replace('.', '_')}" 
                                data-denom-id="${d.id}" 
                                data-denom-value="${d.value}"
                                value="${count}" 
                                class="w-full text-center py-0.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono font-bold text-slate-900 dark:text-white outline-none focus:border-orange-500"
                              />
                              <button type="button" data-cash-step-up="${d.id}" class="w-6 h-6 rounded-lg bg-white dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600 font-bold text-xs flex items-center justify-center cursor-pointer transition-colors active:scale-95">
                                +
                              </button>
                            </div>
                          </div>
                        `;
                      }).join('')}
                    </div>
                  </div>

                  <!-- Grille Pièces -->
                  <div class="space-y-1.5">
                    <div class="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      ${Icons.coins('w-3.5 h-3.5 text-orange-500')}
                      <span>Pièces prévues au fond</span>
                    </div>
                    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      ${EURO_DENOMINATIONS.filter(d => d.type === 'coin').map(d => {
                        const count = cashFloatSettings.baseCounts[d.id] || 0;
                        const subtotal = count * d.value;
                        return `
                          <div class="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex flex-col justify-between gap-1.5">
                            <div class="flex items-center justify-between">
                              <span class="px-1.5 py-0.2 rounded-md bg-slate-200/60 dark:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-600 text-[11px] font-black font-mono">
                                ${d.label}
                              </span>
                              <span data-base-subtotal="${d.id}" id="base-subtotal-${d.id.replace('.', '_')}" class="text-[10px] font-mono font-bold text-slate-400">
                                ${subtotal.toFixed(2)} €
                              </span>
                            </div>
                            <div class="flex items-center gap-1">
                              <button type="button" data-cash-step-down="${d.id}" class="w-6 h-6 rounded-lg bg-white dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600 font-bold text-xs flex items-center justify-center cursor-pointer transition-colors active:scale-95">
                                -
                              </button>
                              <input 
                                type="number" 
                                min="0" 
                                step="1" 
                                id="base-count-${d.id.replace('.', '_')}" 
                                data-denom-id="${d.id}" 
                                data-denom-value="${d.value}"
                                value="${count}" 
                                class="w-full text-center py-0.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono font-bold text-slate-900 dark:text-white outline-none focus:border-orange-500"
                              />
                              <button type="button" data-cash-step-up="${d.id}" class="w-6 h-6 rounded-lg bg-white dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600 font-bold text-xs flex items-center justify-center cursor-pointer transition-colors active:scale-95">
                                +
                              </button>
                            </div>
                          </div>
                        `;
                      }).join('')}
                    </div>
                  </div>

                  <!-- Récapitulatif Fond Total Programmé -->
                  <div class="p-3.5 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-between">
                    <div class="flex items-center gap-2">
                      <div class="w-7 h-7 rounded-lg bg-orange-500/20 text-orange-600 dark:text-orange-400 flex items-center justify-center font-bold">
                        ${Icons.coins('w-3.5 h-3.5')}
                      </div>
                      <div>
                        <div class="text-[10px] font-extrabold uppercase text-slate-500 dark:text-slate-400">Total Fond de Caisse</div>
                        <div class="text-[9px] text-slate-400">Montant constant dans le tiroir</div>
                      </div>
                    </div>
                    <div class="text-right">
                      <span id="base-cash-float-total" class="text-lg font-black font-mono text-orange-600 dark:text-orange-400">
                        ${baseCashFloatTotal.toFixed(2)} €
                      </span>
                    </div>
                  </div>

                  <button 
                    type="submit" 
                    id="btn-save-cash-float-settings"
                    class="w-full py-2.5 px-4 rounded-2xl bg-orange-600 hover:bg-orange-500 text-white font-extrabold text-xs tracking-wide shadow-md shadow-orange-600/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    ${Icons.save('w-4 h-4')}
                    <span>Enregistrer le fond de caisse cible</span>
                  </button>

                </div>
              </form>
            </div>
          </div>
        </div>

        <!-- 2.2 Colonne Droite : Cartes Complémentaires Compactes Empilées (5 colonnes) -->
        <div class="lg:col-span-5 flex flex-col gap-4">

          <!-- 2.2.1 Carte Collation Bénévole (Conso Offerte) -->
          <div class="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-3">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2 text-xs font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                ${Icons.gift('w-4 h-4 text-orange-500')}
                <span>Collation Bénévole (Conso Offerte)</span>
              </div>
              <span id="badge-perk-active" class="text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${perkSettings.enabled ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' : 'bg-slate-500/10 text-slate-500 border border-slate-500/20'}">
                ${perkSettings.enabled ? 'Active' : 'Désactivée'}
              </span>
            </div>

            <p class="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Récompensez les bénévoles de permanence au foyer par une boisson ou un snack offert.
            </p>

            <form id="perk-settings-form" class="space-y-3 pt-0.5">
              <!-- Toggle Activer / Désactiver -->
              <div 
                id="row-perk-enabled" 
                class="p-3 rounded-2xl bg-slate-50 hover:bg-slate-100/80 dark:bg-slate-800/50 dark:hover:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between gap-3 cursor-pointer transition-colors"
              >
                <div>
                  <div class="text-xs font-bold text-slate-800 dark:text-slate-200">Autoriser la collation offerte</div>
                  <div class="text-[10px] text-slate-400">1 boisson ou snack gratuit pour les bénévoles</div>
                </div>
                <div class="flex items-center gap-2">
                  <span id="label-perk-enabled" class="text-[10px] font-black uppercase ${perkSettings.enabled ? 'text-emerald-500' : 'text-slate-400'}">
                    ${perkSettings.enabled ? 'Activé' : 'Désactivé'}
                  </span>
                  <button 
                    type="button" 
                    id="btn-toggle-perk-enabled"
                    class="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out ${perkSettings.enabled ? 'bg-orange-600' : 'bg-slate-300 dark:bg-slate-700'}"
                  >
                    <span id="dot-perk-enabled" class="inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition duration-200 ease-in-out my-0.5 ml-0.5 ${perkSettings.enabled ? 'translate-x-5' : 'translate-x-0'}"></span>
                  </button>
                </div>
              </div>

              <!-- Options dépliables : masquées si la collation est désactivée -->
              <div id="perk-options-collapsible" class="space-y-3 pt-0.5 ${perkSettings.enabled ? 'block' : 'hidden'}">
                <!-- Choix de la Règle -->
                <div class="space-y-1">
                  <label for="perk-rule-select" class="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase">
                    Condition d'obtention
                  </label>
                  <select 
                    id="perk-rule-select" 
                    class="w-full px-3 py-2 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-900 dark:text-white outline-none focus:border-orange-500 transition-colors cursor-pointer ${!perkSettings.enabled ? 'opacity-50 cursor-not-allowed' : ''}"
                    ${!perkSettings.enabled ? 'disabled' : ''}
                  >
                    <option value="items_sold" ${perkSettings.rule === 'items_sold' ? 'selected' : ''}>Nombre d'articles vendus (ex: 10 canettes)</option>
                    <option value="sales_count" ${perkSettings.rule === 'sales_count' ? 'selected' : ''}>Nombre de ventes (ex: 10 transactions)</option>
                    <option value="always" ${perkSettings.rule === 'always' ? 'selected' : ''}>Toujours offerte (Sans condition)</option>
                  </select>
                </div>

                <!-- Seuil requis -->
                <div id="perk-threshold-container" class="space-y-1 ${perkSettings.rule === 'always' ? 'hidden' : 'block'}">
                  <label for="perk-threshold-input" class="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase">
                    Objectif / Seuil requis
                  </label>
                  <div class="flex items-center rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 overflow-hidden focus-within:border-orange-500 transition-colors ${!perkSettings.enabled ? 'opacity-50' : ''}">
                    <input 
                      type="number" 
                      id="perk-threshold-input" 
                      min="1" 
                      max="500" 
                      value="${perkSettings.threshold}" 
                      class="flex-1 px-3 py-2 bg-transparent text-xs font-mono font-bold text-slate-900 dark:text-white outline-none"
                      ${!perkSettings.enabled ? 'disabled' : ''}
                    />
                    <span class="px-3 py-2 text-xs font-bold text-slate-400 bg-slate-100/80 dark:bg-slate-700/50 border-l border-slate-200 dark:border-slate-700 flex-shrink-0" id="perk-threshold-unit">
                      ${perkSettings.rule === 'items_sold' ? 'articles' : 'ventes'}
                    </span>
                  </div>
                </div>

                <!-- Limite quotidienne -->
                <div 
                  id="row-perk-daily-limit" 
                  class="p-3 rounded-2xl bg-slate-50 hover:bg-slate-100/80 dark:bg-slate-800/50 dark:hover:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between gap-3 cursor-pointer transition-colors ${!perkSettings.enabled ? 'opacity-50 cursor-not-allowed' : ''}"
                >
                  <div>
                    <div class="text-xs font-bold text-slate-800 dark:text-slate-200">Plafond journalier strict</div>
                    <div class="text-[10px] text-slate-400">Maximum 1 seule collation offerte / jour</div>
                  </div>
                  <div class="flex items-center gap-2">
                    <span id="label-perk-daily-limit" class="text-[10px] font-black uppercase ${!perkSettings.allowMultiplePerDay ? 'text-emerald-500' : 'text-slate-400'}">
                      ${!perkSettings.allowMultiplePerDay ? '1 max' : 'Illimité'}
                    </span>
                    <button 
                      type="button" 
                      id="btn-toggle-perk-daily-limit"
                      class="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out ${!perkSettings.allowMultiplePerDay ? 'bg-orange-600' : 'bg-slate-300 dark:bg-slate-700'}"
                      ${!perkSettings.enabled ? 'disabled' : ''}
                    >
                      <span id="dot-perk-daily-limit" class="inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition duration-200 ease-in-out my-0.5 ml-0.5 ${!perkSettings.allowMultiplePerDay ? 'translate-x-5' : 'translate-x-0'}"></span>
                    </button>
                  </div>
                </div>

                <button 
                  type="submit" 
                  id="btn-save-perk-settings"
                  class="w-full py-2 px-4 rounded-2xl bg-orange-600 hover:bg-orange-500 text-white font-extrabold text-xs tracking-wide shadow-md shadow-orange-600/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  ${Icons.save('w-4 h-4')}
                  <span>Enregistrer les critères de collation</span>
                </button>
              </div>
            </form>
          </div>

          <!-- 2.2.2 Carte Mise à Jour du Logiciel (Tauri Auto-Updater) -->
          <div class="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-3" id="card-software-update">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2 text-xs font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                ${Icons.refresh('w-4 h-4 text-orange-500')}
                <span>Mise à Jour du Logiciel</span>
              </div>
              <span class="text-[11px] font-mono font-black px-2 py-0.5 rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20">
                v${escapeHtml(updater.getState().currentVersion)}
              </span>
            </div>

            <p class="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Vérification et application des mises à jour signées depuis GitHub.
            </p>

            <div id="updater-state-container" class="pt-0.5">
              <!-- Rendu dynamique géré par renderUpdaterSection -->
            </div>
          </div>

          <!-- 2.2.3 Carte Gestion des Données & Sauvegardes Binaires -->
          <div class="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-3.5">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2 text-xs font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                ${Icons.database('w-4 h-4 text-orange-500')}
                <span>Données & Sauvegardes Binaires</span>
              </div>
              <span class="px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 text-[10px] font-black uppercase border border-orange-500/20">
                Format .mdlb
              </span>
            </div>

            <p class="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
              Exportez ou restaurez la caisse au format binaire optimisé OpenMDL (compression zlib, vérification CRC32 et protection contre la corruption).
            </p>

            <!-- Actions principales de sauvegarde binaire -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button 
                type="button" 
                id="btn-export-backup-mdlb" 
                class="py-2.5 px-3 rounded-2xl bg-orange-600 hover:bg-orange-500 text-white font-extrabold text-xs shadow-md shadow-orange-600/20 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 cursor-pointer text-center"
                title="Exporter une archive binaire .mdlb compressée"
              >
                ${Icons.download('w-3.5 h-3.5')}
                <span>Exporter (.mdlb)</span>
              </button>

              <button 
                type="button" 
                id="btn-restore-backup-file" 
                class="py-2.5 px-3 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 font-extrabold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer text-center border border-slate-200 dark:border-slate-700"
                title="Restaurer un fichier .mdlb ou .json"
              >
                ${Icons.upload('w-3.5 h-3.5')}
                <span>Restaurer archive</span>
              </button>
              <input type="file" id="input-restore-backup-file" accept=".mdlb,.json" class="hidden" />
            </div>

            <!-- Actions secondaires : Historique & Démo / RAZ -->
            <div class="pt-1 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-2">
              <button 
                type="button" 
                id="btn-show-backups-history" 
                class="w-full py-2 px-3 rounded-2xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/60 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                ${Icons.clock('w-3.5 h-3.5 text-slate-400')}
                <span>Historique des sauvegardes automatiques</span>
              </button>

              <div class="grid grid-cols-2 gap-2">
                <button 
                  type="button" 
                  id="btn-clean-data" 
                  class="py-1.5 px-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/30 dark:hover:bg-rose-950/50 border border-rose-200/80 dark:border-rose-900/40 text-rose-700 dark:text-rose-300 font-bold text-[11px] transition-all flex items-center justify-center gap-1 cursor-pointer text-center"
                >
                  ${Icons.trash('w-3 h-3')}
                  <span>Remise à zéro</span>
                </button>

                <button 
                  type="button" 
                  id="btn-seed-demo" 
                  class="py-1.5 px-2.5 rounded-xl bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/30 dark:hover:bg-sky-950/50 border border-sky-200/80 dark:border-sky-900/40 text-sky-700 dark:text-sky-300 font-bold text-[11px] transition-all flex items-center justify-center gap-1 cursor-pointer text-center"
                >
                  ${Icons.trendingUp('w-3 h-3')}
                  <span>Charger démo</span>
                </button>
              </div>
            </div>
          </div>

          <!-- Mention discrète en bas de colonne droite -->
          <div class="text-center text-[10px] text-slate-400 dark:text-slate-500 py-0.5">
            OpenMDL v${escapeHtml(updater.getState().currentVersion)} • Logiciel Foyer & CVL • <button type="button" data-action="goto-credits" class="underline hover:text-orange-500 cursor-pointer font-bold">Mentions & Crédits</button>
          </div>

        </div>

      </div>
    `;
  }

  private attachEventListeners(container: HTMLElement): void {
    // Fermer le feedback général
    container.querySelector('#btn-close-feedback')?.addEventListener('click', () => {
      this.feedbackMessage = null;
      this.refresh(container);
    });

    // Fermer le feedback synchronisation
    container.querySelector('#btn-close-sync-feedback')?.addEventListener('click', () => {
      this.syncFeedbackMessage = null;
      this.refresh(container);
    });

    // Sélection du mode de synchronisation (Autonome, LAN, USB)
    container.querySelectorAll('[data-sync-mode]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const mode = (e.currentTarget as HTMLElement).getAttribute('data-sync-mode') as any;
        if (!mode) return;
        await syncService.saveConfig({ mode });
        this.syncFeedbackMessage = null;
        this.refresh(container);
      });
    });

    // Sélection du rôle LAN (Serveur vs Client)
    container.querySelectorAll('[data-lan-role]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const role = (e.currentTarget as HTMLElement).getAttribute('data-lan-role') as any;
        if (!role) return;
        const cfg = syncService.getConfig();
        await syncService.saveConfig({ lan: { ...cfg.lan, role } });
        this.syncFeedbackMessage = null;
        this.refresh(container);
      });
    });

    // Actualiser l'IP locale détectée
    container.querySelector('#btn-refresh-local-ip')?.addEventListener('click', async () => {
      const ip = await syncService.getLocalIp();
      syncService.cachedLocalIp = ip;
      this.refresh(container);
    });

    // Copier l'URL du serveur LAN
    container.querySelector('#btn-copy-server-url')?.addEventListener('click', () => {
      const textEl = container.querySelector('#text-server-full-url');
      if (textEl) {
        const fullUrl = textEl.textContent?.trim() || '';
        navigator.clipboard.writeText(fullUrl);
        const btnText = container.querySelector('#btn-copy-server-text');
        if (btnText) {
          btnText.textContent = 'Copié !';
          setTimeout(() => { if (btnText) btnText.textContent = 'Copier'; }, 2000);
        }
      }
    });

    // Démarrer / Arrêter le serveur LAN
    container.querySelector('#btn-toggle-lan-server')?.addEventListener('click', async () => {
      const portInput = container.querySelector('#input-lan-server-port') as HTMLInputElement;
      const pinInput = container.querySelector('#input-lan-server-pin') as HTMLInputElement;
      const port = parseInt(portInput?.value || '4123', 10) || 4123;
      const pin = pinInput?.value?.trim() || '';

      const cfg = syncService.getConfig();
      await syncService.saveConfig({
        lan: { ...cfg.lan, port, pin }
      });

      const isRunning = !!syncService.cachedServerStatus?.running;
      if (isRunning) {
        await syncService.stopLanServer();
        this.syncFeedbackMessage = { text: 'Serveur LAN arrêté avec succès.', type: 'info' };
      } else {
        const res = await syncService.startLanServer();
        if (res) {
          this.syncFeedbackMessage = { text: `Serveur LAN démarré sur http://${res.ip}:${res.port}`, type: 'success' };
        } else {
          this.syncFeedbackMessage = { text: 'Erreur lors du démarrage du serveur LAN.', type: 'error' };
        }
      }
      this.refresh(container);
    });

    const saveServerInputs = () => {
      const portInput = container.querySelector('#input-lan-server-port') as HTMLInputElement;
      const pinInput = container.querySelector('#input-lan-server-pin') as HTMLInputElement;
      if (portInput || pinInput) {
        const port = parseInt(portInput?.value || '4123', 10) || 4123;
        const pin = pinInput?.value?.trim() || '';
        const cfg = syncService.getConfig();
        syncService.saveConfig({ lan: { ...cfg.lan, port, pin } });
      }
    };
    container.querySelector('#input-lan-server-port')?.addEventListener('change', saveServerInputs);
    container.querySelector('#input-lan-server-pin')?.addEventListener('change', saveServerInputs);

    // Tester la connexion du client LAN
    container.querySelector('#btn-test-lan-client')?.addEventListener('click', async () => {
      const urlInput = container.querySelector('#input-lan-client-url') as HTMLInputElement;
      const pinInput = container.querySelector('#input-lan-client-pin') as HTMLInputElement;
      const url = urlInput?.value?.trim() || '';
      const pin = pinInput?.value?.trim() || '';

      const cfg = syncService.getConfig();
      await syncService.saveConfig({ lan: { ...cfg.lan, serverUrl: url, pin } });

      const res = await syncService.testLanConnection(url, pin);
      this.syncFeedbackMessage = {
        text: res.message,
        type: res.success ? 'success' : 'error'
      };
      this.refresh(container);
    });

    // Synchroniser immédiatement depuis le client LAN
    container.querySelector('#btn-sync-lan-now')?.addEventListener('click', async () => {
      const urlInput = container.querySelector('#input-lan-client-url') as HTMLInputElement;
      const pinInput = container.querySelector('#input-lan-client-pin') as HTMLInputElement;
      const url = urlInput?.value?.trim() || '';
      const pin = pinInput?.value?.trim() || '';

      const cfg = syncService.getConfig();
      await syncService.saveConfig({ lan: { ...cfg.lan, serverUrl: url, pin } });

      const res = await syncService.syncFromLanServer();
      this.syncFeedbackMessage = {
        text: res.message,
        type: res.success ? 'success' : 'error'
      };
      this.refresh(container);
    });

    // Changement intervalle auto-sync client
    container.querySelector('#select-lan-auto-sync')?.addEventListener('change', async (e) => {
      const val = parseInt((e.target as HTMLSelectElement).value, 10) || 0;
      const cfg = syncService.getConfig();
      await syncService.saveConfig({ lan: { ...cfg.lan, autoSyncInterval: val } });
    });

    // Clé USB : mise à jour du chemin
    container.querySelector('#input-usb-filepath')?.addEventListener('change', async (e) => {
      const val = (e.target as HTMLInputElement).value.trim();
      const cfg = syncService.getConfig();
      await syncService.saveConfig({ usb: { ...cfg.usb, filePath: val } });
    });

    // Clé USB : case export auto lors de la clôture
    container.querySelector('#check-usb-auto-close')?.addEventListener('change', async (e) => {
      const checked = (e.target as HTMLInputElement).checked;
      const cfg = syncService.getConfig();
      await syncService.saveConfig({ usb: { ...cfg.usb, autoSyncOnClose: checked } });
    });

    // Clé USB : export manuel
    container.querySelector('#btn-export-usb')?.addEventListener('click', async () => {
      const pathInput = container.querySelector('#input-usb-filepath') as HTMLInputElement;
      const path = pathInput?.value?.trim() || '';
      if (!path) {
        this.syncFeedbackMessage = { text: 'Veuillez saisir un chemin de fichier pour la clé USB.', type: 'error' };
        this.refresh(container);
        return;
      }
      const cfg = syncService.getConfig();
      await syncService.saveConfig({ usb: { ...cfg.usb, filePath: path } });
      const res = await syncService.exportToUsbFile(path);
      this.syncFeedbackMessage = { text: res.message, type: res.success ? 'success' : 'error' };
      this.refresh(container);
    });

    // Clé USB : import manuel
    container.querySelector('#btn-import-usb')?.addEventListener('click', async () => {
      const pathInput = container.querySelector('#input-usb-filepath') as HTMLInputElement;
      const path = pathInput?.value?.trim() || '';
      if (!path) {
        this.syncFeedbackMessage = { text: 'Veuillez saisir un chemin de fichier pour la clé USB.', type: 'error' };
        this.refresh(container);
        return;
      }
      AppDialog.confirm({
        title: 'Importer depuis la clé USB',
        message: 'Attention : Importer les données depuis la clé USB va écraser les données locales par celles du fichier. Confirmez-vous le rechargement ?',
        type: 'warning',
        confirmText: 'Importer & Écraser',
        cancelText: 'Annuler',
        onConfirm: async () => {
          const cfg = syncService.getConfig();
          await syncService.saveConfig({ usb: { ...cfg.usb, filePath: path } });
          const res = await syncService.importFromUsbFile(path);
          this.syncFeedbackMessage = { text: res.message, type: res.success ? 'success' : 'error' };
          this.refresh(container);
        }
      });
    });

    // Formulaire de création de compte
    const formCreate = container.querySelector('#create-user-form') as HTMLFormElement;
    formCreate?.addEventListener('submit', (e) => {
      e.preventDefault();
      const nameInput = container.querySelector('#new-user-name') as HTMLInputElement;
      const usernameInput = container.querySelector('#new-user-username') as HTMLInputElement;
      const passwordInput = container.querySelector('#new-user-password') as HTMLInputElement;
      const roleSelect = container.querySelector('#new-user-role') as HTMLSelectElement;
      const isAdminCheck = container.querySelector('#new-user-is-admin') as HTMLInputElement;

      if (!nameInput || !usernameInput || !passwordInput || !roleSelect) return;

      const res = db.createUser({
        name: nameInput.value,
        username: usernameInput.value,
        password: passwordInput.value,
        role: roleSelect.value,
        isAdmin: isAdminCheck ? isAdminCheck.checked : false
      });

      this.feedbackMessage = {
        text: res.message,
        type: res.success ? 'success' : 'error'
      };

      if (res.success) {
        formCreate.reset();
      }
      this.refresh(container);
    });

    // Boutons Suspendre / Réactiver
    container.querySelectorAll('[data-action-suspend]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = (e.currentTarget as HTMLElement).getAttribute('data-action-suspend');
        if (!id) return;
        const res = db.toggleSuspendUser(id);
        this.feedbackMessage = {
          text: res.message,
          type: res.success ? 'success' : 'error'
        };
        this.refresh(container);
      });
    });

    // Boutons Supprimer
    container.querySelectorAll('[data-action-delete]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const id = target.getAttribute('data-action-delete');
        const name = target.getAttribute('data-action-delete-name') || 'cet utilisateur';
        if (!id) return;

        AppDialog.confirm({
          title: 'Supprimer l\'utilisateur',
          message: `Confirmez-vous la suppression définitive du compte de ${name} ?`,
          type: 'danger',
          confirmText: 'Supprimer définitivement',
          cancelText: 'Annuler',
          onConfirm: () => {
            const res = db.deleteUser(id);
            this.feedbackMessage = {
              text: res.message,
              type: res.success ? 'success' : 'error'
            };
            this.refresh(container);
          }
        });
      });
    });

    // Boutons bascule modification mot de passe
    container.querySelectorAll('[data-toggle-pwd-edit]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = (e.currentTarget as HTMLElement).getAttribute('data-toggle-pwd-edit');
        if (!id) return;
        this.editingPasswordUserId = this.editingPasswordUserId === id ? null : id;
        this.refresh(container);
      });
    });

    // Formulaire de reset mot de passe
    container.querySelectorAll('[data-form-reset-pwd]').forEach(form => {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const id = (e.currentTarget as HTMLElement).getAttribute('data-form-reset-pwd');
        if (!id) return;
        const input = container.querySelector(`[data-input-new-pass="${id}"]`) as HTMLInputElement;
        if (!input) return;

        const res = db.resetUserPassword(id, input.value);
        this.feedbackMessage = {
          text: res.message,
          type: res.success ? 'success' : 'error'
        };
        this.editingPasswordUserId = null;
        this.refresh(container);
      });
    });

    // Afficher / masquer mot de passe en clair
    container.querySelectorAll('[data-toggle-reveal-pwd]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = (e.currentTarget as HTMLElement).getAttribute('data-toggle-reveal-pwd');
        if (!id) return;
        if (this.revealedPasswords.has(id)) {
          this.revealedPasswords.delete(id);
        } else {
          this.revealedPasswords.add(id);
        }
        this.refresh(container);
      });
    });

    // Toggle édition du nom
    container.querySelectorAll('[data-toggle-name-edit]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = (e.currentTarget as HTMLElement).getAttribute('data-toggle-name-edit');
        if (!id) return;
        this.editingNameUserId = this.editingNameUserId === id ? null : id;
        this.refresh(container);
      });
    });

    // Formulaire d'édition du nom d'affichage
    container.querySelectorAll('[data-form-edit-name]').forEach(form => {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const id = (e.currentTarget as HTMLElement).getAttribute('data-form-edit-name');
        if (!id) return;
        const input = container.querySelector(`[data-input-new-name="${id}"]`) as HTMLInputElement;
        if (!input) return;

        const res = db.updateUserName(id, input.value);
        this.feedbackMessage = {
          text: res.message,
          type: res.success ? 'success' : 'error'
        };
        this.editingNameUserId = null;
        this.refresh(container);
      });
    });

    // Exporter une archive binaire (.mdlb)
    container.querySelector('#btn-export-backup-mdlb')?.addEventListener('click', async () => {
      try {
        const data = db.exportData();
        const binaryBytes = await packBackupBinary(data);
        const dateStr = new Date().toISOString().slice(0, 10);
        const fileName = `openmdl_backup_${dateStr}.mdlb`;
        triggerFileDownload(binaryBytes, fileName, 'application/octet-stream');
        this.feedbackMessage = {
          text: `Archive binaire créée avec succès : ${fileName} (${binaryBytes.length} octets, compressée et vérifiée CRC32)`,
          type: 'success'
        };
        this.refresh(container);
      } catch (err: any) {
        console.error(err);
        this.feedbackMessage = {
          text: 'Erreur lors de l\'export binaire : ' + (err.message || String(err)),
          type: 'error'
        };
        this.refresh(container);
      }
    });

    // Restaurer une archive (.mdlb ou .json)
    const restoreFileInput = container.querySelector('#input-restore-backup-file') as HTMLInputElement;
    container.querySelector('#btn-restore-backup-file')?.addEventListener('click', () => {
      restoreFileInput?.click();
    });

    restoreFileInput?.addEventListener('change', async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const buffer = await file.arrayBuffer();
        const data = await unpackBackupBinary(buffer);

        if (!data || typeof data !== 'object' || !Array.isArray(data.products)) {
          throw new Error('Le fichier de sauvegarde est invalide ou corrompu.');
        }

        const isMdlb = file.name.endsWith('.mdlb');
        AppDialog.confirm({
          title: 'Restaurer la sauvegarde',
          message: `Voulez-vous restaurer l'archive "${file.name}" (${isMdlb ? 'Format binaire .mdlb' : 'Format JSON'}) ?\n\nContenu détecté :\n- ${data.products?.length || 0} produit(s)\n- ${data.sales?.length || 0} vente(s)\n- ${data.sessions?.length || 0} séance(s)\n- ${data.volunteers?.length || 0} utilisateur(s)\n\nAttention : cette action va écraser les données actuelles.`,
          type: 'warning',
          confirmText: 'Restaurer & Écraser',
          cancelText: 'Annuler',
          onConfirm: () => {
            db.importData(data);
            this.feedbackMessage = {
              text: `Sauvegarde "${file.name}" restaurée avec succès !`,
              type: 'success'
            };
            this.refresh(container);
          }
        });
      } catch (err: any) {
        console.error(err);
        AppDialog.alert({
          title: 'Erreur de restauration',
          message: 'Impossible de restaurer le fichier : ' + (err.message || String(err)),
          type: 'error'
        });
      } finally {
        restoreFileInput.value = '';
      }
    });

    // Afficher l'historique des sauvegardes automatiques
    container.querySelector('#btn-show-backups-history')?.addEventListener('click', async () => {
      const diskBackups = await listDiskBackups();
      const localBackups = db.getBackupsList();

      const modalContent = document.createElement('div');
      modalContent.className = 'space-y-4';

      if (diskBackups.length === 0 && localBackups.length === 0) {
        modalContent.innerHTML = `
          <div class="p-8 text-center text-slate-400">
            <p class="font-bold">Aucune sauvegarde enregistrée pour le moment.</p>
            <p class="text-xs mt-1">Des sauvegardes sont générées automatiquement lors de la clôture des séances.</p>
          </div>
        `;
      } else {
        const combined = [
          ...diskBackups.map(b => ({
            name: b.fileName,
            path: b.path,
            size: b.sizeBytes,
            isBinary: b.isBinary,
            date: new Date(b.modifiedSecs * 1000).toLocaleString('fr-FR'),
            isDisk: true
          })),
          ...localBackups
            .filter(lb => !diskBackups.some(db => db.fileName === lb.fileName))
            .map(lb => ({
              name: lb.fileName,
              path: '',
              size: (lb as any).size || 0,
              isBinary: lb.fileName.endsWith('.mdlb'),
              date: new Date(lb.date).toLocaleString('fr-FR'),
              isDisk: false
            }))
        ];

        modalContent.innerHTML = `
          <p class="text-xs text-slate-500 dark:text-slate-400 mb-3">
            Liste des sauvegardes générées par OpenMDL. Vous pouvez restaurer ou inspecter n'importe quel point de sauvegarde.
          </p>
          <div class="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
            ${combined.map((b, idx) => `
              <div class="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex items-center justify-between gap-3">
                <div class="space-y-1 truncate">
                  <div class="flex items-center gap-2">
                    <span class="font-mono font-bold text-xs text-slate-800 dark:text-slate-200 truncate">${escapeHtml(b.name)}</span>
                    <span class="px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${b.isBinary ? 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border border-orange-500/20' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}">
                      ${b.isBinary ? '.MDLB Binaire' : 'JSON'}
                    </span>
                  </div>
                  <div class="text-[10px] text-slate-400 flex items-center gap-2">
                    <span>${b.date}</span>
                    <span>•</span>
                    <span>${(b.size / 1024).toFixed(1)} Ko</span>
                    ${b.isDisk ? '<span class="text-emerald-500 font-bold">• Sur disque</span>' : ''}
                  </div>
                </div>

                <button 
                  type="button" 
                  data-restore-index="${idx}" 
                  class="btn-restore-history-item px-3 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-extrabold text-xs transition-colors flex items-center gap-1 cursor-pointer flex-shrink-0"
                >
                  ${Icons.refresh('w-3 h-3')}
                  <span>Restaurer</span>
                </button>
              </div>
            `).join('')}
          </div>
        `;

        const closeModal = AppDialog.custom({
          title: 'Historique des Sauvegardes OpenMDL',
          content: modalContent,
          size: 'lg'
        });

        modalContent.querySelectorAll('.btn-restore-history-item').forEach(btn => {
          btn.addEventListener('click', async (e) => {
            const index = parseInt((e.currentTarget as HTMLElement).getAttribute('data-restore-index') || '-1', 10);
            const target = combined[index];
            if (!target) return;

            AppDialog.confirm({
              title: 'Restaurer ce point de sauvegarde',
              message: `Voulez-vous restaurer les données depuis "${target.name}" (${target.date}) ?\nLes données actuelles seront remplacées.`,
              type: 'warning',
              confirmText: 'Confirmer la restauration',
              cancelText: 'Annuler',
              onConfirm: async () => {
                try {
                  let data: any = null;
                  if (target.isDisk && target.path) {
                    data = await readBackupFromDisk(target.path);
                  } else {
                    const raw = localStorage.getItem('backup_data_' + target.name);
                    if (!raw) throw new Error('Données introuvables en cache local.');
                    data = await unpackBackupBinary(raw);
                  }

                  db.importData(data);
                  closeModal();
                  this.feedbackMessage = {
                    text: `Sauvegarde "${target.name}" restaurée avec succès !`,
                    type: 'success'
                  };
                  this.refresh(container);
                } catch (err: any) {
                  console.error(err);
                  AppDialog.alert({
                    title: 'Erreur',
                    message: 'Échec de lecture de la sauvegarde : ' + (err.message || String(err)),
                    type: 'error'
                  });
                }
              }
            });
          });
        });
        return;
      }

      AppDialog.custom({
        title: 'Historique des Sauvegardes OpenMDL',
        content: modalContent,
        size: 'md'
      });
    });

    // Bouton Remise à zéro propre (App 100% vierge)
    container.querySelector('#btn-clean-data')?.addEventListener('click', () => {
      AppDialog.confirm({
        title: 'Remise à zéro complète',
        message: 'Voulez-vous remettre l\'application complètement à zéro ? Le catalogue, les ventes, les sessions et TOUS les utilisateurs seront effacés pour ne conserver que l\'unique compte (admin / admin).',
        type: 'danger',
        confirmText: 'Effacer tout & Réinitialiser',
        cancelText: 'Annuler',
        onConfirm: () => {
          db.clearAllTestData(true, true);
          this.feedbackMessage = {
            text: 'Application 100% vierge ! Catalogue vide et unique compte actif : admin / admin.',
            type: 'success'
          };
          this.refresh(container);
        }
      });
    });

    // Bouton Chargement Démo (pour screenshots et présentations)
    container.querySelector('#btn-seed-demo')?.addEventListener('click', () => {
      AppDialog.confirm({
        title: 'Charger les données démo',
        message: 'Charger les données de démonstration complètes (ventes sur plusieurs mois, statistiques et graphiques pour captures d\'écran) ?',
        type: 'warning',
        confirmText: 'Charger la démo',
        cancelText: 'Annuler',
        onConfirm: () => {
          db.seedDemoData();
          this.feedbackMessage = {
            text: 'Données de démonstration chargées avec succès ! Les graphiques et bilans sont remplis.',
            type: 'success'
          };
          this.refresh(container);
        }
      });
    });

    // Gestion des Paramètres de Collation Bénévole (Conso Gratuite)
    const currentPerkSettings = db.getPerkSettings();
    let isPerkEnabled = currentPerkSettings.enabled;
    let isPerkDailyLimitStrict = !currentPerkSettings.allowMultiplePerDay;

    const perkForm = container.querySelector('#perk-settings-form') as HTMLFormElement | null;
    const rowPerkEnabled = container.querySelector('#row-perk-enabled') as HTMLElement | null;
    const btnTogglePerkEnabled = container.querySelector('#btn-toggle-perk-enabled') as HTMLButtonElement | null;
    const dotPerkEnabled = container.querySelector('#dot-perk-enabled') as HTMLElement | null;
    const labelPerkEnabled = container.querySelector('#label-perk-enabled') as HTMLElement | null;

    const rowPerkDailyLimit = container.querySelector('#row-perk-daily-limit') as HTMLElement | null;
    const btnTogglePerkDailyLimit = container.querySelector('#btn-toggle-perk-daily-limit') as HTMLButtonElement | null;
    const dotPerkDailyLimit = container.querySelector('#dot-perk-daily-limit') as HTMLElement | null;
    const labelPerkDailyLimit = container.querySelector('#label-perk-daily-limit') as HTMLElement | null;

    const perkRuleSelect = container.querySelector('#perk-rule-select') as HTMLSelectElement | null;
    const perkThresholdContainer = container.querySelector('#perk-threshold-container') as HTMLElement | null;
    const perkThresholdInput = container.querySelector('#perk-threshold-input') as HTMLInputElement | null;
    const perkThresholdUnit = container.querySelector('#perk-threshold-unit') as HTMLElement | null;

    const badgePerkActive = container.querySelector('#badge-perk-active') as HTMLElement | null;

    const updatePerkEnabledUI = () => {
      const perkOptionsCollapsible = container.querySelector('#perk-options-collapsible') as HTMLElement | null;
      if (perkOptionsCollapsible) {
        if (isPerkEnabled) {
          perkOptionsCollapsible.classList.remove('hidden');
          perkOptionsCollapsible.classList.add('block');
        } else {
          perkOptionsCollapsible.classList.add('hidden');
          perkOptionsCollapsible.classList.remove('block');
        }
      }

      if (badgePerkActive) {
        if (isPerkEnabled) {
          badgePerkActive.textContent = 'Active';
          badgePerkActive.className = 'text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20';
        } else {
          badgePerkActive.textContent = 'Désactivée';
          badgePerkActive.className = 'text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-slate-500/10 text-slate-500 border border-slate-500/20';
        }
      }

      if (btnTogglePerkEnabled && dotPerkEnabled && labelPerkEnabled) {
        if (isPerkEnabled) {
          btnTogglePerkEnabled.className = 'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out bg-orange-600';
          dotPerkEnabled.className = 'inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition duration-200 ease-in-out my-0.5 ml-0.5 translate-x-5';
          labelPerkEnabled.textContent = 'Activé';
          labelPerkEnabled.className = 'text-[10px] font-black uppercase text-emerald-500';
        } else {
          btnTogglePerkEnabled.className = 'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out bg-slate-300 dark:bg-slate-700';
          dotPerkEnabled.className = 'inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition duration-200 ease-in-out my-0.5 ml-0.5 translate-x-0';
          labelPerkEnabled.textContent = 'Désactivé';
          labelPerkEnabled.className = 'text-[10px] font-black uppercase text-slate-400';
        }
      }

      if (perkRuleSelect) {
        perkRuleSelect.disabled = !isPerkEnabled;
        if (isPerkEnabled) {
          perkRuleSelect.classList.remove('opacity-50', 'cursor-not-allowed');
        } else {
          perkRuleSelect.classList.add('opacity-50', 'cursor-not-allowed');
        }
      }

      if (perkThresholdInput) {
        perkThresholdInput.disabled = !isPerkEnabled;
        const parent = perkThresholdInput.parentElement;
        if (parent) {
          if (isPerkEnabled) parent.classList.remove('opacity-50');
          else parent.classList.add('opacity-50');
        }
      }

      if (btnTogglePerkDailyLimit && rowPerkDailyLimit) {
        btnTogglePerkDailyLimit.disabled = !isPerkEnabled;
        if (isPerkEnabled) {
          rowPerkDailyLimit.classList.remove('opacity-50', 'cursor-not-allowed');
        } else {
          rowPerkDailyLimit.classList.add('opacity-50', 'cursor-not-allowed');
        }
      }
    };

    const updatePerkDailyLimitUI = () => {
      if (btnTogglePerkDailyLimit && dotPerkDailyLimit && labelPerkDailyLimit) {
        if (isPerkDailyLimitStrict) {
          btnTogglePerkDailyLimit.className = 'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out bg-orange-600';
          dotPerkDailyLimit.className = 'inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition duration-200 ease-in-out my-0.5 ml-0.5 translate-x-5';
          labelPerkDailyLimit.textContent = '1 max / jour';
          labelPerkDailyLimit.className = 'text-[10px] font-black uppercase text-emerald-500';
        } else {
          btnTogglePerkDailyLimit.className = 'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out bg-slate-300 dark:bg-slate-700';
          dotPerkDailyLimit.className = 'inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition duration-200 ease-in-out my-0.5 ml-0.5 translate-x-0';
          labelPerkDailyLimit.textContent = 'Illimité';
          labelPerkDailyLimit.className = 'text-[10px] font-black uppercase text-slate-400';
        }
      }
    };

    rowPerkEnabled?.addEventListener('click', (e) => {
      e.preventDefault();
      isPerkEnabled = !isPerkEnabled;
      updatePerkEnabledUI();
      db.updatePerkSettings({ enabled: isPerkEnabled });
    });

    rowPerkDailyLimit?.addEventListener('click', (e) => {
      e.preventDefault();
      if (!isPerkEnabled) return;
      isPerkDailyLimitStrict = !isPerkDailyLimitStrict;
      updatePerkDailyLimitUI();
      db.updatePerkSettings({ allowMultiplePerDay: !isPerkDailyLimitStrict });
    });

    const savePerkConfig = () => {
      const rule = (perkRuleSelect?.value || 'items_sold') as PerkEligibilityRule;
      const threshold = Math.max(1, parseInt(perkThresholdInput?.value || '10', 10) || 10);
      db.updatePerkSettings({
        enabled: isPerkEnabled,
        rule,
        threshold,
        allowMultiplePerDay: !isPerkDailyLimitStrict
      });
    };

    perkRuleSelect?.addEventListener('change', () => {
      const rule = perkRuleSelect.value as PerkEligibilityRule;
      if (rule === 'always') {
        perkThresholdContainer?.classList.add('hidden');
        perkThresholdContainer?.classList.remove('block');
      } else {
        perkThresholdContainer?.classList.remove('hidden');
        perkThresholdContainer?.classList.add('block');
        if (perkThresholdUnit) {
          perkThresholdUnit.textContent = rule === 'items_sold' ? 'articles' : 'ventes';
        }
      }
      savePerkConfig();
    });

    perkThresholdInput?.addEventListener('change', () => {
      savePerkConfig();
    });

    perkForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      savePerkConfig();

      this.feedbackMessage = {
        text: isPerkEnabled
          ? 'Critères de collation bénévole enregistrés avec succès (Collation active) !'
          : 'La collation bénévole offerte a été DÉSACTIVÉE avec succès.',
        type: 'success'
      };
      this.refresh(container);
    });

    // Gestion des Paramètres de Fond de Caisse & Décaisse
    const currentCashFloatSettings = db.getCashFloatSettings();
    let isCashFloatEnabled = currentCashFloatSettings.enabled;

    const rowCashFloatEnabled = container.querySelector('#row-cash-float-enabled') as HTMLElement | null;
    const btnToggleCashFloatEnabled = container.querySelector('#btn-toggle-cash-float-enabled') as HTMLButtonElement | null;
    const dotCashFloatEnabled = container.querySelector('#dot-cash-float-enabled') as HTMLElement | null;
    const labelCashFloatEnabled = container.querySelector('#label-cash-float-enabled') as HTMLElement | null;
    const badgeCashFloatActive = container.querySelector('#badge-cash-float-active') as HTMLElement | null;
    const cashFloatOptionsCollapsible = container.querySelector('#cash-float-options-collapsible') as HTMLElement | null;
    const cashFloatForm = container.querySelector('#cash-float-settings-form') as HTMLFormElement | null;
    const baseCashFloatTotalEl = container.querySelector('#base-cash-float-total') as HTMLElement | null;
    const btnResetCarriedDeficits = container.querySelector('#btn-reset-carried-deficits') as HTMLButtonElement | null;

    const updateCashFloatEnabledUI = () => {
      if (cashFloatOptionsCollapsible) {
        if (isCashFloatEnabled) {
          cashFloatOptionsCollapsible.classList.remove('hidden');
          cashFloatOptionsCollapsible.classList.add('block');
        } else {
          cashFloatOptionsCollapsible.classList.add('hidden');
          cashFloatOptionsCollapsible.classList.remove('block');
        }
      }

      if (badgeCashFloatActive) {
        if (isCashFloatEnabled) {
          badgeCashFloatActive.textContent = 'Actif';
          badgeCashFloatActive.className = 'text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20';
        } else {
          badgeCashFloatActive.textContent = 'Désactivé';
          badgeCashFloatActive.className = 'text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-slate-500/10 text-slate-500 border border-slate-500/20';
        }
      }

      if (btnToggleCashFloatEnabled && dotCashFloatEnabled && labelCashFloatEnabled) {
        if (isCashFloatEnabled) {
          btnToggleCashFloatEnabled.className = 'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out bg-orange-600';
          dotCashFloatEnabled.className = 'inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition duration-200 ease-in-out my-0.5 ml-0.5 translate-x-5';
          labelCashFloatEnabled.textContent = 'Activé';
          labelCashFloatEnabled.className = 'text-[10px] font-black uppercase text-emerald-500';
        } else {
          btnToggleCashFloatEnabled.className = 'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out bg-slate-300 dark:bg-slate-700';
          dotCashFloatEnabled.className = 'inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition duration-200 ease-in-out my-0.5 ml-0.5 translate-x-0';
          labelCashFloatEnabled.textContent = 'Désactivé';
          labelCashFloatEnabled.className = 'text-[10px] font-black uppercase text-slate-400';
        }
      }
    };

    rowCashFloatEnabled?.addEventListener('click', (e) => {
      e.preventDefault();
      isCashFloatEnabled = !isCashFloatEnabled;
      updateCashFloatEnabledUI();
      db.updateCashFloatSettings({ enabled: isCashFloatEnabled });
    });

    // Helper pour recalculer les totaux en temps réel
    const recalculateCashFloatTotals = () => {
      let total = 0;
      EURO_DENOMINATIONS.forEach(d => {
        const input = container.querySelector(`input[data-denom-id="${d.id}"]`) as HTMLInputElement | null;
        const subtotalEl = container.querySelector(`[data-base-subtotal="${d.id}"]`) as HTMLElement | null;
        const count = Math.max(0, parseInt(input?.value || '0', 10) || 0);
        const subtotal = count * d.value;
        total += subtotal;
        if (subtotalEl) {
          subtotalEl.textContent = `${subtotal.toFixed(2)} €`;
        }
      });
      if (baseCashFloatTotalEl) {
        baseCashFloatTotalEl.textContent = `${total.toFixed(2)} €`;
      }
    };

    // Boutons +/- et inputs numériques
    EURO_DENOMINATIONS.forEach(d => {
      const input = container.querySelector(`input[data-denom-id="${d.id}"]`) as HTMLInputElement | null;
      const btnDown = container.querySelector(`[data-cash-step-down="${d.id}"]`) as HTMLButtonElement | null;
      const btnUp = container.querySelector(`[data-cash-step-up="${d.id}"]`) as HTMLButtonElement | null;

      btnDown?.addEventListener('click', () => {
        if (!input) return;
        const val = Math.max(0, (parseInt(input.value, 10) || 0) - 1);
        input.value = val.toString();
        recalculateCashFloatTotals();
      });

      btnUp?.addEventListener('click', () => {
        if (!input) return;
        const val = Math.max(0, (parseInt(input.value, 10) || 0) + 1);
        input.value = val.toString();
        recalculateCashFloatTotals();
      });

      input?.addEventListener('input', () => {
        recalculateCashFloatTotals();
      });
    });

    // Remise à zéro des reports de déficits
    btnResetCarriedDeficits?.addEventListener('click', (e) => {
      e.preventDefault();
      AppDialog.confirm({
        title: 'Réinitialiser les reports de caisse',
        message: 'Voulez-vous réinitialiser tous les reports et manques de monnaie ? Les prochaines séances repartiront sur le fond programmé standard sans compensation.',
        type: 'warning',
        confirmText: 'Réinitialiser',
        cancelText: 'Annuler',
        onConfirm: () => {
          db.updateCashFloatSettings({ carriedOverDifferences: {} });
          this.feedbackMessage = {
            text: 'Les reports et déficits de caisse ont été remis à zéro avec succès.',
            type: 'success'
          };
          this.refresh(container);
        }
      });
    });

    // Enregistrement du formulaire de fond de caisse
    cashFloatForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      const baseCounts: Record<string, number> = {};
      EURO_DENOMINATIONS.forEach(d => {
        const input = container.querySelector(`input[data-denom-id="${d.id}"]`) as HTMLInputElement | null;
        baseCounts[d.id] = Math.max(0, parseInt(input?.value || '0', 10) || 0);
      });

      db.updateCashFloatSettings({
        enabled: isCashFloatEnabled,
        baseCounts
      });

      const newTotal = db.calculateBaseCashFloatTotal(baseCounts);

      this.feedbackMessage = {
        text: isCashFloatEnabled
          ? `Fond de caisse cible enregistré avec succès (${newTotal.toFixed(2)} €) !`
          : 'Le module de fond de caisse et décaisse a été DÉSACTIVÉ.',
        type: 'success'
      };
      this.refresh(container);
    });

    // Gestion de la section Mise à jour logicielle (Tauri Auto-Updater)
    const cardSoftwareUpdate = container.querySelector('#card-software-update') as HTMLElement;
    if (cardSoftwareUpdate) {
      updater.subscribe((state) => {
        this.renderUpdaterSection(cardSoftwareUpdate, state);
      });
    }

    container.querySelectorAll('#btn-goto-credits, [data-action="goto-credits"]').forEach(btn => {
      btn.addEventListener('click', () => {
        (window as any).OpenMDL?.navigation.goTo('credits');
      });
    });
  }

  private renderUpdaterSection(cardContainer: HTMLElement, state: UpdateState): void {
    const container = cardContainer.querySelector('#updater-state-container');
    if (!container) return;

    if (state.status === 'idle') {
      container.innerHTML = `
        <button 
          type="button" 
          id="btn-check-update"
          class="w-full py-3 px-4 rounded-2xl bg-orange-600 hover:bg-orange-500 active:scale-[0.98] text-white font-extrabold text-xs tracking-wide shadow-md shadow-orange-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          ${Icons.refresh('w-4 h-4')}
          <span>Rechercher une mise à jour</span>
        </button>
      `;
    } else if (state.status === 'checking') {
      container.innerHTML = `
        <div class="py-3 px-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex items-center justify-center gap-2.5 text-xs font-bold text-slate-600 dark:text-slate-300">
          <span class="animate-spin text-orange-500 inline-block">${Icons.refresh('w-4 h-4')}</span>
          <span>Recherche des versions sur GitHub...</span>
        </div>
      `;
    } else if (state.status === 'up-to-date') {
      container.innerHTML = `
        <div class="space-y-2.5 animate-enter">
          <div class="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center gap-2.5">
            ${Icons.check('w-4 h-4 flex-shrink-0')}
            <span>OpenMDL est à jour (v${escapeHtml(state.currentVersion)})</span>
          </div>
          <button 
            type="button" 
            id="btn-check-update"
            class="w-full py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            ${Icons.refresh('w-3.5 h-3.5')}
            <span>Revérifier</span>
          </button>
        </div>
      `;
    } else if (state.status === 'available') {
      container.innerHTML = `
        <div class="space-y-3 p-4 rounded-2xl bg-orange-500/10 border border-orange-500/30 animate-enter">
          <div class="flex items-center justify-between">
            <span class="text-xs font-extrabold text-orange-600 dark:text-orange-400">
              Nouvelle version disponible !
            </span>
            <span class="font-mono font-black text-xs px-2 py-0.5 rounded-md bg-orange-500 text-white shadow-xs">
              v${escapeHtml(state.availableVersion || '')}
            </span>
          </div>
          ${state.releaseNotes ? `
            <p class="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-3 bg-white/70 dark:bg-slate-900/70 p-2.5 rounded-xl border border-orange-500/20 font-sans leading-relaxed">
              ${escapeHtml(state.releaseNotes)}
            </p>
          ` : ''}
          <button 
            type="button" 
            id="btn-download-update"
            class="w-full py-3 px-4 rounded-2xl bg-orange-600 hover:bg-orange-500 active:scale-[0.98] text-white font-extrabold text-xs shadow-md shadow-orange-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            ${Icons.download('w-4 h-4')}
            <span>Télécharger et installer la mise à jour</span>
          </button>
        </div>
      `;
    } else if (state.status === 'downloading') {
      const mbDownloaded = (state.downloadedBytes / (1024 * 1024)).toFixed(1);
      const mbTotal = state.totalBytes > 0 ? (state.totalBytes / (1024 * 1024)).toFixed(1) : '?';
      container.innerHTML = `
        <div class="space-y-2.5 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 animate-enter">
          <div class="flex items-center justify-between text-xs font-extrabold text-slate-800 dark:text-slate-200">
            <div class="flex items-center gap-2">
              <span class="animate-spin text-orange-500 inline-block">${Icons.refresh('w-3.5 h-3.5')}</span>
              <span>Téléchargement en cours...</span>
            </div>
            <span class="font-mono text-orange-600 dark:text-orange-400 font-black">${state.progressPercent}%</span>
          </div>

          <!-- Barre de progression stylisée -->
          <div class="w-full h-3 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden relative shadow-inner">
            <div 
              class="h-full bg-gradient-to-r from-orange-500 to-amber-500 rounded-full transition-all duration-300 ease-out relative overflow-hidden" 
              style="width: ${state.progressPercent}%;"
            >
              <div class="absolute inset-0 bg-white/20 animate-pulse"></div>
            </div>
          </div>

          <div class="flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span>${mbDownloaded} Mo / ${mbTotal} Mo</span>
            <span>Vérification cryptographique...</span>
          </div>
        </div>
      `;
    } else if (state.status === 'ready-to-restart') {
      container.innerHTML = `
        <div class="space-y-3 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 animate-enter">
          <div class="flex items-center gap-2 text-xs font-extrabold text-emerald-600 dark:text-emerald-400">
            ${Icons.check('w-4 h-4')}
            <span>Mise à jour installée avec succès !</span>
          </div>
          <p class="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
            Redémarrez l'application pour appliquer immédiatement la nouvelle version.
          </p>
          <button 
            type="button" 
            id="btn-restart-app"
            class="w-full py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-extrabold text-xs shadow-md shadow-emerald-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            ${Icons.refresh('w-4 h-4')}
            <span>Redémarrer l'application maintenant</span>
          </button>
        </div>
      `;
    } else if (state.status === 'error') {
      container.innerHTML = `
        <div class="space-y-2.5 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/25 animate-enter">
          <div class="flex items-center gap-2 text-xs font-bold text-rose-600 dark:text-rose-400">
            ${Icons.alertTriangle('w-4 h-4 flex-shrink-0')}
            <span>${escapeHtml(state.errorMessage || 'Erreur lors de la recherche de mise à jour.')}</span>
          </div>
          <button 
            type="button" 
            id="btn-check-update"
            class="w-full py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs shadow-rose-600/20"
          >
            ${Icons.refresh('w-3.5 h-3.5')}
            <span>Réessayer</span>
          </button>
        </div>
      `;
    }

    // Attacher les écouteurs de la section mise à jour
    container.querySelector('#btn-check-update')?.addEventListener('click', () => {
      updater.checkForUpdates();
    });

    container.querySelector('#btn-download-update')?.addEventListener('click', () => {
      updater.downloadAndApply();
    });

    container.querySelector('#btn-restart-app')?.addEventListener('click', () => {
      updater.restartApp();
    });
  }

  private refresh(container: HTMLElement): void {
    const parent = container.parentElement;
    if (parent) {
      const newEl = this.render();
      parent.replaceChild(newEl, container);
    }
  }
}
