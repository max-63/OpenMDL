import { db, DEFAULT_DATABASE_CONFIG } from '../services/db';
import { Icons } from '../components/Icons';
import { escapeHtml } from '../utils/security';
import { updater, UpdateState } from '../services/updater';
import { ExternalDatabaseConfig } from '../types';
import { parseDatabaseUrl, buildDatabaseUrl } from '../services/db/externalDbService';
import { syncService } from '../services/syncService';
import { AppDialog } from '../components/AppDialog';
import { packBackupBinary, unpackBackupBinary, listDiskBackups, readBackupFromDisk, triggerFileDownload } from '../services/binaryCodec';

export class SystemView {
  private static draftEngine: 'sqlite' | 'mysql' | null = null;
  private static draftExternal: ExternalDatabaseConfig | null = null;
  private static extDbFeedback: { text: string; type: 'success' | 'error' | 'info' } | null = null;

  private onSettingsChanged?: () => void;
  private onNavigate?: (tab: string) => void;
  private feedbackMessage: { text: string; type: 'success' | 'error' | 'info' } | null = null;
  private syncFeedbackMessage: { text: string; type: 'success' | 'error' | 'info' } | null = null;
  private showExtDbPassword = false;
  private updaterUnsubscribe: (() => void) | null = null;

  constructor(onSettingsChanged?: () => void, onNavigate?: (tab: string) => void) {
    this.onSettingsChanged = onSettingsChanged;
    this.onNavigate = onNavigate;
  }

  public render(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'w-full h-full flex flex-col gap-4 overflow-y-auto pr-1 animate-enter select-none';

    this.renderContent(container);
    this.attachEventListeners(container);

    return container;
  }

