import { db } from '../services/db';
import { Icons } from '../components/Icons';
import { escapeHtml } from '../utils/security';
import { updater, UpdateState } from '../services/updater';
import { PerkEligibilityRule } from '../types';

export class SettingsView {
  private feedbackMessage: { text: string; type: 'success' | 'error' } | null = null;
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

        <!-- Badges statistiques rapides -->
        <div class="flex items-center gap-2">
          <div class="px-3 py-2 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-center">
            <div class="text-[10px] font-bold text-slate-400 uppercase">Total</div>
            <div class="text-sm font-black text-slate-800 dark:text-slate-100">${volunteers.length}</div>
          </div>
          <div class="px-3 py-2 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-center">
            <div class="text-[10px] font-bold text-orange-500 uppercase">Admins CVL</div>
            <div class="text-sm font-black text-orange-600 dark:text-orange-400">${adminCount}</div>
          </div>
          <div class="px-3 py-2 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-center">
            <div class="text-[10px] font-bold text-emerald-500 uppercase">Actifs</div>
            <div class="text-sm font-black text-emerald-600 dark:text-emerald-400">${activeCount}</div>
          </div>
          <div class="px-3 py-2 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-center">
            <div class="text-[10px] font-bold text-rose-500 uppercase">Suspendus</div>
            <div class="text-sm font-black text-rose-600 dark:text-rose-400">${suspendedCount}</div>
          </div>
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

      <!-- Grille Principale : Formulaire de création + Tableau des utilisateurs -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 min-h-0">
        
        <!-- Colonne Gauche : Formulaire de Création d'Utilisateur (4 col) -->
        <div class="lg:col-span-5 flex flex-col gap-4">
          <div class="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
            
            <div class="flex items-center gap-2 text-xs font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
              ${Icons.userPlus('w-4 h-4 text-orange-500')}
              <span>Créer un nouvel utilisateur</span>
            </div>

            <p class="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Le délégué saisit les informations du bénévole (par exemple Jérémy) avec le mot de passe choisi par ce dernier.
            </p>

            <form id="create-user-form" class="space-y-3.5">
              
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
                  class="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-900 dark:text-white outline-none focus:border-orange-500 transition-colors placeholder:text-slate-400"
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
                    class="w-full pl-7 pr-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-mono font-medium text-slate-900 dark:text-white outline-none focus:border-orange-500 transition-colors placeholder:text-slate-400"
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
                  class="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-mono font-medium text-slate-900 dark:text-white outline-none focus:border-orange-500 transition-colors placeholder:text-slate-400"
                />
              </div>

              <!-- Rôle au sein de la MDL -->
              <div class="space-y-1">
                <label for="new-user-role" class="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase">
                  Rôle ou fonction au foyer
                </label>
                <select 
                  id="new-user-role" 
                  class="w-full px-3 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-900 dark:text-white outline-none focus:border-orange-500 transition-colors"
                >
                  <option value="Bénévole Permanence">Bénévole Permanence</option>
                  <option value="Membre CVL">Membre CVL</option>
                  <option value="Trésorier MDL">Trésorier MDL</option>
                  <option value="Secrétaire MDL">Secrétaire MDL</option>
                  <option value="Délégué élu CVL">Délégué élu CVL</option>
                </select>
              </div>

              <!-- Privilèges Admin -->
              <div class="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between gap-3">
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
                class="w-full py-3 px-4 rounded-2xl bg-orange-600 hover:bg-orange-500 text-white font-extrabold text-xs tracking-wide shadow-md shadow-orange-600/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                ${Icons.userPlus('w-4 h-4')}
                <span>Créer le compte utilisateur</span>
              </button>
            </form>
          </div>

          <!-- Carte Gestion des Données, Tests & Démonstration -->
          <div class="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
            <div class="flex items-center gap-2 text-xs font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
              ${Icons.database('w-4 h-4 text-orange-500')}
              <span>Gestion des Données & Démo</span>
            </div>

            <p class="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
              Basculez entre l'état 100% vierge (catalogue vide, compte unique admin / admin, aucune vente) et le mode démonstration (3 comptes, 10 produits avec photos et ventes simulées).
            </p>

            <div class="space-y-2.5 pt-1">
              <!-- Bouton Vider les données de test / Remise à zéro -->
              <button 
                type="button" 
                id="btn-clean-data" 
                class="w-full py-2.5 px-3.5 rounded-2xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-950/60 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 font-extrabold text-xs transition-all flex items-center justify-between cursor-pointer"
              >
                <div class="flex items-center gap-2">
                  ${Icons.trash('w-4 h-4')}
                  <span>Réinitialiser la caisse (App 100% Vierge)</span>
                </div>
                <span class="text-[10px] uppercase font-bold text-rose-500">Zéro Donnée</span>
              </button>

