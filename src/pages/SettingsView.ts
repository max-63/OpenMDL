import { db } from '../services/db';
import { Icons } from '../components/Icons';
import { escapeHtml, openExternalUrl } from '../utils/security';
import { updater } from '../services/updater';
import {
  PerkEligibilityRule,
  EURO_DENOMINATIONS,
  PERMISSION_FLAGS_META,
  UserPermissions,
  VolunteerPerkMode,
  VolunteerPerkPolicy,
  DEFAULT_VOLUNTEER_PERK_POLICY,
  getDefaultPermissionsForRole,
  resolveVolunteerPermissions
} from '../types';
import { AppDialog } from '../components/AppDialog';
import { kofiService } from '../services/kofiService';

export class SettingsView {
  private onSettingsChanged?: () => void;
  private onNavigate?: (tab: string) => void;
  private feedbackMessage: { text: string; type: 'success' | 'error' | 'info' } | null = null;
  private editingPasswordUserId: string | null = null;
  private editingNameUserId: string | null = null;
  private editingPermissionsUserId: string | null = null;
  private revealedPasswords: Set<string> = new Set();

  private formatPerkPolicyBadge(policy?: VolunteerPerkPolicy): { label: string; classes: string } {
    const mode = policy?.mode || 'inherit';
    if (mode === 'none') {
      return {
        label: 'Aucune conso',
        classes: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
      };
    }
    if (mode === 'custom') {
      const qty = Math.max(1, policy?.quantity || 1);
      const every = Math.max(1, policy?.everyNSessions || 1);
      const freq = every > 1 ? ` / ${every} séances` : ' / séance';
      const suffix = policy?.ignoreThreshold ? ' • sans seuil' : '';
      return {
        label: `${qty} conso${qty > 1 ? 's' : ''}${freq}${suffix}`,
        classes: 'bg-violet-500/10 text-violet-700 dark:text-violet-300 border border-violet-500/20'
      };
    }
    return {
      label: 'Conso : règle globale',
      classes: 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
    };
  }

  private getRoleBadge(role: string, isAdmin: boolean): { label: string; classes: string; isShield: boolean } {
    if (isAdmin) {
      return {
        label: 'Administrateur',
        classes: 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border border-orange-500/20 font-extrabold',
        isShield: true
      };
    }
    const r = (role || '').toLowerCase();
    if (r.includes('surveillant') || r.includes('vie scolaire') || r.includes('cpe') || r.includes('visco')) {
      return {
        label: 'Surveillant / Vie Scolaire',
        classes: 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/20 font-bold',
        isShield: false
      };
    }
    if (r.includes('bureau') || r.includes('trésor') || r.includes('tresor') || r.includes('président') || r.includes('secrét') || r.includes('cvl')) {
      return {
        label: role || 'Bureau MDL',
        classes: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20 font-bold',
        isShield: false
      };
    }
    return {
      label: role || 'Bénévole',
      classes: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 font-semibold',
      isShield: false
    };
  }

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

    const volunteers = db.getVolunteers();
    const currentVolunteer = db.getCurrentVolunteer();
    const isAdmin = !!currentVolunteer?.isAdmin;
    const canAccessSystem = db.hasPermission('canAccessSystem');
    const adminCount = volunteers.filter(v => v.isAdmin).length;
    const activeCount = volunteers.filter(v => !v.isSuspended).length;
    const suspendedCount = volunteers.filter(v => v.isSuspended).length;
    const perkSettings = db.getPerkSettings();
    const cashFloatSettings = db.getCashFloatSettings();
    const autoCalcEnabled = cashFloatSettings.autoCalculationEnabled !== false;
    const baseCashFloatTotal = db.calculateBaseCashFloatTotal(cashFloatSettings.baseCounts);
    const carriedDifferencesEntries = Object.entries(cashFloatSettings.carriedOverDifferences || {}).filter(([_, diff]) => diff !== 0);
    const chatSettings = db.getChatSettings();
    const defaultCreatePerms = getDefaultPermissionsForRole('Bénévole Permanence', false);