  private renderContent(container: HTMLElement): void {
    container.innerHTML = '';

    if (!db.hasPermission('canAccessSystem')) {
      container.innerHTML = `
        <div class="rounded-3xl bg-white dark:bg-slate-900 border border-rose-500/30 p-8 text-center space-y-2 max-w-lg mx-auto my-auto shadow-sm">
          <div class="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 flex items-center justify-center mx-auto">
            ${Icons.lock('w-6 h-6')}
          </div>
          <h2 class="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">Accès réservé aux administrateurs</h2>
          <p class="text-xs text-slate-500 dark:text-slate-400">
            Les réglages système, réseau et base de données ne peuvent être consultés que par un compte administrateur.
          </p>
        </div>
      `;
      return;
    }

    const appProfile = db.getAppProfile();
    const syncConfig = syncService.getConfig();
    const serverStatus = syncService.cachedServerStatus;
    const isServerRunning = !!serverStatus?.running;
    const serverIp = syncService.cachedLocalIp || '127.0.0.1';
    const serverPort = serverStatus?.port || syncConfig.lan.port || 4123;
    const dbConfig = db.getDatabaseConfig();
    const activeViewEngine = SystemView.draftEngine ?? dbConfig.engine;
    const extCfg: ExternalDatabaseConfig = {
      ...DEFAULT_DATABASE_CONFIG.external!,
      ...(dbConfig.external || {}),
      ...(SystemView.draftExternal || {})
    };
    const isMysqlEngine = activeViewEngine === 'mysql';
    const isMysqlActiveInDb = dbConfig.engine === 'mysql';
    const extPendingCount = dbConfig.pendingOpsCount || 0;
    const extStatus = dbConfig.status || 'connected';

    const syncSummary = syncConfig.mode === 'standalone'
      ? 'Autonome'
      : syncConfig.mode === 'lan'
        ? (syncConfig.lan.role === 'server' ? 'LAN Serveur' : 'LAN Client')
        : 'Clé USB';
    const engineSummary = dbConfig.engine === 'mysql'
      ? (extCfg.dialect === 'mariadb' ? 'MariaDB' : 'MySQL')
      : 'SQLite';

    container.innerHTML = `
      <!-- En-tête de la page Système -->
      <div class="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div class="flex items-center gap-3.5">
          <div class="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center font-bold">
            ${Icons.server('w-6 h-6')}
          </div>
          <div>
            <div class="flex items-center gap-2 flex-wrap">
              <h1 class="text-lg font-black text-slate-900 dark:text-white tracking-tight">Système & Infrastructure</h1>
              <span class="px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[10px] font-extrabold uppercase tracking-wide border border-rose-500/20">
                Admin Uniquement
              </span>
            </div>
            <p class="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
              Configuration technique sensible : moteur de base de données, réseau multi-postes, profil de la machine, sauvegardes et mises à jour.
            </p>
          </div>
        </div>

        <!-- Pilules d'état synthétiques & Retour Paramètres -->
        <div class="flex items-center gap-2 flex-wrap">
          <div class="px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-center">
            <div class="text-[9px] font-bold text-slate-400 uppercase">Moteur DB</div>
            <div class="text-xs font-black ${dbConfig.engine === 'mysql' ? 'text-orange-600 dark:text-orange-400' : 'text-emerald-600 dark:text-emerald-400'}">${engineSummary}</div>
          </div>
          <div class="px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-center">
            <div class="text-[9px] font-bold text-slate-400 uppercase">Mode Sync</div>
            <div class="text-xs font-black text-slate-800 dark:text-slate-100">${syncSummary}</div>
          </div>
          <div class="px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-center">
            <div class="text-[9px] font-bold text-slate-400 uppercase">Profil PC</div>
            <div class="text-xs font-black ${appProfile === 'visco' ? 'text-sky-600 dark:text-sky-400' : 'text-orange-600 dark:text-orange-400'}">${appProfile === 'visco' ? 'Vie Scolaire' : 'Foyer'}</div>
          </div>
          <div class="px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-center">
            <div class="text-[9px] font-bold text-slate-400 uppercase">Version</div>
            <div class="text-xs font-mono font-black text-slate-800 dark:text-slate-100">v${escapeHtml(updater.getState().currentVersion)}</div>
          </div>

          <button
            type="button"
            id="btn-goto-settings"
            class="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer border border-slate-200 dark:border-slate-700 ml-1"
            title="Revenir à l'espace Paramètres & Gestion"
          >
            ${Icons.settings('w-4 h-4 text-orange-500')}
            <span>Paramètres</span>
          </button>
        </div>
      </div>

      <!-- Feedback notification -->
      ${this.feedbackMessage ? `
        <div class="p-4 rounded-2xl ${this.feedbackMessage.type === 'success'
          ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-600 dark:text-emerald-400'
          : this.feedbackMessage.type === 'info'
            ? 'bg-sky-500/10 border-sky-500/25 text-sky-600 dark:text-sky-400'
            : 'bg-rose-500/10 border-rose-500/25 text-rose-600 dark:text-rose-400'
        } border text-xs font-bold flex items-center justify-between animate-enter">
          <div class="flex items-center gap-2">
            ${this.feedbackMessage.type === 'success' ? Icons.check('w-4 h-4') : Icons.alertTriangle('w-4 h-4')}
            <span>${escapeHtml(this.feedbackMessage.text)}</span>
          </div>
          <button id="btn-close-feedback" class="hover:opacity-75 text-xs font-black cursor-pointer">&times;</button>
        </div>
      ` : ''}

      <!-- Carte 1 : Moteur de Données & Stockage (Slide SQLite Intégré vs MySQL / MariaDB Externe) -->
      <div class="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div class="flex items-center gap-3.5">
            <div class="w-11 h-11 rounded-2xl bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20 flex items-center justify-center font-bold flex-shrink-0">
              ${Icons.database('w-5 h-5')}
            </div>
            <div>
              <div class="flex items-center gap-2 flex-wrap">
                <h2 class="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">Moteur de Données & Stockage</h2>
                ${!isMysqlEngine ? `
                  <span class="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide border bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 flex items-center gap-1.5">
                    <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span>Intégré : SQLite (Recommandé)</span>
                  </span>
                ` : !isMysqlActiveInDb ? `
                  <span class="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide border bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20 flex items-center gap-1.5">
                    <span class="w-2 h-2 rounded-full bg-sky-500"></span>
                    <span>Configuration en brouillon (non activée)</span>
                  </span>
                ` : extStatus === 'connected' ? `
                  <span class="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide border bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 flex items-center gap-1.5">
                    <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span>Externe : ${extCfg.dialect === 'mariadb' ? 'MariaDB' : 'MySQL'} Connecté</span>
                  </span>
                ` : extStatus === 'offline_cache' ? `
                  <span class="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide border bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 flex items-center gap-1.5">
                    <span class="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                    <span>Cache SQLite Hors-Ligne (${extPendingCount} en attente)</span>
                  </span>
                ` : `
                  <span class="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide border bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 flex items-center gap-1.5">
                    <span class="w-2 h-2 rounded-full bg-rose-500"></span>
                    <span>Erreur de connexion MySQL/MariaDB</span>
                  </span>
                `}
              </div>
              <p class="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                ${isMysqlEngine
                  ? 'Serveur MySQL / MariaDB relationnel (multi-caisses simultané) avec conservation permanente du cache SQLite local.'
                  : 'Base de données ultra-rapide, autonome et embarquée dans l\'application. Aucune installation externe requise.'}
              </p>
            </div>
          </div>

          <!-- Slide / Sélecteur Intégré SQLite vs Externe MySQL/MariaDB -->
          <div class="inline-flex p-1 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 self-start md:self-center">
            <button
              type="button"
              id="btn-engine-sqlite"
              class="px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${!isMysqlEngine
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'}"
            >
              Intégré : SQLite
            </button>
            <button
              type="button"
              id="btn-engine-mysql"
              class="px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${isMysqlEngine
                ? 'bg-orange-600 text-white shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'}"
            >
              Externe : MySQL / MariaDB
            </button>
          </div>
        </div>

        ${!isMysqlEngine ? `
          <div class="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div class="space-y-1">
              <div class="flex items-center gap-2 font-bold text-emerald-700 dark:text-emerald-300">
                ${Icons.shieldCheck('w-4 h-4')}
                <span>Moteur SQLite Actif & Optimisé</span>
              </div>
              <p class="text-slate-600 dark:text-slate-400 leading-relaxed text-[11px]">
                Toutes les transactions, stocks, bénévoles, messages du chat et sessions sont stockés localement avec intégrité ACID et redondance binaire CRC32.
              </p>
            </div>

