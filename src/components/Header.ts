import { Volunteer, Session } from '../types';
import { db } from '../services/db';
import { Icons } from './Icons';
import { CloseSessionModalComponent } from './CloseSessionModal';

export class HeaderComponent {
  private currentTab: string;
  private onTabChange: (tab: string) => void;
  private onLogout: () => void;

  constructor(currentTab: string, onTabChange: (tab: string) => void, onLogout: () => void) {
    this.currentTab = currentTab;
    this.onTabChange = onTabChange;
    this.onLogout = onLogout;
  }

  public render(volunteer: Volunteer | null, activeSession: Session | null): HTMLElement {
    const header = document.createElement('header');
    header.className = 'w-full rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-800/80 shadow-md flex-shrink-0 z-30 px-4 sm:px-6';

    const isDark = document.documentElement.classList.contains('dark');

    header.innerHTML = `
      <div class="flex items-center justify-between h-14">
          
          <!-- Marque / Logo avec peps -->
          <div class="flex items-center gap-6">
            <div class="flex items-center gap-3 cursor-pointer group" id="nav-brand">
              <img src="/assets/logo_banniere.png" alt="OpenMDL" class="h-9 w-auto object-contain group-hover:scale-105 transition-transform" />
              <div class="flex flex-col">
                <span class="font-extrabold text-base text-slate-900 dark:text-white tracking-tight leading-tight">OpenMDL</span>
                <span class="text-[10px] font-semibold text-orange-600 dark:text-orange-400 uppercase tracking-wider">Foyer des Lycéens</span>
              </div>
            </div>

            <!-- Onglets de Navigation conviviaux et arrondis -->
            <nav class="hidden md:flex items-center gap-1.5">
              <button data-tab="dashboard" class="px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${this.currentTab === 'dashboard'
        ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400 font-bold border border-orange-500/20 shadow-xs'
        : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
      }">
                Caisse
              </button>

              <button data-tab="catalog" class="px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${this.currentTab === 'catalog'
        ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400 font-bold border border-orange-500/20 shadow-xs'
        : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
      }">
                Catalogue & Tarifs
              </button>

              <button data-tab="restock" class="px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${this.currentTab === 'restock'
        ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400 font-bold border border-orange-500/20 shadow-xs'
        : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
      }">
                Restock Express
              </button>

              <button data-tab="stats" class="px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${this.currentTab === 'stats'
        ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400 font-bold border border-orange-500/20 shadow-xs'
        : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
      }">
                Rapports & Ventes
              </button>

              <button data-tab="agenda" class="px-3.5 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${this.currentTab === 'agenda'
        ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400 font-bold border border-orange-500/20 shadow-xs'
        : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
      }">
                ${Icons.calendar('w-3.5 h-3.5')}
                <span>Planning Foyer</span>
              </button>

              <button data-tab="tpe" class="px-3.5 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${this.currentTab === 'tpe'
        ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400 font-bold border border-orange-500/20 shadow-xs'
        : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
      }">
                ${Icons.creditCard('w-3.5 h-3.5')}
                <span>Gestion TPE</span>
              </button>

              ${volunteer?.isAdmin ? `
                <button data-tab="settings" class="px-3.5 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${this.currentTab === 'settings'
          ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400 font-bold border border-orange-500/20 shadow-xs'
          : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
        }">
                  ${Icons.settings('w-3.5 h-3.5')}
                  <span>Paramètres</span>
                </button>
              ` : ''}
            </nav>
          </div>

          <!-- Actions Droite -->
          <div class="flex items-center gap-3">
            
            <!-- Bascule Thème -->
            <button id="btn-toggle-theme" class="p-2 rounded-xl text-slate-500 hover:text-orange-500 hover:bg-orange-500/10 transition-all" title="Changer le thème">
              ${isDark ? Icons.sun('w-4 h-4') : Icons.moon('w-4 h-4')}
            </button>

            <!-- Profil Bénévole -->
            ${volunteer ? `
              <div class="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs">
                <span class="w-2.5 h-2.5 rounded-full ${volunteer.isAdmin ? 'bg-orange-500 shadow-orange-500/50' : 'bg-emerald-500 shadow-emerald-500/50'} shadow-xs"></span>
                <span class="font-semibold text-slate-700 dark:text-slate-200">${volunteer.name}</span>
                ${volunteer.isAdmin ? `
                  <span class="px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-600 dark:text-orange-400 text-[10px] font-extrabold">CVL</span>
                ` : ''}
              </div>
            ` : ''}

            <!-- Clôturer la séance -->
            ${activeSession ? `
              <button id="btn-close-session" class="px-3.5 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-xs font-bold transition-all shadow-xs">
                Clôturer la séance
              </button>
            ` : ''}

            <!-- Déconnexion -->
            <button id="btn-logout" class="p-2 sm:px-3 sm:py-1.5 rounded-xl text-slate-500 hover:text-rose-600 hover:bg-rose-500/10 transition-all text-xs font-semibold" title="Déconnexion">
              ${Icons.logOut('w-4 h-4 sm:hidden')}
              <span class="hidden sm:inline">Quitter</span>
            </button>

            <!-- Contrôles Fenêtre Modernes (Sans bandeau système) -->
            <div class="flex items-center gap-1 pl-2.5 border-l border-slate-200 dark:border-slate-800" id="window-controls">
              <button id="btn-win-min" class="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-all" title="Réduire">
                <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"/></svg>
              </button>
              <button id="btn-win-max" class="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-all" title="Agrandir / Restaurer">
                <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>
              </button>
              <button id="btn-win-close" class="w-7 h-7 rounded-lg text-slate-400 hover:text-white hover:bg-rose-600 flex items-center justify-center transition-all" title="Fermer">
                <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

          </div>
        </div>
    `;

