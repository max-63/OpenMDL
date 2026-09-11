import { db } from '../services/db';
import { Icons } from '../components/Icons';

export class LoginView {
  private onLoginSuccess: () => void;
  private errorMessage: string | null = null;
  private selectedUsername: string = 'admin';
  private passwordValue: string = 'admin';
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
      <div class="w-full max-w-md space-y-6 animate-enter">
        
        <!-- En-tête : Marque & Rôle CVL -->
        <div class="space-y-2 text-center flex flex-col items-center">
          <div class="w-14 h-14 rounded-3xl bg-orange-600 text-white flex items-center justify-center font-black text-2xl shadow-lg shadow-orange-600/25 hover:scale-105 transition-transform cursor-default">
            M
          </div>
          <div>
            <h1 class="text-2xl font-black tracking-tight text-slate-900 dark:text-white">OpenMDL</h1>
            <p class="text-xs font-bold text-orange-600 dark:text-orange-400 uppercase tracking-widest mt-0.5">
              Foyer des Lycéens • Maison des Lycéens
            </p>
          </div>
        </div>

        <!-- Carte Principale de Connexion (Style Îlot Flottant Arrondi) -->
        <div class="p-7 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl space-y-5">
          
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              ${Icons.lock('w-4 h-4 text-orange-500')}
              <span>Accès Sécurisé Permanence</span>
            </div>
            <span class="text-[11px] px-2 py-0.5 rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400 font-bold border border-orange-500/20">
              Session CVL
            </span>
          </div>

          <!-- Message d'erreur dynamique -->
          <div id="login-error-container" class="${this.errorMessage ? 'block' : 'hidden'} p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/25 text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center gap-2.5">
            ${Icons.alertTriangle('w-4 h-4 flex-shrink-0')}
            <span id="login-error-text">${this.errorMessage || ''}</span>
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
                  value="${this.selectedUsername}"
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
                  value="${this.passwordValue}"
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

          <!-- Sélection rapide de compte pour la démo / convivialité -->
          <div class="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
            <div class="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              <span>Sélection rapide de compte</span>
              <span>Rôle</span>
            </div>
            <div class="space-y-1.5" id="quick-volunteers-list">
              ${volunteers.map(v => {
                const isSuspended = !!v.isSuspended;
                return `
                  <button 
                    type="button"
                    data-fill-user="${v.username}"
                    data-fill-pass="${v.password}"
                    class="w-full p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 hover:border-orange-400 dark:hover:border-orange-500/50 bg-slate-50/70 dark:bg-slate-800/40 hover:bg-orange-50/50 dark:hover:bg-slate-800 transition-all flex items-center justify-between text-left group cursor-pointer ${
                      isSuspended ? 'opacity-50 grayscale' : ''
                    }"
                  >
                    <div class="flex items-center gap-2.5 min-w-0">
                      <div class="w-7 h-7 rounded-xl flex items-center justify-center text-white font-black text-xs flex-shrink-0" style="background-color: ${v.avatarColor}">
                        ${v.name.charAt(0)}
                      </div>
                      <div class="truncate">
                        <div class="font-bold text-xs text-slate-800 dark:text-slate-200 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors truncate">
                          ${v.name}
                        </div>
                        <div class="text-[10px] text-slate-400 font-mono truncate">
                          @${v.username}
                        </div>
                      </div>
                    </div>
                    <div class="flex items-center gap-1.5 flex-shrink-0">
                      ${v.isAdmin ? `
                        <span class="px-2 py-0.5 rounded-md bg-orange-500/15 text-orange-600 dark:text-orange-400 font-extrabold text-[10px] border border-orange-500/20">
                          Délégué CVL
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

          <!-- Note sur l'admin par défaut -->
          <div class="p-3 rounded-2xl bg-orange-500/5 border border-orange-500/15 text-[11px] text-slate-600 dark:text-slate-400 flex items-start gap-2">
            ${Icons.shield('w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5')}
            <div>
              <span class="font-bold text-slate-900 dark:text-white">Compte délégué initial :</span> 
              identifiant <code class="px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-600 dark:text-orange-400 font-mono font-bold">admin</code> 
              / mot de passe <code class="px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-600 dark:text-orange-400 font-mono font-bold">admin</code>. 
              Le délégué élu peut créer les comptes des autres lycéens dans l'onglet <strong>Paramètres</strong>.
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

    // Basculer l'affichage du mot de passe
    togglePwdBtn?.addEventListener('click', () => {
      this.showPassword = !this.showPassword;
      passwordInput.type = this.showPassword ? 'text' : 'password';
      togglePwdBtn.innerHTML = this.showPassword ? Icons.eyeOff('w-4 h-4') : Icons.eye('w-4 h-4');
    });

    // Clic sur sélection rapide de compte
    container.querySelectorAll('[data-fill-user]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const user = target.getAttribute('data-fill-user') || '';
        const pass = target.getAttribute('data-fill-pass') || '';
        usernameInput.value = user;
        passwordInput.value = pass;
        this.selectedUsername = user;
        this.passwordValue = pass;
        errorContainer.classList.add('hidden');
      });
    });

    // Soumission du formulaire
    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      const username = usernameInput.value.trim();
      const password = passwordInput.value.trim();

      const res = db.authenticate(username, password);
      if (res.success) {
        this.onLoginSuccess();
      } else {
        errorText.textContent = res.message;
        errorContainer.classList.remove('hidden');
        passwordInput.focus();
        passwordInput.select();
      }
    });

    return container;
  }
}
