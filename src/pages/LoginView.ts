import { db } from '../services/db';
import { Icons } from '../components/Icons';
import { escapeHtml } from '../utils/security';
import { kofiService } from '../services/kofiService';

export class LoginView {
  private onLoginSuccess: () => void;
  private errorMessage: string | null = null;
  private selectedUsername: string = 'admin';
  private passwordValue: string = '';
  private showPassword: boolean = false;

  constructor(onLoginSuccess: () => void) {
    this.onLoginSuccess = onLoginSuccess;
  }

  public render(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'min-h-screen flex items-center justify-center p-4 bg-slate-100 dark:bg-[#090d16] text-slate-900 dark:text-slate-100 selection:bg-orange-500 selection:text-white';

    const volunteers = db.getVolunteers();
    const backups = db.getBackupsList();
    const latestBackup = backups.length > 0 ? backups[0] : null;

    container.innerHTML = `
      <!-- Contrôles Fenêtre Flottants (sans bandeau d'OS) -->
      <div class="fixed top-3 right-3 z-50 flex items-center gap-1 p-1 rounded-xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200 dark:border-slate-800 shadow-sm" id="login-win-controls" data-tauri-drag-region>
        <button id="btn-login-win-min" class="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-all" title="Réduire">
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
        <button id="btn-login-win-max" class="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-all" title="Agrandir / Restaurer">
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>
        </button>
        <button id="btn-login-win-close" class="w-7 h-7 rounded-lg text-slate-400 hover:text-white hover:bg-rose-600 flex items-center justify-center transition-all" title="Fermer">
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      <div class="w-full max-w-5xl space-y-5 animate-enter">
        
        <!-- En-tête : Marque & Rôle CVL (compact en ligne) -->
        <div class="flex items-center justify-center gap-3.5 text-left">
          <div class="w-20 h-14 rounded-2xl bg-white dark:bg-slate-800 p-1.5 border border-slate-200 dark:border-slate-700/80 shadow-md flex items-center justify-center overflow-hidden hover:scale-105 transition-transform flex-shrink-0">
            <img src="/assets/logo_banniere.png" alt="OpenMDL Logo" class="w-full h-full object-contain rounded-xl" />
          </div>
          <div>
            <h1 class="text-2xl font-black tracking-tight text-slate-900 dark:text-white leading-tight">OpenMDL</h1>
            <p class="text-[11px] font-bold text-orange-600 dark:text-orange-400 uppercase tracking-widest mt-0.5">
              Foyer des Lycéens • Maison des Lycéens
            </p>
          </div>
        </div>

        <!-- Disposition 2 cartes côte à côte -->
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">

          <!-- Carte 1 (Gauche) : Connexion Sécurisée -->
          <div class="lg:col-span-5 p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl flex flex-col justify-between gap-5">
            <div class="space-y-4">
              <div class="flex items-center justify-between gap-2">
                <div class="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  ${Icons.lock('w-4 h-4 text-orange-500')}
                  <span>Accès Sécurisé Permanence</span>
                </div>
                <span class="text-[11px] px-2 py-0.5 rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400 font-bold border border-orange-500/20 flex-shrink-0">
                  ${db.getAppProfile() === 'visco' ? 'Poste Vie Scolaire' : 'Poste Foyer'}
                </span>
              </div>

              <!-- Message d'erreur dynamique -->
              <div id="login-error-container" class="${this.errorMessage ? 'block' : 'hidden'} p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/25 text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center gap-2.5">
                ${Icons.alertTriangle('w-4 h-4 flex-shrink-0')}
                <span id="login-error-text">${escapeHtml(this.errorMessage || '')}</span>
              </div>

              <!-- Formulaire de Connexion -->
              <form id="login-form" class="space-y-4">
                
                <!-- Champ Identifiant -->
                <div class="space-y-1.5">
                  <label for="input-username" class="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Identifiant utilisateur
                  </label>
                  <div class="relative">
                    <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      ${Icons.user('w-4 h-4')}
                    </div>
                    <input 
                      type="text" 
                      id="input-username" 
                      autocomplete="username"
                      required
                      placeholder="ex: admin ou jeremy"
                      value="${escapeHtml(this.selectedUsername)}"
                      class="w-full pl-10 pr-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 focus:border-orange-500 dark:focus:border-orange-500 text-slate-900 dark:text-white text-sm font-medium outline-none transition-all placeholder:text-slate-400"
                    />
                  </div>
                </div>

                <!-- Champ Mot de passe -->
                <div class="space-y-1.5">
                  <div class="flex items-center justify-between">
                    <label for="input-password" class="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      Mot de passe
                    </label>
                  </div>
                  <div class="relative">
                    <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      ${Icons.key('w-4 h-4')}
                    </div>
                    <input 
                      type="${this.showPassword ? 'text' : 'password'}" 
                      id="input-password" 
                      autocomplete="current-password"
                      required
                      placeholder="Mot de passe du compte"
                      value="${escapeHtml(this.passwordValue)}"
                      class="w-full pl-10 pr-11 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 focus:border-orange-500 dark:focus:border-orange-500 text-slate-900 dark:text-white text-sm font-medium outline-none transition-all placeholder:text-slate-400 font-mono"
                    />
                    <button 
                      type="button" 
                      id="btn-toggle-pwd" 
                      tabindex="-1"
                      class="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                      title="${this.showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}"
                    >
                      ${this.showPassword ? Icons.eyeOff('w-4 h-4') : Icons.eye('w-4 h-4')}
                    </button>
                  </div>
                </div>

                <!-- Bouton de Connexion -->
                <button 
                  type="submit" 
                  id="btn-submit-login"
                  class="w-full mt-2 py-3 px-4 rounded-2xl bg-orange-600 hover:bg-orange-500 text-white font-extrabold text-sm tracking-wide shadow-md shadow-orange-600/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Se connecter</span>
                  <span class="text-xs font-black">→</span>
                </button>
              </form>
            </div>

            <div class="space-y-3">
              <!-- Note sur l'admin par défaut -->
              <div class="p-3 rounded-2xl bg-orange-500/5 border border-orange-500/15 text-[11px] text-slate-600 dark:text-slate-400 flex items-start gap-2">
                ${Icons.shield('w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5')}
                <div>
                  <span class="font-bold text-slate-900 dark:text-white">Compte administrateur initial :</span> 
                  identifiant <code class="px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-600 dark:text-orange-400 font-mono font-bold">admin</code> 
                  / mot de passe <code class="px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-600 dark:text-orange-400 font-mono font-bold">admin</code>. 
                  L'administrateur peut créer les comptes dans <strong>Paramètres</strong>.
                </div>
              </div>

              <!-- Statut base locale & sauvegarde -->
              <div class="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400 font-mono">
                <span class="flex items-center gap-1.5 font-sans font-medium text-emerald-600 dark:text-emerald-400">
                  <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
                  Base locale prête
                </span>
                ${latestBackup ? `<span>Dernière sauvegarde: ${new Date(latestBackup.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>` : ''}
              </div>
            </div>
          </div>

          <!-- Carte 2 (Droite) : Tous les utilisateurs sans scroll -->
          <div class="lg:col-span-7 p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl flex flex-col justify-between gap-4">
            <div class="space-y-4">
              <div class="flex items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div class="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  ${Icons.users('w-4 h-4 text-orange-500')}
                  <span>Sélection rapide de compte</span>
                </div>
                <span class="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                  ${volunteers.length} compte${volunteers.length > 1 ? 's' : ''}
                </span>
              </div>

              <div class="grid grid-cols-1 ${volunteers.length > 4 ? 'sm:grid-cols-2' : ''} gap-2.5" id="quick-volunteers-list">
                ${volunteers.map(v => {
                  const isSuspended = !!v.isSuspended;
                  const isSelected = v.username === this.selectedUsername;
                  const safeUser = escapeHtml(v.username);
                  const safeName = escapeHtml(v.name);
                  return `
                    <button 
                      type="button"
                      data-fill-user="${safeUser}"
                      class="w-full p-2.5 rounded-2xl border transition-all flex items-center justify-between gap-2.5 text-left group cursor-pointer ${
                        isSelected
                          ? 'border-orange-500 bg-orange-500/10 ring-1 ring-orange-500/30'
                          : 'border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 hover:border-orange-400 dark:hover:border-orange-500/50 hover:bg-orange-50/50 dark:hover:bg-slate-800'
                      } ${isSuspended ? 'opacity-50 grayscale' : ''}"
                    >
                      <div class="flex items-center gap-2.5 min-w-0 flex-1">
                        ${v.avatarUrl ? `
                          <img src="${escapeHtml(v.avatarUrl)}" alt="${safeName}" class="w-9 h-9 rounded-xl object-cover border border-slate-300 dark:border-slate-700 flex-shrink-0" />
                        ` : `
                          <div class="w-9 h-9 rounded-xl flex items-center justify-center text-white font-black text-xs flex-shrink-0 shadow-xs" style="background-color: ${v.avatarColor}">
                            ${safeName.charAt(0)}
                          </div>
                        `}
                        <div class="min-w-0 flex-1">
                          <div class="font-bold text-xs text-slate-800 dark:text-slate-200 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors truncate">
                            ${safeName}
                          </div>
                          <div class="text-[10px] text-slate-400 font-mono truncate">
                            @${safeUser}
                          </div>
                        </div>
                      </div>
                      <div class="flex items-center gap-1 flex-shrink-0">
                        ${v.isAdmin ? `
                          <span class="px-2 py-0.5 rounded-md bg-orange-500/15 text-orange-600 dark:text-orange-400 font-extrabold text-[10px] border border-orange-500/20">
                            Admin
                          </span>
                        ` : `
                          <span class="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-semibold text-[10px]">
                            Bénévole
                          </span>
                        `}
                        ${isSuspended ? `
                          <span class="px-1.5 py-0.5 rounded-md bg-rose-500/15 text-rose-600 dark:text-rose-400 font-extrabold text-[9px]">
                            Suspendu
                          </span>
                        ` : ''}
                      </div>
                    </button>
                  `;
                }).join('')}
              </div>
            </div>

            <div class="pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400 font-medium">
              Cliquez sur un profil pour pré-remplir l'identifiant, puis saisissez votre mot de passe.
            </div>
          </div>

        </div>

        <div class="text-center text-[11px] font-medium text-slate-400 dark:text-slate-500">
          OpenMDL • Gestion autonome et démocratique de la Maison des Lycéens
        </div>

      </div>
    `;

    // Événements
    const usernameInput = container.querySelector('#input-username') as HTMLInputElement;
    const passwordInput = container.querySelector('#input-password') as HTMLInputElement;
    const togglePwdBtn = container.querySelector('#btn-toggle-pwd') as HTMLButtonElement;
    const form = container.querySelector('#login-form') as HTMLFormElement;
    const errorContainer = container.querySelector('#login-error-container') as HTMLElement;
    const errorText = container.querySelector('#login-error-text') as HTMLElement;

    const selectedClasses = ['border-orange-500', 'bg-orange-500/10', 'ring-1', 'ring-orange-500/30'];
    const defaultClasses = ['border-slate-200/80', 'dark:border-slate-800', 'bg-slate-50/70', 'dark:bg-slate-800/40', 'hover:border-orange-400', 'dark:hover:border-orange-500/50', 'hover:bg-orange-50/50', 'dark:hover:bg-slate-800'];

    const updateSelectedTile = (username: string) => {
      container.querySelectorAll('[data-fill-user]').forEach(btn => {
        const isMatch = btn.getAttribute('data-fill-user') === username;
        if (isMatch) {
          btn.classList.remove(...defaultClasses);
          btn.classList.add(...selectedClasses);
        } else {
          btn.classList.remove(...selectedClasses);
          btn.classList.add(...defaultClasses);
        }
      });
    };

    // Basculer l'affichage du mot de passe
    togglePwdBtn?.addEventListener('click', () => {
      this.showPassword = !this.showPassword;
      passwordInput.type = this.showPassword ? 'text' : 'password';
      togglePwdBtn.innerHTML = this.showPassword ? Icons.eyeOff('w-4 h-4') : Icons.eye('w-4 h-4');
    });

    usernameInput?.addEventListener('input', () => {
      this.selectedUsername = usernameInput.value.trim();
      updateSelectedTile(this.selectedUsername);
    });

    // Clic sur sélection rapide de compte (sélectionne l'identifiant et donne le focus au champ mot de passe)
    container.querySelectorAll('[data-fill-user]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const user = target.getAttribute('data-fill-user') || '';
        usernameInput.value = user;
        passwordInput.value = '';
        this.selectedUsername = user;
        this.passwordValue = '';
        updateSelectedTile(user);
        errorContainer.classList.add('hidden');
        passwordInput.focus();
      });
    });

    // Soumission du formulaire
    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      const username = usernameInput.value.trim();
      const password = passwordInput.value.trim();

      const res = db.authenticate(username, password);
      if (res.success) {
        kofiService.hideOverlay();
        this.onLoginSuccess();
      } else {
        errorText.textContent = res.message;
        errorContainer.classList.remove('hidden');
        passwordInput.focus();
        passwordInput.select();
      }
    });

    // Gestionnaires des contrôles de fenêtre Tauri sur l'écran de login
    container.querySelector('#btn-login-win-min')?.addEventListener('click', async () => {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('minimize_window');
      } catch {
        try {
          const { getCurrentWindow } = await import('@tauri-apps/api/window');
          await getCurrentWindow().minimize();
        } catch {}
      }
    });

    container.querySelector('#btn-login-win-max')?.addEventListener('click', async () => {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('toggle_maximize');
      } catch {
        try {
          const { getCurrentWindow } = await import('@tauri-apps/api/window');
          await getCurrentWindow().toggleMaximize();
        } catch {
          if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => {});
          } else {
            document.exitFullscreen().catch(() => {});
          }
        }
      }
    });

    container.querySelector('#btn-login-win-close')?.addEventListener('click', async () => {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('exit_app');
      } catch {
        try {
          const { getCurrentWindow } = await import('@tauri-apps/api/window');
          await getCurrentWindow().destroy();
        } catch {
          window.close();
        }
      }
    });

    // Initialisation du widget Ko-fi sur la page de login si connexion Internet
    setTimeout(() => {
      kofiService.showOverlay('login');
    }, 100);

    return container;
  }
}