    container.innerHTML = `
      <!-- En-tête de la page Paramètres -->
      <div class="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div class="flex items-center gap-3.5">
          <div class="w-12 h-12 rounded-2xl bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20 flex items-center justify-center font-bold">
            ${Icons.settings('w-6 h-6')}
          </div>
          <div>
            <div class="flex items-center gap-2 flex-wrap">
              <h1 class="text-lg font-black text-slate-900 dark:text-white tracking-tight">Paramètres & Gestion</h1>
              <span class="px-2.5 py-0.5 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 text-[10px] font-extrabold uppercase tracking-wide border border-orange-500/20">
                ${isAdmin ? 'Espace Administrateur' : 'Gestion & Comptes'}
              </span>
            </div>
            <p class="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
              Gérez les comptes bénévoles, leurs permissions, la collation offerte et la messagerie du foyer.
            </p>
          </div>
        </div>

        <!-- Badges statistiques rapides & Raccourcis -->
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

          ${canAccessSystem ? `
            <button
              type="button"
              id="btn-goto-system"
              class="px-3 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer border border-emerald-500/25 ml-1"
              title="Ouvrir les réglages techniques (Base de données, LAN, Profil PC, Sauvegardes)"
            >
              ${Icons.server('w-4 h-4 text-emerald-500')}
              <span>Système</span>
            </button>
          ` : ''}

          <button 
            type="button" 
            id="btn-goto-credits"
            class="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer border border-slate-200 dark:border-slate-700"
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
            <span>${escapeHtml(this.feedbackMessage.text)}</span>
          </div>
          <button id="btn-close-feedback" class="hover:opacity-75 text-xs font-black cursor-pointer">&times;</button>
        </div>
      ` : ''}

      <!-- Grille Ligne 1 : Équipe & Utilisateurs -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-4">
        
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
                    <option value="Surveillant / Vie Scolaire">Surveillant / Vie Scolaire</option>
                    <option value="Bureau MDL">Bureau MDL</option>
                    <option value="Administrateur">Administrateur</option>
                  </select>
                </div>

                <!-- Privilèges Admin -->
                <div class="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between gap-3">
                  <div class="flex items-center gap-2">
                    ${Icons.shield('w-4 h-4 text-orange-500')}
                    <div>
                      <div class="text-xs font-bold text-slate-800 dark:text-slate-200">Droits Administrateur</div>
                      <div class="text-[10px] text-slate-400">Active l'ensemble des permissions par défaut</div>
                    </div>
                  </div>
                  <input 
                    type="checkbox" 
                    id="new-user-is-admin" 
                    class="w-4 h-4 rounded text-orange-600 focus:ring-orange-500 cursor-pointer accent-orange-600"
                  />
                </div>

                <!-- Flags de permissions granulaires -->
                <div class="p-3 rounded-2xl bg-slate-50/90 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/80 space-y-2">
                  <div class="flex items-center justify-between">
                    <span class="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Permissions du compte</span>
                    <span class="text-[10px] text-slate-400">Pré-remplies selon le rôle</span>
                  </div>
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    ${PERMISSION_FLAGS_META.map(flag => `
                      <label class="flex items-center gap-2 px-2 py-1.5 rounded-xl bg-white dark:bg-slate-900/70 border border-slate-200/70 dark:border-slate-700/60 cursor-pointer hover:border-orange-400 transition-colors" title="${escapeHtml(flag.description)}">
                        <input
                          type="checkbox"
                          data-create-perm="${flag.key}"
                          ${defaultCreatePerms[flag.key] ? 'checked' : ''}
                          class="w-3.5 h-3.5 rounded text-orange-600 focus:ring-orange-500 accent-orange-600 cursor-pointer flex-shrink-0"
                        />
                        <span class="text-[11px] font-semibold text-slate-700 dark:text-slate-200 truncate">${escapeHtml(flag.shortLabel)}</span>
                      </label>
                    `).join('')}
                  </div>
                </div>

                <!-- Politique de conso gratuite individuelle -->
                <div class="p-3 rounded-2xl bg-slate-50/90 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/80 space-y-2">
                  <div class="flex items-center justify-between">
                    <span class="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                      ${Icons.gift('w-3.5 h-3.5 text-orange-500')}
                      <span>Conso gratuite</span>
                    </span>
                  </div>
                  <select
                    id="new-user-perk-mode"
                    class="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white outline-none focus:border-orange-500"
                  >
                    <option value="inherit">Règle globale du foyer (par défaut)</option>
                    <option value="none">Aucune conso offerte (0)</option>
                    <option value="custom">Personnalisée (quantité & fréquence)</option>
                  </select>

                  <div id="new-user-perk-custom-fields" class="hidden space-y-2 pt-1">
                    <div class="grid grid-cols-2 gap-2">
                      <div>
                        <label for="new-user-perk-qty" class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nb consos</label>
                        <input
                          type="number"
                          id="new-user-perk-qty"
                          min="1"
                          max="20"
                          value="1"
                          class="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold text-slate-900 dark:text-white outline-none focus:border-orange-500"
                        />
                      </div>
                      <div>
                        <label for="new-user-perk-every" class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Toutes les N séances</label>
                        <input
                          type="number"
                          id="new-user-perk-every"
                          min="1"
                          max="20"
                          value="1"
                          title="1 = chaque séance, 2 = 1 fois sur 2, 4 = 1 fois sur 4"
                          class="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold text-slate-900 dark:text-white outline-none focus:border-orange-500"
                        />
                      </div>
                    </div>
                    <label class="flex items-center gap-2 text-[11px] font-semibold text-slate-600 dark:text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        id="new-user-perk-ignore-threshold"
                        class="w-3.5 h-3.5 rounded accent-orange-600 cursor-pointer"
                      />
                      <span>Ignorer le seuil de ventes/articles (dispo immédiatement)</span>
                    </label>
                  </div>
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
            <div class="space-y-2 overflow-y-auto pt-3 flex-1 pr-1 max-h-[620px]">
              ${volunteers.map(v => {
                const isCurrent = v.id === currentVolunteer?.id;
                const isRootAdmin = v.id === 'vol-admin' || v.username === 'admin';
                const isSuspended = !!v.isSuspended;
                const isEditingPassword = this.editingPasswordUserId === v.id;
                const isEditingName = this.editingNameUserId === v.id;
                const isEditingPerms = this.editingPermissionsUserId === v.id;
                const effPerms = resolveVolunteerPermissions(v);
                const roleBadge = this.getRoleBadge(v.role, v.isAdmin);
                const perkBadge = this.formatPerkPolicyBadge(v.perkPolicy);
                const userPolicy = v.perkPolicy || DEFAULT_VOLUNTEER_PERK_POLICY;
                const activeFlagLabels = PERMISSION_FLAGS_META.filter(f => effPerms[f.key]);
                const standardRoles = ['Bénévole Permanence', 'Surveillant / Vie Scolaire', 'Bureau MDL', 'Administrateur'];
                const hasCustomRole = v.role && !standardRoles.includes(v.role);

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

                      <!-- Badges Statut, Conso & Rôle -->
                      <div class="flex items-center gap-1.5 flex-wrap flex-shrink-0">
                        <span class="px-2 py-0.5 rounded-lg text-[10px] ${roleBadge.classes} flex items-center gap-1">
                          ${roleBadge.isShield ? Icons.shield('w-3 h-3') : ''}
                          <span>${escapeHtml(roleBadge.label)}</span>
                        </span>

                        <span class="px-2 py-0.5 rounded-lg text-[10px] font-bold ${perkBadge.classes}">
                          ${escapeHtml(perkBadge.label)}
                        </span>

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

                    <!-- Résumé visuel des flags de permissions -->
                    <div class="flex items-center gap-1 flex-wrap">
                      ${activeFlagLabels.length === 0 ? `
                        <span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20">Aucun droit actif</span>
                      ` : activeFlagLabels.map(f => `
                        <span class="px-1.5 py-0.5 rounded text-[9px] font-bold border ${
                          f.category === 'admin'
                            ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20'
                            : f.category === 'gestion'
                              ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                        }">${escapeHtml(f.shortLabel)}</span>
                      `).join('')}
                    </div>

                    <!-- Barre d'actions -->
                    <div class="pt-1.5 border-t border-slate-200/60 dark:border-slate-800 flex items-center justify-between gap-2 flex-wrap">
                      
                      <div class="flex items-center gap-1.5 flex-wrap">
                        <!-- Bouton modifier Permissions & Conso -->
                        <button
                          type="button"
                          data-toggle-perms-edit="${v.id}"
                          class="px-2.5 py-1 rounded-lg ${isEditingPerms
                            ? 'bg-orange-600 text-white shadow-xs'
                            : 'bg-orange-500/10 hover:bg-orange-500/20 text-orange-700 dark:text-orange-300 border border-orange-500/20'
                          } font-bold text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
                          title="Modifier le rôle, les permissions et la conso gratuite"
                        >
                          ${Icons.shield('w-3 h-3')}
                          <span>${isEditingPerms ? 'Fermer droits' : 'Permissions & Conso'}</span>
                        </button>

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

                    <!-- Sous-formulaire inline Permissions & Politique Conso -->
                    ${isEditingPerms ? `
                      <form data-form-edit-perms="${v.id}" class="mt-2 p-3.5 rounded-2xl bg-slate-100/90 dark:bg-slate-900/90 border border-orange-500/30 space-y-3 animate-enter">
                        <div class="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
                          <span class="text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                            ${Icons.shield('w-3.5 h-3.5 text-orange-500')}
                            <span>Permissions & Politique Conso de ${escapeHtml(v.name)}</span>
                          </span>
                          <div class="flex flex-wrap items-center gap-1">
                            <button type="button" data-preset-user="${v.id}" data-preset-role="Bénévole Permanence" data-preset-is-admin="0" class="px-2 py-0.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-bold hover:border-orange-400 cursor-pointer">Bénévole</button>
                            <button type="button" data-preset-user="${v.id}" data-preset-role="Surveillant / Vie Scolaire" data-preset-is-admin="0" class="px-2 py-0.5 rounded-lg bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20 text-[10px] font-bold hover:bg-sky-500/20 cursor-pointer">Surveillant</button>
                            <button type="button" data-preset-user="${v.id}" data-preset-role="Bureau MDL" data-preset-is-admin="0" class="px-2 py-0.5 rounded-lg bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20 text-[10px] font-bold hover:bg-indigo-500/20 cursor-pointer">Bureau MDL</button>
                            <button type="button" data-preset-user="${v.id}" data-preset-role="Administrateur" data-preset-is-admin="1" class="px-2 py-0.5 rounded-lg bg-orange-500/15 text-orange-600 dark:text-orange-400 border border-orange-500/20 text-[10px] font-bold hover:bg-orange-500/25 cursor-pointer">Admin</button>
                          </div>
                        </div>

                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <div>
                            <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Rôle affiché</label>
                            <select data-edit-role="${v.id}" class="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white outline-none focus:border-orange-500">
                              ${hasCustomRole ? `<option value="${escapeHtml(v.role)}" selected>${escapeHtml(v.role)}</option>` : ''}
                              ${standardRoles.map(sr => `<option value="${escapeHtml(sr)}" ${v.role === sr ? 'selected' : ''}>${escapeHtml(sr)}</option>`).join('')}
                            </select>
                          </div>
                          <div class="flex items-end">
                            <label class="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2 ${isRootAdmin ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}">
                              <span class="text-xs font-bold text-slate-700 dark:text-slate-200">Droits Administrateur</span>
                              <input type="checkbox" data-edit-is-admin="${v.id}" ${v.isAdmin ? 'checked' : ''} ${isRootAdmin ? 'disabled' : ''} class="w-4 h-4 rounded accent-orange-600" />
                            </label>
                          </div>
                        </div>

                        <div class="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                          ${PERMISSION_FLAGS_META.map(flag => {
                            const locked = isRootAdmin && (flag.key === 'canManageUsers' || flag.key === 'canAccessSystem');
                            return `
                              <label class="flex items-center gap-1.5 px-2 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 ${locked ? 'opacity-65 cursor-not-allowed' : 'cursor-pointer hover:border-orange-400'} transition-colors" title="${escapeHtml(flag.description)}">
                                <input
                                  type="checkbox"
                                  data-edit-perm="${v.id}:${flag.key}"
                                  data-edit-perm-user="${v.id}"
                                  data-edit-perm-key="${flag.key}"
                                  ${effPerms[flag.key] ? 'checked' : ''}
                                  ${locked ? 'disabled' : ''}
                                  class="w-3.5 h-3.5 rounded accent-orange-600 flex-shrink-0"
                                />
                                <span class="text-[10px] font-bold text-slate-700 dark:text-slate-200 truncate">${escapeHtml(flag.shortLabel)}</span>
                              </label>
                            `;
                          }).join('')}
                        </div>

                        <div class="p-3 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-2">
                          <div class="flex flex-wrap items-center justify-between gap-2">
                            <span class="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1">
                              ${Icons.gift('w-3.5 h-3.5 text-orange-500')}
                              <span>Conso gratuite individuelle</span>
                            </span>
                            <div class="flex flex-wrap items-center gap-1">
                              <button type="button" data-quick-perk-user="${v.id}" data-quick-perk="none" class="px-2 py-0.5 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[10px] font-bold hover:bg-rose-500/20 cursor-pointer">Aucune</button>
                              <button type="button" data-quick-perk-user="${v.id}" data-quick-perk="1-1" class="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-[10px] font-bold hover:bg-slate-200 cursor-pointer">1 / séance</button>
                              <button type="button" data-quick-perk-user="${v.id}" data-quick-perk="2-2" class="px-2 py-0.5 rounded bg-violet-500/10 text-violet-700 dark:text-violet-300 text-[10px] font-bold hover:bg-violet-500/20 cursor-pointer">2 (1 fois / 2)</button>
                              <button type="button" data-quick-perk-user="${v.id}" data-quick-perk="4-1" class="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold hover:bg-emerald-500/20 cursor-pointer">4 / séance</button>
                            </div>
                          </div>

                          <select data-edit-perk-mode="${v.id}" class="w-full px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white outline-none focus:border-orange-500">
                            <option value="inherit" ${userPolicy.mode === 'inherit' ? 'selected' : ''}>Règle globale du foyer</option>
                            <option value="none" ${userPolicy.mode === 'none' ? 'selected' : ''}>Aucune conso offerte (0)</option>
                            <option value="custom" ${userPolicy.mode === 'custom' ? 'selected' : ''}>Personnalisée (quantité & fréquence)</option>
                          </select>

                          <div data-edit-perk-custom="${v.id}" class="${userPolicy.mode === 'custom' ? '' : 'hidden'} space-y-2 pt-1">
                            <div class="grid grid-cols-2 gap-2">
                              <div>
                                <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nb consos</label>
                                <input type="number" min="1" max="20" data-edit-perk-qty="${v.id}" value="${userPolicy.quantity || 1}" class="w-full px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold text-slate-900 dark:text-white" />
                              </div>
                              <div>
                                <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Toutes les N séances</label>
                                <input type="number" min="1" max="20" data-edit-perk-every="${v.id}" value="${userPolicy.everyNSessions || 1}" class="w-full px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold text-slate-900 dark:text-white" />
                              </div>
                            </div>
                            <label class="flex items-center gap-2 text-[11px] font-semibold text-slate-600 dark:text-slate-300 cursor-pointer">
                              <input type="checkbox" data-edit-perk-ignore="${v.id}" ${userPolicy.ignoreThreshold ? 'checked' : ''} class="w-3.5 h-3.5 rounded accent-orange-600 cursor-pointer" />
                              <span>Ignorer le seuil de ventes/articles (dispo immédiatement)</span>
                            </label>
                          </div>
                        </div>

                        <div class="flex items-center justify-end gap-2">
                          <button type="submit" class="px-4 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-extrabold text-xs shadow-xs cursor-pointer">
                            Enregistrer permissions & conso
                          </button>
                        </div>
                      </form>
                    ` : ''}

                  </div>
                `;
              }).join('')}
            </div>

          </div>
        </div>


      </div>

      <!-- ==================== LIGNE 2 : CAISSE, MESSAGERIE & OPTIONS ==================== -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start pb-2">

        <!-- 2.1 Colonne Gauche : Fond de Caisse + Messagerie (7 colonnes) -->
        <div class="lg:col-span-7 flex flex-col gap-4">
          <div class="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-3">
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

                <!-- Toggle Calcul Automatique de la Monnaie & des Pièces (Smart Drawer) -->
                <div 
                  id="row-auto-cash-calc-enabled" 
                  class="p-3 rounded-2xl bg-slate-50 hover:bg-slate-100/80 dark:bg-slate-800/50 dark:hover:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between gap-3 cursor-pointer transition-colors"
                >
                  <div class="pr-2">
                    <div class="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <span>Calcul automatique de la monnaie & des pièces</span>
                      <span class="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">Smart Drawer</span>
                    </div>
                    <div class="text-[10px] text-slate-500 dark:text-slate-400">
                      Optimise et décompose automatiquement les pièces/billets à rendre au client selon le tiroir. Désactivez pour un calcul manuel libre.
                    </div>
                  </div>
                  <div class="flex items-center gap-2 flex-shrink-0">
                    <span id="label-auto-cash-calc-enabled" class="text-[10px] font-black uppercase ${autoCalcEnabled ? 'text-emerald-500' : 'text-slate-400'}">
                      ${autoCalcEnabled ? 'Activé' : 'Manuel'}
                    </span>
                    <button 
                      type="button" 
                      id="btn-toggle-auto-cash-calc-enabled"
                      class="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out ${autoCalcEnabled ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'}"
                    >
                      <span id="dot-auto-cash-calc-enabled" class="inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition duration-200 ease-in-out my-0.5 ml-0.5 ${autoCalcEnabled ? 'translate-x-5' : 'translate-x-0'}"></span>
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

          <!-- 2.1bis Carte Messagerie Instantanée & Salons Locaux -->
          <div class="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-3">
            <div class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-2 text-xs font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                ${Icons.messageSquare('w-4 h-4 text-orange-500')}
                <span>Messagerie & Salons Locaux</span>
              </div>
              <span class="px-2 py-0.5 rounded-full text-[10px] font-black uppercase border ${
                chatSettings.enabled
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                  : 'bg-slate-500/10 text-slate-500 border-slate-500/20'
              }">
                ${chatSettings.enabled ? 'Active' : 'Désactivée'}
              </span>
            </div>

            <div class="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between gap-3">
              <div>
                <div class="text-xs font-bold text-slate-800 dark:text-slate-200">Activer le chat inter-postes</div>
                <div class="text-[10px] text-slate-400">Salons décentralisés & messages privés signés</div>
              </div>
              <button 
                type="button" 
                id="btn-toggle-chat-enabled"
                class="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out ${
                  chatSettings.enabled ? 'bg-orange-600' : 'bg-slate-300 dark:bg-slate-700'
                }"
              >
                <span class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out mt-0.5 ${
                  chatSettings.enabled ? 'translate-x-5.5' : 'translate-x-0.5'
                }"></span>
              </button>
            </div>

            ${chatSettings.enabled ? `
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div class="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 space-y-1.5">
                  <label for="select-chat-retention" class="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase">
                    Rétention avant purge auto
                  </label>
                  <select 
                    id="select-chat-retention"
                    class="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-white outline-none focus:border-orange-500 cursor-pointer"
                  >
                    <option value="15" ${chatSettings.retentionDays === 15 ? 'selected' : ''}>15 jours (Très léger)</option>
                    <option value="30" ${chatSettings.retentionDays === 30 ? 'selected' : ''}>30 jours (1 mois - Recommandé)</option>
                    <option value="70" ${chatSettings.retentionDays === 70 ? 'selected' : ''}>70 jours (1 trimestre scolaire)</option>
                    <option value="180" ${chatSettings.retentionDays === 180 ? 'selected' : ''}>180 jours (6 mois)</option>
                    <option value="0" ${chatSettings.retentionDays === 0 ? 'selected' : ''}>Illimitée (Conserver tous les messages)</option>
                  </select>
                </div>

                <div class="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 flex flex-col justify-center space-y-1">
                  <div class="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    ${Icons.shieldCheck('w-3.5 h-3.5 text-emerald-500 flex-shrink-0')}
                    <span>Messages signés anti-usurpation</span>
                  </div>
                  <div class="text-[10px] font-mono text-slate-400 truncate">
                    Salons : ${db.getChatChannels().map(c => '#' + c.name).join(', ')}
                  </div>
                </div>
              </div>
            ` : ''}
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

          <!-- 2.2.2 Carte Soutien au Projet OpenMDL (Ko-fi) -->
          <div class="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-3.5 relative overflow-hidden group">
            <div class="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-orange-500/5 blur-xl pointer-events-none"></div>
            
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2 text-xs font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                ${Icons.sparkles('w-4 h-4 text-orange-500')}
                <span>Soutenir le Projet OpenMDL</span>
              </div>
              <span class="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20">
                Ko-fi Flottant Actif
              </span>
            </div>

            <p class="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
              OpenMDL est développé bénévolement pour les Maisons des Lycéens. Le widget flottant officiel Ko-fi est actif en bas à droite de votre écran. Vous pouvez aussi ouvrir la page directement ci-dessous :
            </p>

            ${kofiService.checkOnline() ? `
              <button 
                type="button" 
                id="btn-settings-open-kofi"
                class="w-full py-2.5 px-4 rounded-2xl bg-orange-600 hover:bg-orange-500 text-white font-extrabold text-xs shadow-md shadow-orange-600/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer select-none"
              >
                <svg class="w-4 h-4 fill-current text-white" viewBox="0 0 24 24">
                  <path d="M23.881 8.948c-.773-4.085-4.859-4.593-4.859-4.593H.723c-.604 0-.679.798-.679.798s-.082 7.324-.022 11.822c.164 2.424 2.586 2.672 2.586 2.672s8.267-.023 11.966-.049c2.438-.426 2.683-2.566 2.658-3.734 4.352.24 7.422-2.831 6.649-6.916zm-11.062 3.511c-1.246 1.453-4.047 3.974-4.047 3.974s-2.8-2.521-4.047-3.974c-1.333-1.556-1.077-3.65.486-4.567 1.563-.917 3.561.047 3.561.047s1.998-.964 3.561-.047c1.563.917 1.819 3.011.486 4.567zm5.418 1.482c-.389 1.046-1.299 1.454-2.43 1.454h-.688V7.127h.688c1.131 0 2.041.408 2.43 1.454.412 1.11.412 3.253 0 4.363z"/>
                </svg>
                <span>Ouvrir Ko-fi dans le navigateur (Adrien Courault)</span>
                ${Icons.externalLink('w-3.5 h-3.5 text-white/80')}
              </button>
            ` : `
              <div class="p-3 rounded-2xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2">
                ${Icons.wifiOff('w-4 h-4 text-slate-400 flex-shrink-0')}
                <span>Connexion Internet requise pour afficher le module de soutien Ko-fi.</span>
              </div>
            `}
          </div>

          <!-- Mention discrète en bas de colonne droite -->
          <div class="text-center text-[10px] text-slate-400 dark:text-slate-500 py-0.5">
            OpenMDL v${escapeHtml(updater.getState().currentVersion)} • Logiciel Foyer & Vie Scolaire • <button type="button" data-action="goto-credits" class="underline hover:text-orange-500 cursor-pointer font-bold">Mentions & Crédits</button>
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

    // Raccourci vers l'onglet Système (autorisation canAccessSystem)
    container.querySelector('#btn-goto-system')?.addEventListener('click', () => {
      if (!db.hasPermission('canAccessSystem')) return;
      this.onNavigate?.('system');
    });

    // Activation / Désactivation du Chat
    container.querySelector('#btn-toggle-chat-enabled')?.addEventListener('click', () => {
      const current = db.getChatSettings();
      db.updateChatSettings({ enabled: !current.enabled });
      if (this.onSettingsChanged) {
        this.onSettingsChanged();
      } else {
        this.refresh(container);
      }
    });

    // Rétention du Chat (durée avant purge)
    container.querySelector('#select-chat-retention')?.addEventListener('change', (e) => {
      const val = parseInt((e.target as HTMLSelectElement).value, 10);
      db.updateChatSettings({ retentionDays: isNaN(val) ? 30 : val });
      this.refresh(container);
    });

    // Synchronisation live rôle -> permissions par défaut dans le formulaire de création
    const createRoleSelect = container.querySelector('#new-user-role') as HTMLSelectElement | null;
    const createIsAdminCheck = container.querySelector('#new-user-is-admin') as HTMLInputElement | null;
    const applyCreatePermPreset = (role: string, isAdminVal: boolean) => {
      const preset = getDefaultPermissionsForRole(role, isAdminVal);
      container.querySelectorAll('[data-create-perm]').forEach(el => {
        const input = el as HTMLInputElement;
        const key = input.getAttribute('data-create-perm') as keyof UserPermissions | null;
        if (key && key in preset) {
          input.checked = !!preset[key];
        }
      });
    };

    createRoleSelect?.addEventListener('change', () => {
      const roleVal = createRoleSelect.value;
      const shouldBeAdmin = roleVal.toLowerCase().includes('admin');
      if (createIsAdminCheck) {
        createIsAdminCheck.checked = shouldBeAdmin;
      }
      applyCreatePermPreset(roleVal, shouldBeAdmin);
    });

    createIsAdminCheck?.addEventListener('change', () => {
      applyCreatePermPreset(createRoleSelect?.value || '', createIsAdminCheck.checked);
    });

    container.querySelectorAll('[data-create-perm]').forEach(el => {
      el.addEventListener('change', () => {
        const input = el as HTMLInputElement;
        const key = input.getAttribute('data-create-perm') as keyof UserPermissions | null;
        if (key === 'canVisaDecaisse' && input.checked) {
          const viewEl = container.querySelector('[data-create-perm="canViewDecaisse"]') as HTMLInputElement | null;
          if (viewEl) viewEl.checked = true;
        } else if (key === 'canViewDecaisse' && !input.checked) {
          const visaEl = container.querySelector('[data-create-perm="canVisaDecaisse"]') as HTMLInputElement | null;
          if (visaEl) visaEl.checked = false;
        } else if (key === 'canEditCatalog' && input.checked) {
          const catEl = container.querySelector('[data-create-perm="canViewCatalog"]') as HTMLInputElement | null;
          if (catEl) catEl.checked = true;
        } else if (key === 'canViewCatalog' && !input.checked) {
          const editCatEl = container.querySelector('[data-create-perm="canEditCatalog"]') as HTMLInputElement | null;
          if (editCatEl) editCatEl.checked = false;
        }
      });
    });

    const createPerkModeSelect = container.querySelector('#new-user-perk-mode') as HTMLSelectElement | null;
    const createPerkCustomFields = container.querySelector('#new-user-perk-custom-fields') as HTMLElement | null;
    createPerkModeSelect?.addEventListener('change', () => {
      if (!createPerkCustomFields) return;
      if (createPerkModeSelect.value === 'custom') {
        createPerkCustomFields.classList.remove('hidden');
      } else {
        createPerkCustomFields.classList.add('hidden');
      }
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

      const permissions: Partial<UserPermissions> = {};
      container.querySelectorAll('[data-create-perm]').forEach(el => {
        const input = el as HTMLInputElement;
        const key = input.getAttribute('data-create-perm') as keyof UserPermissions | null;
        if (key) {
          permissions[key] = input.checked;
        }
      });

      const perkMode = (createPerkModeSelect?.value || 'inherit') as VolunteerPerkMode;
      const qtyVal = parseInt((container.querySelector('#new-user-perk-qty') as HTMLInputElement | null)?.value || '1', 10) || 1;
      const everyVal = parseInt((container.querySelector('#new-user-perk-every') as HTMLInputElement | null)?.value || '1', 10) || 1;
      const ignoreThreshold = !!(container.querySelector('#new-user-perk-ignore-threshold') as HTMLInputElement | null)?.checked;
      const perkPolicy: VolunteerPerkPolicy = {
        mode: perkMode,
        quantity: Math.max(1, qtyVal),
        everyNSessions: Math.max(1, everyVal),
        ignoreThreshold
      };

      const res = db.createUser({
        name: nameInput.value,
        username: usernameInput.value,
        password: passwordInput.value,
        role: roleSelect.value,
        isAdmin: isAdminCheck ? isAdminCheck.checked : false,
        permissions,
        perkPolicy
      });

      this.feedbackMessage = {
        text: res.message,
        type: res.success ? 'success' : 'error'
      };

      if (res.success) {
        formCreate.reset();
        applyCreatePermPreset('Bénévole Permanence', false);
        createPerkCustomFields?.classList.add('hidden');
      }
      this.refresh(container);
    });

    // Toggle édition Permissions & Conso par utilisateur
    container.querySelectorAll('[data-toggle-perms-edit]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = (e.currentTarget as HTMLElement).getAttribute('data-toggle-perms-edit');
        if (!id) return;
        this.editingPermissionsUserId = this.editingPermissionsUserId === id ? null : id;
        this.refresh(container);
      });
    });

    // Presets rapides dans l'éditeur inline d'un utilisateur
    container.querySelectorAll('[data-preset-user]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const el = e.currentTarget as HTMLElement;
        const userId = el.getAttribute('data-preset-user');
        const presetRole = el.getAttribute('data-preset-role') || '';
        const presetAdmin = el.getAttribute('data-preset-is-admin') === '1';
        if (!userId) return;

        const roleSel = container.querySelector(`[data-edit-role="${userId}"]`) as HTMLSelectElement | null;
        if (roleSel && Array.from(roleSel.options).some(o => o.value === presetRole)) {
          roleSel.value = presetRole;
        }
        const adminCb = container.querySelector(`[data-edit-is-admin="${userId}"]`) as HTMLInputElement | null;
        if (adminCb && !adminCb.disabled) {
          adminCb.checked = presetAdmin;
        }
        const preset = getDefaultPermissionsForRole(presetRole, adminCb ? adminCb.checked : presetAdmin);
        container.querySelectorAll(`[data-edit-perm-user="${userId}"]`).forEach(cb => {
          const inp = cb as HTMLInputElement;
          const key = inp.getAttribute('data-edit-perm-key') as keyof UserPermissions | null;
          if (key && !inp.disabled) {
            inp.checked = !!preset[key];
          }
        });
      });
    });

    // Rôle / IsAdmin / cohérence dans l'éditeur inline
    container.querySelectorAll('[data-edit-is-admin]').forEach(el => {
      el.addEventListener('change', () => {
        const inp = el as HTMLInputElement;
        const userId = inp.getAttribute('data-edit-is-admin');
        if (!userId) return;
        const roleSel = container.querySelector(`[data-edit-role="${userId}"]`) as HTMLSelectElement | null;
        const preset = getDefaultPermissionsForRole(roleSel?.value || '', inp.checked);
        container.querySelectorAll(`[data-edit-perm-user="${userId}"]`).forEach(cb => {
          const permInp = cb as HTMLInputElement;
          const key = permInp.getAttribute('data-edit-perm-key') as keyof UserPermissions | null;
          if (key && !permInp.disabled) {
            permInp.checked = !!preset[key];
          }
        });
      });
    });

    container.querySelectorAll('[data-edit-perm]').forEach(el => {
      el.addEventListener('change', () => {
        const inp = el as HTMLInputElement;
        const userId = inp.getAttribute('data-edit-perm-user');
        const key = inp.getAttribute('data-edit-perm-key') as keyof UserPermissions | null;
        if (!userId || !key) return;
        if (key === 'canVisaDecaisse' && inp.checked) {
          const viewEl = container.querySelector(`[data-edit-perm="${userId}:canViewDecaisse"]`) as HTMLInputElement | null;
          if (viewEl && !viewEl.disabled) viewEl.checked = true;
        } else if (key === 'canViewDecaisse' && !inp.checked) {
          const visaEl = container.querySelector(`[data-edit-perm="${userId}:canVisaDecaisse"]`) as HTMLInputElement | null;
          if (visaEl && !visaEl.disabled) visaEl.checked = false;
        } else if (key === 'canEditCatalog' && inp.checked) {
          const catEl = container.querySelector(`[data-edit-perm="${userId}:canViewCatalog"]`) as HTMLInputElement | null;
          if (catEl && !catEl.disabled) catEl.checked = true;
        } else if (key === 'canViewCatalog' && !inp.checked) {
          const editCatEl = container.querySelector(`[data-edit-perm="${userId}:canEditCatalog"]`) as HTMLInputElement | null;
          if (editCatEl && !editCatEl.disabled) editCatEl.checked = false;
        }
      });
    });

    // Toggle panneau perso conso & raccourcis rapides dans l'éditeur inline
    container.querySelectorAll('[data-edit-perk-mode]').forEach(sel => {
      sel.addEventListener('change', () => {
        const select = sel as HTMLSelectElement;
        const userId = select.getAttribute('data-edit-perk-mode');
        if (!userId) return;
        const customPanel = container.querySelector(`[data-edit-perk-custom="${userId}"]`) as HTMLElement | null;
        if (customPanel) {
          customPanel.classList.toggle('hidden', select.value !== 'custom');
        }
      });
    });

    container.querySelectorAll('[data-quick-perk-user]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const el = e.currentTarget as HTMLElement;
        const userId = el.getAttribute('data-quick-perk-user');
        const quick = el.getAttribute('data-quick-perk');
        if (!userId || !quick) return;

        const modeSel = container.querySelector(`[data-edit-perk-mode="${userId}"]`) as HTMLSelectElement | null;
        const customPanel = container.querySelector(`[data-edit-perk-custom="${userId}"]`) as HTMLElement | null;
        const qtyInput = container.querySelector(`[data-edit-perk-qty="${userId}"]`) as HTMLInputElement | null;
        const everyInput = container.querySelector(`[data-edit-perk-every="${userId}"]`) as HTMLInputElement | null;

        if (quick === 'none') {
          if (modeSel) modeSel.value = 'none';
          customPanel?.classList.add('hidden');
        } else {
          const [q, ev] = quick.split('-');
          if (modeSel) modeSel.value = 'custom';
          customPanel?.classList.remove('hidden');
          if (qtyInput) qtyInput.value = q;
          if (everyInput) everyInput.value = ev;
        }
      });
    });

    // Soumission éditeur inline Permissions & Conso
    container.querySelectorAll('[data-form-edit-perms]').forEach(form => {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const id = (e.currentTarget as HTMLElement).getAttribute('data-form-edit-perms');
        if (!id) return;

        const roleSel = container.querySelector(`[data-edit-role="${id}"]`) as HTMLSelectElement | null;
        const adminCb = container.querySelector(`[data-edit-is-admin="${id}"]`) as HTMLInputElement | null;
        const modeSel = container.querySelector(`[data-edit-perk-mode="${id}"]`) as HTMLSelectElement | null;
        const qtyInput = container.querySelector(`[data-edit-perk-qty="${id}"]`) as HTMLInputElement | null;
        const everyInput = container.querySelector(`[data-edit-perk-every="${id}"]`) as HTMLInputElement | null;
        const ignoreCb = container.querySelector(`[data-edit-perk-ignore="${id}"]`) as HTMLInputElement | null;

        const permissions: Partial<UserPermissions> = {};
        container.querySelectorAll(`[data-edit-perm-user="${id}"]`).forEach(cb => {
          const inp = cb as HTMLInputElement;
          const key = inp.getAttribute('data-edit-perm-key') as keyof UserPermissions | null;
          if (key) {
            permissions[key] = inp.checked;
          }
        });

        const perkPolicy: VolunteerPerkPolicy = {
          mode: (modeSel?.value || 'inherit') as VolunteerPerkMode,
          quantity: Math.max(1, parseInt(qtyInput?.value || '1', 10) || 1),
          everyNSessions: Math.max(1, parseInt(everyInput?.value || '1', 10) || 1),
          ignoreThreshold: !!ignoreCb?.checked
        };

        const res = db.updateUserPermissionsAndPerk(id, {
          role: roleSel?.value,
          isAdmin: adminCb ? adminCb.checked : undefined,
          permissions,
          perkPolicy
        });

        this.feedbackMessage = {
          text: res.message,
          type: res.success ? 'success' : 'error'
        };
        if (res.success) {
          this.editingPermissionsUserId = null;
        }
        this.refresh(container);
      });
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
    let isAutoCashCalcEnabled = currentCashFloatSettings.autoCalculationEnabled !== false;

    const rowCashFloatEnabled = container.querySelector('#row-cash-float-enabled') as HTMLElement | null;
    const btnToggleCashFloatEnabled = container.querySelector('#btn-toggle-cash-float-enabled') as HTMLButtonElement | null;
    const dotCashFloatEnabled = container.querySelector('#dot-cash-float-enabled') as HTMLElement | null;
    const labelCashFloatEnabled = container.querySelector('#label-cash-float-enabled') as HTMLElement | null;
    const badgeCashFloatActive = container.querySelector('#badge-cash-float-active') as HTMLElement | null;
    const cashFloatOptionsCollapsible = container.querySelector('#cash-float-options-collapsible') as HTMLElement | null;

    const rowAutoCashCalcEnabled = container.querySelector('#row-auto-cash-calc-enabled') as HTMLElement | null;
    const btnToggleAutoCashCalcEnabled = container.querySelector('#btn-toggle-auto-cash-calc-enabled') as HTMLButtonElement | null;
    const dotAutoCashCalcEnabled = container.querySelector('#dot-auto-cash-calc-enabled') as HTMLElement | null;
    const labelAutoCashCalcEnabled = container.querySelector('#label-auto-cash-calc-enabled') as HTMLElement | null;

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

    const updateAutoCashCalcUI = () => {
      if (btnToggleAutoCashCalcEnabled && dotAutoCashCalcEnabled && labelAutoCashCalcEnabled) {
        if (isAutoCashCalcEnabled) {
          btnToggleAutoCashCalcEnabled.className = 'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out bg-indigo-600';
          dotAutoCashCalcEnabled.className = 'inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition duration-200 ease-in-out my-0.5 ml-0.5 translate-x-5';
          labelAutoCashCalcEnabled.textContent = 'Activé';
          labelAutoCashCalcEnabled.className = 'text-[10px] font-black uppercase text-emerald-500';
        } else {
          btnToggleAutoCashCalcEnabled.className = 'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out bg-slate-300 dark:bg-slate-700';
          dotAutoCashCalcEnabled.className = 'inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition duration-200 ease-in-out my-0.5 ml-0.5 translate-x-0';
          labelAutoCashCalcEnabled.textContent = 'Manuel';
          labelAutoCashCalcEnabled.className = 'text-[10px] font-black uppercase text-slate-400';
        }
      }
    };

    rowCashFloatEnabled?.addEventListener('click', (e) => {
      e.preventDefault();
      isCashFloatEnabled = !isCashFloatEnabled;
      updateCashFloatEnabledUI();
      db.updateCashFloatSettings({ enabled: isCashFloatEnabled });
    });

    rowAutoCashCalcEnabled?.addEventListener('click', (e) => {
      e.preventDefault();
      isAutoCashCalcEnabled = !isAutoCashCalcEnabled;
      updateAutoCashCalcUI();
      db.updateCashFloatSettings({ autoCalculationEnabled: isAutoCashCalcEnabled });
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
        autoCalculationEnabled: isAutoCashCalcEnabled,
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

    container.querySelectorAll('#btn-goto-credits, [data-action="goto-credits"]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.onNavigate?.('credits');
      });
    });

    container.querySelector('#btn-settings-open-kofi')?.addEventListener('click', (e) => {
      e.preventDefault();
      openExternalUrl('https://ko-fi.com/adriencourault');
    });
  }

  private refresh(container: HTMLElement): void {
    const parent = container.parentElement;
    if (parent) {
      const prevScroll = container.scrollTop;
      const newEl = this.render();
      parent.replaceChild(newEl, container);
      newEl.scrollTop = prevScroll;
    }
  }
}