            <div class="flex items-center gap-2 self-end sm:self-center">
              <button
                type="button"
                id="btn-optimize-sqlite-db"
                class="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                title="Vérifier et compacter la base SQLite"
              >
                ${Icons.refresh('w-3.5 h-3.5')}
                <span>Vérifier l'intégrité</span>
              </button>
            </div>
          </div>
        ` : `
          <div class="space-y-4">
            <!-- Bandeau d'état & architecture relationnelle + cache SQLite -->
            <div class="p-4 rounded-2xl ${extStatus === 'error'
              ? 'bg-rose-500/5 border border-rose-500/20'
              : extStatus === 'offline_cache'
                ? 'bg-amber-500/5 border border-amber-500/20'
                : 'bg-sky-500/5 border border-sky-500/20'
            } text-xs space-y-1.5">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <div class="flex items-center gap-2 font-bold ${extStatus === 'error'
                  ? 'text-rose-700 dark:text-rose-300'
                  : extStatus === 'offline_cache'
                    ? 'text-amber-700 dark:text-amber-300'
                    : 'text-sky-700 dark:text-sky-300'
                }">
                  ${Icons.shieldCheck('w-4 h-4')}
                  <span>Tables SQL Relationnelles Atomiques + Cache SQLite Local Conservé</span>
                </div>
                ${dbConfig.serverVersion ? `
                  <span class="px-2.5 py-0.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-[10px] font-bold text-slate-600 dark:text-slate-300">
                    Serveur : ${escapeHtml(dbConfig.serverVersion)}
                  </span>
                ` : ''}
              </div>
              <p class="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                Chaque vente, réapprovisionnement ou modification est exécuté dans une transaction SQL atomique (<code class="font-mono">products</code>, <code class="font-mono">sales</code>, <code class="font-mono">sessions</code>, <code class="font-mono">volunteers</code>...) pour éviter tout écrasement en multi-caisses. En cas de coupure réseau, les opérations restent sauvegardées dans le cache SQLite et la file hors-ligne (<code class="font-mono">pending_sync_ops</code>) est rejouée automatiquement au retour de la connexion.
              </p>
              ${isMysqlActiveInDb && dbConfig.lastError ? `
                <div class="text-[11px] font-semibold text-rose-600 dark:text-rose-400 pt-1">
                  Dernier message serveur : ${escapeHtml(dbConfig.lastError)}
                </div>
              ` : ''}
            </div>

            <div
              id="extdb-feedback-banner"
              class="${SystemView.extDbFeedback ? '' : 'hidden '}p-3 rounded-2xl text-xs font-bold border ${SystemView.extDbFeedback?.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                : SystemView.extDbFeedback?.type === 'error'
                  ? 'bg-rose-500/10 border-rose-500/20 text-rose-700 dark:text-rose-300'
                  : 'bg-sky-500/10 border-sky-500/20 text-sky-700 dark:text-sky-300'
              }"
            >
              ${SystemView.extDbFeedback ? escapeHtml(SystemView.extDbFeedback.text) : ''}
            </div>

            <!-- URL de connexion + Dialecte -->
            <div class="grid grid-cols-1 md:grid-cols-12 gap-3">
              <div class="md:col-span-3 space-y-1">
                <label class="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Type de serveur</label>
                <select id="select-extdb-dialect" class="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/30">
                  <option value="mysql" ${extCfg.dialect !== 'mariadb' ? 'selected' : ''}>MySQL</option>
                  <option value="mariadb" ${extCfg.dialect === 'mariadb' ? 'selected' : ''}>MariaDB</option>
                </select>
              </div>
              <div class="md:col-span-9 space-y-1">
                <label class="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">URL de connexion directe (optionnel — remplit les champs ci-dessous)</label>
                <input
                  type="text"
                  id="input-extdb-url"
                  value="${escapeHtml(extCfg.url || '')}"
                  placeholder="mysql://utilisateur:motdepasse@192.168.1.10:3306/openmdl  ou  mariadb://..."
                  class="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                />
              </div>
            </div>

            <!-- Champs Hôte / Port / Base / Utilisateur / Mot de passe / Intervalle / SSL -->
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
              <div class="lg:col-span-2 space-y-1">
                <label class="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Hôte / IP / Domaine</label>
                <input
                  type="text"
                  id="input-extdb-host"
                  value="${escapeHtml(extCfg.host || '127.0.0.1')}"
                  placeholder="127.0.0.1 ou db.lycee.fr"
                  class="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                />
              </div>
              <div class="space-y-1">
                <label class="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Port</label>
                <input
                  type="number"
                  id="input-extdb-port"
                  value="${extCfg.port || 3306}"
                  min="1"
                  max="65535"
                  class="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                />
              </div>
              <div class="space-y-1">
                <label class="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Base de données</label>
                <input
                  type="text"
                  id="input-extdb-name"
                  value="${escapeHtml(extCfg.database || 'openmdl')}"
                  placeholder="openmdl"
                  class="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                />
              </div>
              <div class="space-y-1">
                <label class="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Utilisateur</label>
                <input
                  type="text"
                  id="input-extdb-user"
                  value="${escapeHtml(extCfg.username || '')}"
                  placeholder="openmdl"
                  class="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                />
              </div>
              <div class="space-y-1">
                <label class="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Mot de passe</label>
                <div class="relative">
                  <input
                    type="${this.showExtDbPassword ? 'text' : 'password'}"
                    id="input-extdb-pass"
                    value="${escapeHtml(extCfg.password || '')}"
                    placeholder="••••••••"
                    class="w-full pl-3 pr-9 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                  />
                  <button type="button" id="btn-toggle-extdb-pass" class="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer" title="Afficher/Masquer">
                    ${this.showExtDbPassword ? Icons.eyeOff('w-3.5 h-3.5') : Icons.eye('w-3.5 h-3.5')}
                  </button>
                </div>
              </div>
            </div>

            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
              <div class="flex flex-wrap items-center gap-4">
                <label class="inline-flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input type="checkbox" id="toggle-extdb-ssl" class="rounded border-slate-300 text-orange-600 focus:ring-orange-500" ${extCfg.ssl ? 'checked' : ''} />
                  <span>Connexion chiffrée SSL / TLS</span>
                </label>

                <label id="wrap-extdb-accept-invalid" class="${extCfg.ssl ? 'inline-flex' : 'hidden'} items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-400 cursor-pointer">
                  <input type="checkbox" id="toggle-extdb-accept-invalid" class="rounded border-slate-300 text-orange-600 focus:ring-orange-500" ${extCfg.acceptInvalidCerts ? 'checked' : ''} />
                  <span>Accepter certificats SSL auto-signés</span>
                </label>

                <div class="flex items-center gap-2 text-xs">
                  <label for="input-extdb-interval" class="font-bold text-slate-500 dark:text-slate-400">Synchro auto (sec) :</label>
                  <input
                    type="number"
                    id="input-extdb-interval"
                    value="${extCfg.syncIntervalSec || 15}"
                    min="5"
                    max="300"
                    class="w-16 px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div class="flex flex-wrap items-center gap-2">
                ${extPendingCount > 0 ? `
                  <button
                    type="button"
                    id="btn-clear-pending-extdb"
                    class="px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                    title="Supprimer les opérations hors-ligne bloquées dans la file SQLite"
                  >
                    ${Icons.trash('w-3.5 h-3.5')}
                    <span>Vider la file (${extPendingCount})</span>
                  </button>
                ` : ''}
                <button
                  type="button"
                  id="btn-test-extdb"
                  class="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer border border-slate-200 dark:border-slate-700"
                >
                  ${Icons.wifi('w-3.5 h-3.5')}
                  <span>Tester</span>
                </button>
                <button
                  type="button"
                  id="btn-migrate-extdb"
                  class="px-3.5 py-2 rounded-xl bg-sky-600/10 hover:bg-sky-600/20 text-sky-700 dark:text-sky-300 border border-sky-500/30 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                  title="Envoyer vos données SQLite locales vers MySQL/MariaDB"
                >
                  ${Icons.upload('w-3.5 h-3.5')}
                  <span>Migrer SQLite → MySQL</span>
                </button>
                <button
                  type="button"
                  id="btn-sync-extdb"
                  class="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer border border-slate-200 dark:border-slate-700"
                >
                  ${Icons.refresh('w-3.5 h-3.5')}
                  <span>Synchroniser</span>
                </button>
                <button
                  type="button"
                  id="btn-save-extdb"
                  class="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-extrabold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-sm shadow-orange-600/20"
                >
                  ${Icons.check('w-3.5 h-3.5')}
                  <span>Enregistrer & Synchroniser</span>
                </button>
              </div>
            </div>
          </div>
        `}
      </div>

      <!-- Carte 2 : Réseau & Synchronisation Multi-Postes -->
      <div class="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-5">
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
            <button id="btn-close-sync-feedback" class="hover:opacity-75 text-xs font-black cursor-pointer">&times;</button>
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
                Renseignez le chemin complet du fichier JSON (ex: sous Windows <code>E:\\openmdl_sync.json</code>, sous Linux <code>/media/usb/openmdl_sync.json</code>).
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

      <!-- Ligne 3 : Profil Poste, Mises à jour & Sauvegardes Binaires (Grille 2 colonnes) -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start pb-2">

        <!-- Colonne gauche : Profil du poste + Auto-Updater -->
        <div class="lg:col-span-6 flex flex-col gap-4">

          <!-- Carte Profil de la Machine (Foyer vs Vie Scolaire) -->
          <div class="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4">
            <div class="flex flex-col gap-3">
              <div class="flex items-center gap-3.5">
                <div class="w-11 h-11 rounded-2xl ${appProfile === 'visco' ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20' : 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20'} flex items-center justify-center font-bold flex-shrink-0">
                  ${appProfile === 'visco' ? Icons.vault('w-5 h-5') : Icons.cart('w-5 h-5')}
                </div>
                <div>
                  <div class="flex items-center gap-2 flex-wrap">
                    <h2 class="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">Profil d'Utilisation de ce PC</h2>
                    <span class="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide border ${appProfile === 'visco' ? 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30' : 'bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30'}">
                      ${appProfile === 'visco' ? 'Poste Vie Scolaire (Contrôle & Coffre)' : 'Poste Foyer (Caisse & Vente)'}
                    </span>
                  </div>
                  <p class="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                    Adaptez l'interface au rôle de ce poste : caisse de vente ou contrôle décaisse/coffre pour la Vie Scolaire.
                  </p>
                </div>
              </div>

              <!-- Boutons de bascule de profil -->
              <div class="flex items-center gap-1.5 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 w-full">
                <button
                  type="button"
                  data-app-profile="foyer"
                  class="flex-1 px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    appProfile === 'foyer'
                      ? 'bg-white dark:bg-slate-900 text-orange-600 dark:text-orange-400 shadow-xs border border-slate-200/60 dark:border-slate-700'
                      : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  }"
                >
                  ${Icons.cart('w-3.5 h-3.5')}
                  <span>Poste Foyer (Caisse)</span>
                </button>
                <button
                  type="button"
                  data-app-profile="visco"
                  class="flex-1 px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    appProfile === 'visco'
                      ? 'bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-xs border border-slate-200/60 dark:border-slate-700'
                      : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  }"
                >
                  ${Icons.vault('w-3.5 h-3.5')}
                  <span>Poste Vie Scolaire (Décaisse)</span>
                </button>
              </div>
            </div>

            <div class="p-3 rounded-2xl ${appProfile === 'visco' ? 'bg-sky-500/5 border border-sky-500/15 text-sky-800 dark:text-sky-200' : 'bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400'} text-xs leading-relaxed">
              ${appProfile === 'visco'
                ? '<strong>Mode Vie Scolaire actif :</strong> Le dashboard de vente au comptoir est masqué. L\'interface se focalise sur le registre des décaissements, la répartition des coupures remises au coffre, le visa des dépôts et les bénévoles habilités. La réplication locale conserve toutes les données hors-ligne même si le PC foyer est éteint.'
                : '<strong>Mode Caisse Foyer actif :</strong> Toutes les fonctionnalités de vente, catalogue, restock et encaissement sont disponibles au comptoir du foyer.'
              }
            </div>
          </div>

          <!-- Carte Mise à Jour du Logiciel (Tauri Auto-Updater) -->
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

        </div>

        <!-- Colonne droite : Données & Sauvegardes Binaires / RAZ / Démo -->
        <div class="lg:col-span-6 flex flex-col gap-4">

          <div class="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-3.5">
            <div class="space-y-3.5">
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

              <!-- Historique des sauvegardes automatiques -->
              <button
                type="button"
                id="btn-show-backups-history"
                class="w-full py-2.5 px-3 rounded-2xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/60 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                ${Icons.clock('w-3.5 h-3.5 text-slate-400')}
                <span>Historique des sauvegardes automatiques</span>
              </button>
            </div>

            <!-- Actions sensibles : RAZ & Données Démo -->
            <div class="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
              <div class="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Maintenance & Données de test</div>
              <div class="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  id="btn-clean-data"
                  class="py-2 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/30 dark:hover:bg-rose-950/50 border border-rose-200/80 dark:border-rose-900/40 text-rose-700 dark:text-rose-300 font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer text-center"
                >
                  ${Icons.trash('w-3.5 h-3.5')}
                  <span>Remise à zéro</span>
                </button>

                <button
                  type="button"
                  id="btn-seed-demo"
                  class="py-2 px-3 rounded-xl bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/30 dark:hover:bg-sky-950/50 border border-sky-200/80 dark:border-sky-900/40 text-sky-700 dark:text-sky-300 font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer text-center"
                >
                  ${Icons.trendingUp('w-3.5 h-3.5')}
                  <span>Charger démo</span>
                </button>
              </div>
            </div>
          </div>

        </div>

      </div>
    `;
  }

  private attachEventListeners(container: HTMLElement): void {
    if (!db.hasPermission('canAccessSystem')) return;

    // Retour vers Paramètres
    container.querySelector('#btn-goto-settings')?.addEventListener('click', () => {
      this.onNavigate?.('settings');
    });

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

    // Sélection du profil de poste (Foyer vs Vie Scolaire)
    container.querySelectorAll('[data-app-profile]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const profile = (e.currentTarget as HTMLElement).getAttribute('data-app-profile') as any;
        if (!profile) return;
        db.setAppProfile(profile);
        if (this.onSettingsChanged) {
          this.onSettingsChanged();
        } else {
          this.refresh(container);
        }
      });
    });

    // Sélection du mode de synchronisation (Autonome, LAN, USB)
    container.querySelectorAll('[data-sync-mode]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const mode = (e.currentTarget as HTMLElement).getAttribute('data-sync-mode') as any;
        if (!mode) return;
        await syncService.saveConfig({ mode });
        this.syncFeedbackMessage = null;
        if (this.onSettingsChanged) {
          this.onSettingsChanged();
        } else {
          this.refresh(container);
        }
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
        if (this.onSettingsChanged) {
          this.onSettingsChanged();
        } else {
          this.refresh(container);
        }
      });
    });

    // Vérification de l'intégrité de la base SQLite
    container.querySelector('#btn-optimize-sqlite-db')?.addEventListener('click', () => {
      const stats = {
        products: db.getProducts().length,
        sales: db.getSales().length,
        sessions: db.getSessions().length,
        volunteers: db.getVolunteers().length,
        messages: db.getChatMessages('all').length
      };

      AppDialog.alert({
        title: 'Intégrité SQLite Confirmée',
        message: `La base de données locale SQLite embarquée est saine et intègre (PRAGMA integrity_check = OK).\n` +
          `• Ventes enregistrées : ${stats.sales}\n` +
          `• Produits au catalogue : ${stats.products}\n` +
          `• Sessions de caisse : ${stats.sessions}\n` +
          `• Bénévoles actifs : ${stats.volunteers}\n` +
          `Le stockage est optimisé et synchronisé localement avec 0 dépendance externe.`,
        type: 'success',
        confirmText: 'Parfait'
      });
    });

    // Slide / Bascule Moteur SQLite <-> MySQL / MariaDB
    const updateFeedbackBanner = (text: string, type: 'success' | 'error' | 'info') => {
      SystemView.extDbFeedback = { text, type };
      const banner = container.querySelector('#extdb-feedback-banner') as HTMLElement | null;
      if (!banner) return;
      banner.textContent = text;
      banner.className = `p-3 rounded-2xl text-xs font-bold border ${
        type === 'success'
          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-300'
          : type === 'error'
            ? 'bg-rose-500/10 border-rose-500/20 text-rose-700 dark:text-rose-300'
            : 'bg-sky-500/10 border-sky-500/20 text-sky-700 dark:text-sky-300'
      }`;
    };

    const readExternalFormValues = (): ExternalDatabaseConfig => {
      const dialectEl = container.querySelector('#select-extdb-dialect') as HTMLSelectElement | null;
      const hostEl = container.querySelector('#input-extdb-host') as HTMLInputElement | null;
      const portEl = container.querySelector('#input-extdb-port') as HTMLInputElement | null;
      const nameEl = container.querySelector('#input-extdb-name') as HTMLInputElement | null;
      const userEl = container.querySelector('#input-extdb-user') as HTMLInputElement | null;
      const passEl = container.querySelector('#input-extdb-pass') as HTMLInputElement | null;
      const sslEl = container.querySelector('#toggle-extdb-ssl') as HTMLInputElement | null;
      const invalidCertEl = container.querySelector('#toggle-extdb-accept-invalid') as HTMLInputElement | null;
      const intervalEl = container.querySelector('#input-extdb-interval') as HTMLInputElement | null;

      const fallback = {
        ...DEFAULT_DATABASE_CONFIG.external!,
        ...(db.getDatabaseConfig().external || {}),
        ...(SystemView.draftExternal || {})
      };
      const portVal = portEl ? parseInt(portEl.value, 10) : fallback.port;
      const intervalVal = intervalEl ? parseInt(intervalEl.value, 10) : (fallback.syncIntervalSec || 15);
      const sslChecked = sslEl ? sslEl.checked : Boolean(fallback.ssl);

      const cfg: ExternalDatabaseConfig = {
        dialect: (dialectEl?.value === 'mariadb' ? 'mariadb' : 'mysql'),
        host: hostEl ? hostEl.value.trim() : fallback.host,
        port: Number.isFinite(portVal) && portVal > 0 ? portVal : 3306,
        database: nameEl ? nameEl.value.trim() : fallback.database,
        username: userEl ? userEl.value.trim() : fallback.username,
        password: passEl ? passEl.value : fallback.password,
        ssl: sslChecked,
        acceptInvalidCerts: sslChecked && (invalidCertEl ? invalidCertEl.checked : Boolean(fallback.acceptInvalidCerts)),
        syncIntervalSec: Number.isFinite(intervalVal) && intervalVal >= 5 ? intervalVal : 15
      };
      cfg.url = buildDatabaseUrl(cfg);
      return cfg;
    };

    container.querySelector('#btn-engine-sqlite')?.addEventListener('click', () => {
      SystemView.draftEngine = 'sqlite';
      SystemView.draftExternal = null;
      SystemView.extDbFeedback = null;
      db.updateDatabaseConfig({ engine: 'sqlite', status: 'connected', lastError: undefined });
      this.refresh(container);
    });

    container.querySelector('#btn-engine-mysql')?.addEventListener('click', () => {
      SystemView.draftEngine = 'mysql';
      SystemView.extDbFeedback = null;
      this.refresh(container);
    });

    container.querySelector('#btn-toggle-extdb-pass')?.addEventListener('click', () => {
      this.showExtDbPassword = !this.showExtDbPassword;
      const passEl = container.querySelector('#input-extdb-pass') as HTMLInputElement | null;
      const btnEl = container.querySelector('#btn-toggle-extdb-pass');
      if (passEl) {
        passEl.type = this.showExtDbPassword ? 'text' : 'password';
      }
      if (btnEl) {
        btnEl.innerHTML = this.showExtDbPassword ? Icons.eyeOff('w-3.5 h-3.5') : Icons.eye('w-3.5 h-3.5');
      }
    });

    const urlInputEl = container.querySelector('#input-extdb-url') as HTMLInputElement | null;
    const syncUrlFromFields = () => {
      const cfg = readExternalFormValues();
      SystemView.draftExternal = cfg;
      if (urlInputEl) {
        urlInputEl.value = cfg.url || '';
      }
      const wrapInvalid = container.querySelector('#wrap-extdb-accept-invalid');
      if (wrapInvalid) {
        if (cfg.ssl) {
          wrapInvalid.classList.remove('hidden');
          wrapInvalid.classList.add('inline-flex');
        } else {
          wrapInvalid.classList.add('hidden');
          wrapInvalid.classList.remove('inline-flex');
        }
      }
    };

    const handleUrlChange = () => {
      if (!urlInputEl) return;
      const parsed = parseDatabaseUrl(urlInputEl.value);
      if (!parsed) return;
      const dialectEl = container.querySelector('#select-extdb-dialect') as HTMLSelectElement | null;
      const hostEl = container.querySelector('#input-extdb-host') as HTMLInputElement | null;
      const portEl = container.querySelector('#input-extdb-port') as HTMLInputElement | null;
      const nameEl = container.querySelector('#input-extdb-name') as HTMLInputElement | null;
      const userEl = container.querySelector('#input-extdb-user') as HTMLInputElement | null;
      const passEl = container.querySelector('#input-extdb-pass') as HTMLInputElement | null;
      const sslEl = container.querySelector('#toggle-extdb-ssl') as HTMLInputElement | null;
      const invalidCertEl = container.querySelector('#toggle-extdb-accept-invalid') as HTMLInputElement | null;

      if (dialectEl && parsed.dialect) dialectEl.value = parsed.dialect;
      if (hostEl && parsed.host) hostEl.value = parsed.host;
      if (portEl && parsed.port) portEl.value = String(parsed.port);
      if (nameEl && parsed.database) nameEl.value = parsed.database;
      if (userEl && parsed.username !== undefined) userEl.value = parsed.username;
      if (passEl && parsed.password !== undefined) passEl.value = parsed.password;
      if (sslEl && parsed.ssl !== undefined) sslEl.checked = parsed.ssl;
      if (invalidCertEl && parsed.acceptInvalidCerts !== undefined) invalidCertEl.checked = parsed.acceptInvalidCerts;

      const wrapInvalid = container.querySelector('#wrap-extdb-accept-invalid');
      if (wrapInvalid && sslEl) {
        if (sslEl.checked) {
          wrapInvalid.classList.remove('hidden');
          wrapInvalid.classList.add('inline-flex');
        } else {
          wrapInvalid.classList.add('hidden');
          wrapInvalid.classList.remove('inline-flex');
        }
      }

      SystemView.draftExternal = readExternalFormValues();
    };

    urlInputEl?.addEventListener('input', handleUrlChange);
    urlInputEl?.addEventListener('change', handleUrlChange);

    ['#select-extdb-dialect', '#input-extdb-host', '#input-extdb-port', '#input-extdb-name', '#input-extdb-user', '#input-extdb-pass', '#toggle-extdb-ssl', '#toggle-extdb-accept-invalid', '#input-extdb-interval'].forEach(sel => {
      const el = container.querySelector(sel);
      el?.addEventListener('input', syncUrlFromFields);
      el?.addEventListener('change', syncUrlFromFields);
    });

    container.querySelector('#btn-test-extdb')?.addEventListener('click', async () => {
      const ext = readExternalFormValues();
      SystemView.draftExternal = ext;
      updateFeedbackBanner('Test de connexion MySQL / MariaDB en cours...', 'info');

      const res = await db.testExternalDatabase(ext);
      updateFeedbackBanner(res.message, res.success ? 'success' : 'error');
    });

    container.querySelector('#btn-save-extdb')?.addEventListener('click', async () => {
      const ext = readExternalFormValues();
      SystemView.draftEngine = 'mysql';
      SystemView.draftExternal = ext;
      db.updateDatabaseConfig({ engine: 'mysql', external: ext });
      updateFeedbackBanner('Connexion et synchronisation initiale en cours...', 'info');

      const syncRes = await db.syncFromExternalDatabase();
      SystemView.extDbFeedback = {
        text: syncRes.message,
        type: syncRes.success ? 'success' : 'error'
      };
      this.refresh(container);

      if (syncRes.success && syncRes.emptyRemote) {
        AppDialog.confirm({
          title: 'Base MySQL / MariaDB vierge détectée',
          message: 'Le serveur externe est connecté et les tables relationnelles ont été créées, mais elles sont encore vides.\nVoulez-vous y transférer dès maintenant vos données SQLite locales (produits, bénévoles, ventes, séances) ?',
          confirmText: 'Migrer mes données',
          cancelText: 'Plus tard',
          onConfirm: async () => {
            const migRes = await db.migrateLocalToExternalDatabase(ext);
            SystemView.extDbFeedback = { text: migRes.message, type: migRes.success ? 'success' : 'error' };
            this.refresh(container);
          }
        });
      }
    });

    container.querySelector('#btn-migrate-extdb')?.addEventListener('click', () => {
      const ext = readExternalFormValues();
      AppDialog.confirm({
        title: 'Migrer SQLite → MySQL / MariaDB',
        message: 'Cette opération va envoyer l\'ensemble de votre cache SQLite local (catalogue, ventes, séances, bénévoles, chat, réglages) vers le serveur MySQL/MariaDB externe configuré.',
        confirmText: 'Lancer la migration',
        cancelText: 'Annuler',
        onConfirm: async () => {
          SystemView.draftEngine = 'mysql';
          SystemView.draftExternal = ext;
          db.updateDatabaseConfig({ engine: 'mysql', external: ext });
          SystemView.extDbFeedback = { text: 'Migration vers MySQL / MariaDB en cours...', type: 'info' };
          this.refresh(container);
          const migRes = await db.migrateLocalToExternalDatabase(ext);
          SystemView.extDbFeedback = { text: migRes.message, type: migRes.success ? 'success' : 'error' };
          this.refresh(container);
        }
      });
    });

    container.querySelector('#btn-sync-extdb')?.addEventListener('click', async () => {
      const ext = readExternalFormValues();
      SystemView.draftEngine = 'mysql';
      SystemView.draftExternal = ext;
      db.updateDatabaseConfig({ engine: 'mysql', external: ext });
      updateFeedbackBanner('Synchronisation avec MySQL / MariaDB en cours...', 'info');
      const syncRes = await db.syncFromExternalDatabase();
      SystemView.extDbFeedback = { text: syncRes.message, type: syncRes.success ? 'success' : 'error' };
      this.refresh(container);
    });

    container.querySelector('#btn-clear-pending-extdb')?.addEventListener('click', () => {
      AppDialog.confirm({
        title: 'Vider la file d\'attente hors-ligne',
        message: 'Voulez-vous supprimer toutes les opérations en attente dans pending_sync_ops ? Utilisez ceci uniquement si une ancienne écriture bloque la synchronisation.',
        confirmText: 'Vider la file',
        cancelText: 'Annuler',
        onConfirm: async () => {
          await db.clearPendingExternalSyncOps();
          SystemView.extDbFeedback = { text: 'File d\'attente hors-ligne vidée.', type: 'info' };
          this.refresh(container);
        }
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
            .filter(lb => !diskBackups.some(d => d.fileName === lb.fileName))
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

    // Gestion de la section Mise à jour logicielle (Tauri Auto-Updater)
    this.updaterUnsubscribe?.();
    this.updaterUnsubscribe = null;
    const cardSoftwareUpdate = container.querySelector('#card-software-update') as HTMLElement | null;
    if (cardSoftwareUpdate) {
      this.updaterUnsubscribe = updater.subscribe((state) => {
        this.renderUpdaterSection(cardSoftwareUpdate, state);
      });
    }
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
    this.updaterUnsubscribe?.();
    this.updaterUnsubscribe = null;
    const parent = container.parentElement;
    if (parent) {
      const prevScroll = container.scrollTop;
      const newEl = this.render();
      parent.replaceChild(newEl, container);
      newEl.scrollTop = prevScroll;
    }
  }
}