    header.setAttribute('data-tauri-drag-region', '');

    header.querySelectorAll('[data-tab]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tab = (e.currentTarget as HTMLElement).getAttribute('data-tab');
        if (tab) this.onTabChange(tab);
      });
    });

    header.querySelector('#nav-brand')?.addEventListener('click', () => {
      this.onTabChange('dashboard');
    });

    header.querySelector('#btn-toggle-theme')?.addEventListener('click', () => {
      const htmlEl = document.documentElement;
      if (htmlEl.classList.contains('dark')) {
        htmlEl.classList.remove('dark');
        localStorage.setItem('openmdl_theme', 'light');
      } else {
        htmlEl.classList.add('dark');
        localStorage.setItem('openmdl_theme', 'dark');
      }
      this.onTabChange(this.currentTab);
    });

    header.querySelector('#btn-close-session')?.addEventListener('click', () => {
      const modal = new CloseSessionModalComponent(() => {
        this.onLogout();
      });
      modal.show();
    });

    header.querySelector('#btn-logout')?.addEventListener('click', () => {
      if (confirm('Voulez-vous vous déconnecter ? Une sauvegarde automatique de la base de données sera créée.')) {
        db.logout();
        this.onLogout();
      }
    });

    // Gestionnaires des contrôles de fenêtre Tauri (Minimiser, Agrandir, Fermer)
    header.querySelector('#btn-win-min')?.addEventListener('click', async () => {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('minimize_window');
      } catch {
        try {
          const { getCurrentWindow } = await import('@tauri-apps/api/window');
          await getCurrentWindow().minimize();
        } catch (e) {
          console.warn('Tauri window minimize:', e);
        }
      }
    });

    header.querySelector('#btn-win-max')?.addEventListener('click', async () => {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('toggle_maximize');
      } catch {
        try {
          const { getCurrentWindow } = await import('@tauri-apps/api/window');
          await getCurrentWindow().toggleMaximize();
        } catch (e) {
          if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => { });
          } else {
            document.exitFullscreen().catch(() => { });
          }
        }
      }
    });

    header.querySelector('#btn-win-close')?.addEventListener('click', async () => {
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

    return header;
  }
}