              <!-- Bouton Charger données de démo -->
              <button 
                type="button" 
                id="btn-seed-demo" 
                class="w-full py-2.5 px-3.5 rounded-2xl bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/40 dark:hover:bg-sky-950/60 border border-sky-200 dark:border-sky-900/50 text-sky-700 dark:text-sky-300 font-extrabold text-xs transition-all flex items-center justify-between cursor-pointer"
              >
                <div class="flex items-center gap-2">
                  ${Icons.trendingUp('w-4 h-4')}
                  <span>Charger les données de démo</span>
                </div>
                <span class="text-[10px] uppercase font-bold text-sky-500">Screenshots</span>
              </button>
            </div>
          </div>

          <!-- Carte Règle de la Collation Bénévole (Conso Gratuite) -->
          <div class="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2 text-xs font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                ${Icons.gift('w-4 h-4 text-orange-500')}
                <span>Collation Bénévole (Conso Offerte)</span>
              </div>
              <span id="badge-perk-active" class="text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${perkSettings.enabled ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' : 'bg-slate-500/10 text-slate-500 border border-slate-500/20'}">
                ${perkSettings.enabled ? 'Active' : 'Désactivée'}
              </span>
            </div>

            <p class="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
              Récompensez les bénévoles de permanence au foyer par une boisson ou un snack offert selon vos critères.
            </p>


            
            <form id="perk-settings-form" class="space-y-3.5 pt-1">
              <!-- Toggle Activer / Désactiver -->
              <div 
                id="row-perk-enabled" 
                class="p-3.5 rounded-2xl bg-slate-50 hover:bg-slate-100/80 dark:bg-slate-800/50 dark:hover:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between gap-3 cursor-pointer transition-colors"
              >
                <div>
                  <div class="text-xs font-bold text-slate-800 dark:text-slate-200">Autoriser la collation offerte</div>
                  <div class="text-[10px] text-slate-400">Permet aux bénévoles de sélectionner 1 boisson ou snack gratuit</div>
                </div>
                <div class="flex items-center gap-2.5">
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
              <div id="perk-options-collapsible" class="space-y-3.5 pt-1 ${perkSettings.enabled ? 'block' : 'hidden'}">
                <!-- Choix de la Règle -->
                <div class="space-y-1">
                  <label for="perk-rule-select" class="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase">
                    Condition d'obtention
                  </label>
                  <select 
                    id="perk-rule-select" 
                    class="w-full px-3 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-900 dark:text-white outline-none focus:border-orange-500 transition-colors cursor-pointer ${!perkSettings.enabled ? 'opacity-50 cursor-not-allowed' : ''}"
                    ${!perkSettings.enabled ? 'disabled' : ''}
                  >
                    <option value="items_sold" ${perkSettings.rule === 'items_sold' ? 'selected' : ''}>Nombre d'articles vendus (ex: 10 canettes/snacks)</option>
                    <option value="sales_count" ${perkSettings.rule === 'sales_count' ? 'selected' : ''}>Nombre de ventes / transactions (ex: 10 passages caisse)</option>
                    <option value="always" ${perkSettings.rule === 'always' ? 'selected' : ''}>Toujours offerte (Sans condition de volume)</option>
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
                      class="flex-1 px-3.5 py-2.5 bg-transparent text-xs font-mono font-bold text-slate-900 dark:text-white outline-none"
                      ${!perkSettings.enabled ? 'disabled' : ''}
                    />
                    <span class="px-3.5 py-2.5 text-xs font-bold text-slate-400 bg-slate-100/80 dark:bg-slate-700/50 border-l border-slate-200 dark:border-slate-700 flex-shrink-0" id="perk-threshold-unit">
                      ${perkSettings.rule === 'items_sold' ? 'articles' : 'ventes'}
                    </span>
                  </div>
                </div>

                <!-- Limite quotidienne -->
                <div 
                  id="row-perk-daily-limit" 
                  class="p-3.5 rounded-2xl bg-slate-50 hover:bg-slate-100/80 dark:bg-slate-800/50 dark:hover:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between gap-3 cursor-pointer transition-colors ${!perkSettings.enabled ? 'opacity-50 cursor-not-allowed' : ''}"
                >
                  <div>
                    <div class="text-xs font-bold text-slate-800 dark:text-slate-200">Plafond journalier strict</div>
                    <div class="text-[10px] text-slate-400">Maximum 1 seule collation offerte par bénévole par jour</div>
                  </div>
                  <div class="flex items-center gap-2.5">
                    <span id="label-perk-daily-limit" class="text-[10px] font-black uppercase ${!perkSettings.allowMultiplePerDay ? 'text-emerald-500' : 'text-slate-400'}">
                      ${!perkSettings.allowMultiplePerDay ? '1 max / jour' : 'Illimité'}
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
                  class="w-full py-2.5 px-4 rounded-2xl bg-orange-600 hover:bg-orange-500 text-white font-extrabold text-xs tracking-wide shadow-md shadow-orange-600/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  ${Icons.save('w-4 h-4')}
                  <span>Enregistrer les critères de collation</span>
                </button>
              </div>
            </form>
          </div>

          <!-- Carte Mise à Jour du Logiciel (Tauri Auto-Updater) -->
          <div class="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4" id="card-software-update">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2 text-xs font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                ${Icons.refresh('w-4 h-4 text-orange-500')}
                <span>Mise à Jour du Logiciel</span>
              </div>
              <span class="text-[11px] font-mono font-black px-2 py-0.5 rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20">
                v${escapeHtml(updater.getState().currentVersion)}
              </span>
            </div>

            <p class="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
              Vérifiez la disponibilité de nouvelles versions, téléchargez et appliquez automatiquement les mises à jour signées depuis GitHub.
            </p>

            <div id="updater-state-container" class="space-y-3 pt-1">
              <!-- Rendu dynamique géré par renderUpdaterSection -->
            </div>
          </div>

          <!-- Carte À Propos & Mentions Légales -->
          <div class="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-3">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2 text-xs font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                ${Icons.sparkles('w-4 h-4 text-orange-500')}
                <span>À Propos & Droits d'Auteur</span>
              </div>
              <span class="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700">
                Protégé
              </span>
            </div>

            <p class="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
              Développé avec soin par <strong>Adrien Courault</strong>, testé par <strong>Baly Jérémy</strong> pour les Maisons des Lycéens et CVL.
            </p>

            <button 
              type="button" 
              id="btn-goto-credits"
              class="w-full py-2.5 px-4 rounded-2xl bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700/80 text-slate-800 dark:text-slate-200 font-bold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer border border-slate-200 dark:border-slate-700"
            >
              ${Icons.shieldCheck('w-4 h-4 text-emerald-500')}
              <span>Consulter les Crédits & Mentions Légales</span>
            </button>
          </div>
        </div>

        <!-- Colonne Droite : Liste & Gestion des Utilisateurs (7 col) -->
        <div class="lg:col-span-7 flex flex-col gap-3">
          <div class="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-sm flex flex-col flex-1 min-h-0">
            
            <div class="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
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

            <!-- Liste des utilisateurs -->
            <div class="space-y-2.5 overflow-y-auto pt-4 flex-1 pr-1">
              ${volunteers.map(v => {
          const isCurrent = v.id === currentVolunteer?.id;
          const isSuspended = !!v.isSuspended;
          const isEditingPassword = this.editingPasswordUserId === v.id;
          const isEditingName = this.editingNameUserId === v.id;

          return `
                  <div class="p-4 rounded-2xl border ${isSuspended
              ? 'border-rose-200 dark:border-rose-950/60 bg-rose-50/30 dark:bg-rose-950/10'
              : 'border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-850/60'
            } transition-all space-y-3">
                    
                    <div class="flex items-center justify-between gap-3 flex-wrap">
                      
                      <!-- Infos utilisateur -->
                      <div class="flex items-center gap-3 min-w-0">
                        <div class="w-10 h-10 rounded-2xl flex items-center justify-center text-white font-black text-sm shadow-xs flex-shrink-0" style="background-color: ${v.avatarColor}">
                          ${v.name.charAt(0)}
                        </div>
                        
                        <div class="min-w-0">
                          <div class="flex items-center gap-2 flex-wrap">
                            <span class="font-extrabold text-sm text-slate-900 dark:text-white truncate">
                              ${escapeHtml(v.name)}
                            </span>
                            <span class="font-mono text-xs text-slate-400">
                              @${escapeHtml(v.username)}
                            </span>
                            ${isCurrent ? `
                              <span class="px-2 py-0.5 rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400 text-[10px] font-bold border border-orange-500/20">
                                Vous
                              </span>
                            ` : ''}
                          </div>
                          
                          <div class="flex items-center gap-2 mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                            <span>${escapeHtml(v.role)}</span>
                            <span>•</span>
                            <div class="flex items-center gap-1.5 font-mono text-[11px] text-slate-400">
                              <span>Mot de passe:</span>
                              <span class="${this.revealedPasswords.has(v.id) ? 'text-amber-600 dark:text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/20 font-mono text-xs' : 'font-bold tracking-widest text-slate-500'}">
                                ${this.revealedPasswords.has(v.id) ? escapeHtml(v.password) : '••••••••'}
                              </span>
                              <button 
                                type="button" 
                                data-toggle-reveal-pwd="${v.id}"
                                class="p-1 rounded-lg text-slate-400 hover:text-orange-500 hover:bg-slate-200 dark:hover:bg-slate-800 transition-all cursor-pointer"
                                title="${this.revealedPasswords.has(v.id) ? 'Masquer le mot de passe' : 'Afficher le mot de passe en clair'}"
                              >
                                ${this.revealedPasswords.has(v.id) ? Icons.eyeOff('w-3.5 h-3.5') : Icons.eye('w-3.5 h-3.5')}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>

                      <!-- Badges Statut & Rôle -->
                      <div class="flex items-center gap-2 flex-shrink-0">
                        ${v.isAdmin ? `
                          <span class="px-2.5 py-1 rounded-xl bg-orange-500/15 text-orange-600 dark:text-orange-400 font-extrabold text-[11px] border border-orange-500/20 flex items-center gap-1">
                            ${Icons.shield('w-3.5 h-3.5')}
                            Délégué CVL
                          </span>
                        ` : `
                          <span class="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold text-[11px]">
                            Bénévole
                          </span>
                        `}

                        ${isSuspended ? `
                          <span class="px-2.5 py-1 rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400 font-extrabold text-[11px] border border-rose-500/20 flex items-center gap-1">
                            ${Icons.userX('w-3.5 h-3.5')}
                            Suspendu
                          </span>
                        ` : `
                          <span class="px-2.5 py-1 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-extrabold text-[11px] border border-emerald-500/20 flex items-center gap-1">
                            ${Icons.check('w-3.5 h-3.5')}
                            Actif
                          </span>
                        `}
                      </div>
                    </div>

                    <!-- Barre d'actions -->
                    <div class="pt-2 border-t border-slate-200/60 dark:border-slate-800 flex items-center justify-between gap-2 flex-wrap">
                      
                      <div class="flex items-center gap-2">
                        <!-- Bouton modifier le nom / pseudo -->
                        <button 
                          type="button" 
                          data-toggle-name-edit="${v.id}"
                          class="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                          title="Modifier le nom affiché pour la caisse et le classement Pac-Man"
                        >
                          ${Icons.userCheck('w-3.5 h-3.5 text-slate-500')}
                          <span>${isEditingName ? 'Annuler' : 'Modifier le nom'}</span>
                        </button>

                        <!-- Bouton modifier le mot de passe -->
                        <button 
                          type="button" 
                          data-toggle-pwd-edit="${v.id}"
                          class="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          ${Icons.key('w-3.5 h-3.5 text-slate-500')}
                          <span>${isEditingPassword ? 'Annuler' : 'Modifier mot de passe'}</span>
                        </button>
                      </div>

                      <div class="flex items-center gap-2">
                        
                        <!-- Suspendre / Activer -->
                        ${!isCurrent ? `
                          <button 
                            type="button" 
                            data-action-suspend="${v.id}"
                            class="px-2.5 py-1.5 rounded-xl ${isSuspended
                ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/20'
              } font-bold text-xs transition-colors cursor-pointer flex items-center gap-1"
                          >
                            <span>${isSuspended ? 'Réactiver le compte' : 'Suspendre le compte'}</span>
                          </button>

                          <!-- Supprimer -->
                          <button 
                            type="button" 
                            data-action-delete="${v.id}"
                            data-action-delete-name="${v.name}"
                            class="px-2.5 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 font-bold text-xs transition-colors cursor-pointer flex items-center gap-1"
                            title="Supprimer ce compte définitivement"
                          >
                            ${Icons.trash('w-3.5 h-3.5')}
                            <span>Supprimer</span>
                          </button>
                        ` : `
                          <span class="text-[11px] font-medium text-slate-400 italic">
                            Votre compte principal (protégé)
                          </span>
                        `}
                      </div>
                    </div>

                    <!-- Sous-formulaire de modification de mot de passe si actif -->
                    ${isEditingPassword ? `
                      <form data-form-reset-pwd="${v.id}" class="mt-2 p-3 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center gap-2 animate-enter">
                        <input 
                          type="text" 
                          placeholder="Nouveau mot de passe" 
                          required
                          data-input-new-pass="${v.id}"
                          class="flex-1 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono font-medium text-slate-900 dark:text-white outline-none focus:border-orange-500"
                        />
                        <button 
                          type="submit" 
                          class="px-3 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-extrabold text-xs shadow-xs cursor-pointer"
                        >
                          Enregistrer
                        </button>
                      </form>
                    ` : ''}

                    <!-- Sous-formulaire de modification de nom si actif -->
                    ${isEditingName ? `
                      <form data-form-edit-name="${v.id}" class="mt-2 p-3 rounded-xl bg-orange-500/10 dark:bg-orange-950/30 border border-orange-500/30 flex items-center gap-2 animate-enter">
                        <input 
                          type="text" 
                          value="${escapeHtml(v.name)}" 
                          placeholder="Nouveau nom / prénom (ex: Adrien Martin, Sarah...)" 
                          required
                          data-input-new-name="${v.id}"
                          class="flex-1 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-orange-500"
                        />
                        <button 
                          type="submit" 
                          class="px-3.5 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-extrabold text-xs shadow-xs cursor-pointer flex-shrink-0"
                        >
                          Enregistrer le nom
                        </button>
                      </form>
                    ` : ''}

                  </div>
                `;
        }).join('')}
            </div>

          </div>
        </div>

      </div>
    `;
  }

  private attachEventListeners(container: HTMLElement): void {
    // Fermer le feedback
    container.querySelector('#btn-close-feedback')?.addEventListener('click', () => {
      this.feedbackMessage = null;
      this.refresh(container);
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

      const res = db.createUser({
        name: nameInput.value,
        username: usernameInput.value,
        password: passwordInput.value,
        role: roleSelect.value,
        isAdmin: isAdminCheck.checked
      });

      this.feedbackMessage = {
        text: res.message,
        type: res.success ? 'success' : 'error'
      };

      if (res.success) {
        this.refresh(container);
      } else {
        this.refresh(container);
      }
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

        if (confirm(`Confirmez-vous la suppression définitive du compte de ${name} ?`)) {
          const res = db.deleteUser(id);
          this.feedbackMessage = {
            text: res.message,
            type: res.success ? 'success' : 'error'
          };
          this.refresh(container);
        }
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

    // Bouton Remise à zéro propre (App 100% vierge)
    container.querySelector('#btn-clean-data')?.addEventListener('click', () => {
      if (confirm('Voulez-vous remettre l\'application complètement à zéro ? Le catalogue, les ventes, les sessions et TOUS les utilisateurs seront effacés pour ne conserver que l\'unique compte (admin / admin).')) {
        db.clearAllTestData(true, true);
        this.feedbackMessage = {
          text: 'Application 100% vierge ! Catalogue vide et unique compte actif : admin / admin.',
          type: 'success'
        };
        this.refresh(container);
      }
    });

    // Bouton Chargement Démo (pour screenshots et présentations)
    container.querySelector('#btn-seed-demo')?.addEventListener('click', () => {
      if (confirm('Charger les données de démonstration complètes (ventes sur plusieurs mois, statistiques et graphiques pour captures d\'écran) ?')) {
        db.seedDemoData();
        this.feedbackMessage = {
          text: 'Données de démonstration chargées avec succès ! Les graphiques et bilans sont remplis.',
          type: 'success'
        };
        this.refresh(container);
      }
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
    });

    perkForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      const rule = (perkRuleSelect?.value || 'items_sold') as PerkEligibilityRule;
      const threshold = Math.max(1, parseInt(perkThresholdInput?.value || '10', 10) || 10);

      db.updatePerkSettings({
        enabled: isPerkEnabled,
        rule,
        threshold,
        allowMultiplePerDay: !isPerkDailyLimitStrict
      });

      this.feedbackMessage = {
        text: isPerkEnabled
          ? 'Critères de collation bénévole enregistrés avec succès (Collation active) !'
          : 'La collation bénévole offerte a été DÉSACTIVÉE avec succès.',
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

    container.querySelector('#btn-goto-credits')?.addEventListener('click', () => {
      (window as any).OpenMDL?.navigation.goTo('credits');
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
