import { Volunteer, Session } from '../types';
import { db } from '../services/db';
import { addonManager } from '../services/addonManager';
import { syncService } from '../services/syncService';
import { Icons } from './Icons';
import { CloseSessionModalComponent } from './CloseSessionModal';
import { AppDialog } from './AppDialog';
import { kofiService } from '../services/kofiService';

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
    const syncConfig = syncService.getConfig();
    const appProfile = db.getAppProfile();
    const isVisco = appProfile === 'visco';

    header.innerHTML = `
      <div class="flex items-center justify-between h-14">
          
          <!-- Marque / Logo avec peps -->
          <div class="flex items-center gap-2 lg:gap-4 flex-shrink-0">
            <div class="flex items-center gap-2.5 cursor-pointer group" id="nav-brand" title="OpenMDL - Accueil">
              <img src="/assets/logo_banniere.png" alt="OpenMDL" class="h-8 lg:h-9 w-auto object-contain group-hover:scale-105 transition-transform" />
              <div class="hidden xl:flex flex-col">
                <span class="font-extrabold text-sm lg:text-base text-slate-900 dark:text-white tracking-tight leading-tight">OpenMDL</span>
                <span class="text-[9px] lg:text-[10px] font-semibold ${isVisco ? 'text-sky-600 dark:text-sky-400' : 'text-orange-600 dark:text-orange-400'} uppercase tracking-wider">
                  ${isVisco ? 'Vie Scolaire' : 'Foyer des Lycéens'}
                </span>
              </div>
            </div>

            <!-- Onglets de Navigation conviviaux et arrondis -->
            <nav class="hidden md:flex items-center gap-1">
              ${isVisco ? `
                <!-- Navigation Mode Vie Scolaire (Sans Caisse de vente) -->
                <button data-tab="decaisse" class="px-3.5 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${this.currentTab === 'decaisse'
                  ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400 font-bold border border-sky-500/20 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                }">
                  ${Icons.vault('w-3.5 h-3.5')}
                  <span>Décaisse & Coffre</span>
                </button>

                <button data-tab="agenda" class="px-3.5 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${this.currentTab === 'agenda'
                  ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400 font-bold border border-sky-500/20 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                }">
                  ${Icons.calendar('w-3.5 h-3.5')}
                  <span>Planning Foyer</span>
                </button>

                <button data-tab="stats" class="px-3.5 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${this.currentTab === 'stats'
                  ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400 font-bold border border-sky-500/20 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                }">
                  ${Icons.barChart('w-3.5 h-3.5')}
                  <span>Rapports & Ventes</span>
                </button>

                <button data-tab="settings" class="px-3.5 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${this.currentTab === 'settings'
                  ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400 font-bold border border-sky-500/20 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                }">
                  ${Icons.settings('w-3.5 h-3.5')}
                  <span>Paramètres</span>
                </button>
              ` : `
                <!-- 1. Mode Compact / Standard : Onglets regroupés avec Menu Déroulant au Survol (Hover) -->
                <div class="flex ${addonManager.getRegisteredTabs().length === 0 ? '3xl:hidden' : ''} items-center gap-1">
                  <button data-tab="dashboard" class="px-2.5 lg:px-3 py-1.5 lg:py-2 rounded-xl text-xs font-semibold transition-all ${this.currentTab === 'dashboard'
                    ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400 font-bold border border-orange-500/20 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                  }">
                    Caisse
                  </button>

                  <!-- Groupe 1 : Stock & Ventes (Catalogue, Restock, Rapports) -->
                  <div class="relative group/stock">
                    <button 
                      type="button"
                      data-tab="${['catalog', 'restock', 'stats'].includes(this.currentTab) ? this.currentTab : 'catalog'}"
                      class="px-2.5 lg:px-3 py-1.5 lg:py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer ${['catalog', 'restock', 'stats'].includes(this.currentTab)
                        ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400 font-bold border border-orange-500/20 shadow-xs'
                        : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                      }"
                    >
                      ${Icons.package('w-3.5 h-3.5')}
                      <span>${
                        this.currentTab === 'stats' ? 'Rapports' :
                        this.currentTab === 'restock' ? 'Restock' :
                        this.currentTab === 'catalog' ? 'Catalogue' : 'Stock & Ventes'
                      }</span>
                      ${Icons.chevronDown('w-3 h-3 opacity-60 group-hover/stock:rotate-180 transition-transform duration-200')}
                    </button>

                    <!-- Menu déroulant au Hover -->
                    <div class="absolute top-full left-0 pt-1.5 opacity-0 invisible group-hover/stock:opacity-100 group-hover/stock:visible transition-all duration-150 z-50 min-w-48 pointer-events-none group-hover/stock:pointer-events-auto">
                      <div class="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl p-1.5 space-y-0.5 backdrop-blur-md">
                        <button data-tab="catalog" class="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer ${this.currentTab === 'catalog'
                          ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400 font-bold'
                          : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }">
                          ${Icons.cart('w-3.5 h-3.5 text-orange-500')}
                          <span>Catalogue & Tarifs</span>
                        </button>

                        <button data-tab="restock" class="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer ${this.currentTab === 'restock'
                          ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400 font-bold'
                          : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }">
                          ${Icons.refresh('w-3.5 h-3.5 text-emerald-500')}
                          <span>Restock Express</span>
                        </button>

                        <button data-tab="stats" class="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer ${this.currentTab === 'stats'
                          ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400 font-bold'
                          : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }">
                          ${Icons.barChart('w-3.5 h-3.5 text-sky-500')}
                          <span>Rapports & Ventes</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  <button data-tab="decaisse" class="px-2.5 lg:px-3 py-1.5 lg:py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${this.currentTab === 'decaisse'
                    ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400 font-bold border border-orange-500/20 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                  }">
                    ${Icons.vault('w-3.5 h-3.5')}
                    <span>Décaisse</span>
                  </button>

                  <button data-tab="agenda" class="px-2.5 lg:px-3 py-1.5 lg:py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${this.currentTab === 'agenda'
                    ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400 font-bold border border-orange-500/20 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                  }">
                    ${Icons.calendar('w-3.5 h-3.5')}
                    <span>Planning</span>
                  </button>

                  <!-- Groupe 2 : Gestion & Config (TPE, Addons, Paramètres) -->
                  <div class="relative group/config">
                    <button 
                      type="button"
                      data-tab="${['tpe', 'addons', 'settings'].includes(this.currentTab) ? this.currentTab : (volunteer?.isAdmin ? 'settings' : 'tpe')}"
                      class="px-2.5 lg:px-3 py-1.5 lg:py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer ${['tpe', 'addons', 'settings'].includes(this.currentTab)
                        ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400 font-bold border border-orange-500/20 shadow-xs'
                        : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                      }"
                    >
                      ${Icons.settings('w-3.5 h-3.5')}
                      <span>${
                        this.currentTab === 'tpe' ? 'Gestion TPE' :
                        this.currentTab === 'addons' ? 'Addons' :
                        this.currentTab === 'settings' ? 'Paramètres' : 'Gestion & Config'
                      }</span>
                      ${Icons.chevronDown('w-3 h-3 opacity-60 group-hover/config:rotate-180 transition-transform duration-200')}
                    </button>

                    <!-- Menu déroulant au Hover -->
                    <div class="absolute top-full left-0 pt-1.5 opacity-0 invisible group-hover/config:opacity-100 group-hover/config:visible transition-all duration-150 z-50 min-w-44 pointer-events-none group-hover/config:pointer-events-auto">
                      <div class="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl p-1.5 space-y-0.5 backdrop-blur-md">
                        <button data-tab="tpe" class="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer ${this.currentTab === 'tpe'
                          ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400 font-bold'
                          : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }">
                          ${Icons.creditCard('w-3.5 h-3.5 text-blue-500')}
                          <span>Gestion TPE</span>
                        </button>

                        ${volunteer?.isAdmin ? `
                          <button data-tab="addons" class="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer ${this.currentTab === 'addons'
                            ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400 font-bold'
                            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }">
                            ${Icons.puzzle('w-3.5 h-3.5 text-purple-500')}
                            <span>Addons</span>
                          </button>

                          <button data-tab="settings" class="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer ${this.currentTab === 'settings'
                            ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400 font-bold'
                            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }">
                            ${Icons.settings('w-3.5 h-3.5 text-orange-500')}
                            <span>Paramètres</span>
                          </button>
                        ` : ''}
                      </div>
                    </div>
                  </div>

                  <!-- Onglets dynamiques créés par les Addons actifs -->
                  ${addonManager.getRegisteredTabs().map(tab => `
                    <button data-tab="${tab.id}" class="px-2.5 lg:px-3 py-1.5 lg:py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${this.currentTab === tab.id
                      ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400 font-bold border border-orange-500/20 shadow-xs'
                      : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                    }">
                      ${(Icons as any)[tab.icon] ? (Icons as any)[tab.icon]('w-3.5 h-3.5') : Icons.puzzle('w-3.5 h-3.5')}
                      <span>${tab.label}</span>
                    </button>
                  `).join('')}
                </div>

                <!-- 2. Mode Très Grand Écran (3xl+) SANS addon actif : Tous les onglets dépliés individuellement si la place le permet -->
                ${addonManager.getRegisteredTabs().length === 0 ? `
                  <div class="hidden 3xl:flex items-center gap-1.5">
                    <button data-tab="dashboard" class="px-3 py-2 rounded-xl text-xs font-semibold transition-all ${this.currentTab === 'dashboard'
                      ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400 font-bold border border-orange-500/20 shadow-xs'
                      : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                    }">
                      Caisse
                    </button>

                    <button data-tab="catalog" class="px-3 py-2 rounded-xl text-xs font-semibold transition-all ${this.currentTab === 'catalog'
                      ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400 font-bold border border-orange-500/20 shadow-xs'
                      : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                    }">
                      Catalogue & Tarifs
                    </button>

                    <button data-tab="restock" class="px-3 py-2 rounded-xl text-xs font-semibold transition-all ${this.currentTab === 'restock'
                      ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400 font-bold border border-orange-500/20 shadow-xs'
                      : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                    }">
                      Restock Express
                    </button>

                    <button data-tab="decaisse" class="px-3 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${this.currentTab === 'decaisse'
                      ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400 font-bold border border-orange-500/20 shadow-xs'
                      : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                    }">
                      ${Icons.vault('w-3.5 h-3.5')}
                      <span>Décaisse</span>
                    </button>

                    <button data-tab="stats" class="px-3 py-2 rounded-xl text-xs font-semibold transition-all ${this.currentTab === 'stats'
                      ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400 font-bold border border-orange-500/20 shadow-xs'
                      : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                    }">
                      Rapports & Ventes
                    </button>

                    <button data-tab="agenda" class="px-3 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${this.currentTab === 'agenda'
                      ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400 font-bold border border-orange-500/20 shadow-xs'
                      : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                    }">
                      ${Icons.calendar('w-3.5 h-3.5')}
                      <span>Planning Foyer</span>
                    </button>

                    <button data-tab="tpe" class="px-3 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${this.currentTab === 'tpe'
                      ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400 font-bold border border-orange-500/20 shadow-xs'
                      : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                    }">
                      ${Icons.creditCard('w-3.5 h-3.5')}
                      <span>Gestion TPE</span>
                    </button>

                    ${volunteer?.isAdmin ? `
                      <button data-tab="addons" class="px-3 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${this.currentTab === 'addons'
                        ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400 font-bold border border-orange-500/20 shadow-xs'
                        : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                      }">
                        ${Icons.puzzle('w-3.5 h-3.5')}
                        <span>Addons</span>
                      </button>

                      <button data-tab="settings" class="px-3 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${this.currentTab === 'settings'
                        ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400 font-bold border border-orange-500/20 shadow-xs'
                        : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                      }">
                        ${Icons.settings('w-3.5 h-3.5')}
                        <span>Paramètres</span>
                      </button>
                    ` : ''}
                  </div>
                ` : ''}
              `}
            </nav>
          </div>

          <!-- Actions Droite -->
          <div class="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">

            <!-- Badge Statut Réseau / Synchronisation -->
            ${syncConfig.mode === 'lan' ? `
              ${syncConfig.lan.role === 'server' ? `
                <button data-tab="settings" class="hidden xl:flex items-center gap-1.5 px-2 py-1 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-bold cursor-pointer transition-colors" title="Serveur LAN actif - Cliquer pour ouvrir les réglages">
                  <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span>Serveur</span>
                </button>
              ` : `
                <button id="btn-header-sync-now" class="hidden xl:flex items-center gap-1.5 px-2 py-1 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 text-sky-600 dark:text-sky-400 border border-sky-500/20 text-[10px] font-bold cursor-pointer transition-colors" title="Client LAN - Cliquer pour synchroniser avec la caisse">
                  <span class="w-1.5 h-1.5 rounded-full ${syncService.currentStatus === 'error' ? 'bg-rose-500' : 'bg-sky-500'}"></span>
                  <span>Synchro</span>
                  ${Icons.refresh('w-3 h-3')}
                </button>
              `}
            ` : syncConfig.mode === 'usb' ? `
              <button data-tab="settings" class="hidden xl:flex items-center gap-1.5 px-2 py-1 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-[10px] font-bold cursor-pointer transition-colors" title="Mode Clé USB actif - Cliquer pour ouvrir les réglages">
                ${Icons.folder('w-3 h-3')}
                <span>Clé USB</span>
              </button>
            ` : ''}
            
            <!-- Soutien Ko-fi (si connecté à Internet) -->
            <div id="header-kofi-container" class="flex items-center"></div>

            <!-- Crédits & Mentions Légales -->
            <button data-tab="credits" class="p-1.5 rounded-xl transition-all cursor-pointer ${this.currentTab === 'credits' ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400' : 'text-slate-500 hover:text-orange-500 hover:bg-orange-500/10'}" title="Crédits & Mentions Légales">
              ${Icons.sparkles('w-4 h-4')}
            </button>

            <!-- Bascule Thème -->
            <button id="btn-toggle-theme" class="p-1.5 rounded-xl text-slate-500 hover:text-orange-500 hover:bg-orange-500/10 transition-all cursor-pointer" title="Changer le thème">
              ${isDark ? Icons.sun('w-4 h-4') : Icons.moon('w-4 h-4')}
            </button>

            <!-- Messagerie & Chat (si activé dans les réglages) -->
            ${db.getChatSettings().enabled ? (() => {
              const unreadDMs = db.getUnreadDirectMessagesCount();
              return `
                <button id="btn-nav-chat" data-tab="chat" class="relative px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${this.currentTab === 'chat'
                  ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400 font-bold border border-orange-500/20 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                }" title="Messagerie instantanée & Salons de discussion ${unreadDMs > 0 ? `(${unreadDMs} nouveau(x) message(s) privé(s))` : ''}">
                  <div class="relative flex items-center justify-center">
                    ${Icons.messageSquare('w-3.5 h-3.5')}
                    <span id="chat-badge-dot" class="${unreadDMs > 0 ? '' : 'hidden '}absolute -top-1 -right-1 w-2 h-2 rounded-full bg-purple-500 animate-pulse"></span>
                  </div>
                  <span class="hidden xl:inline">Chat</span>
                  <span id="chat-badge-count" class="${unreadDMs > 0 ? '' : 'hidden '}px-1.5 py-0.2 rounded-full bg-purple-500 text-white text-[9px] font-black tracking-tight shadow-xs">
                    ${unreadDMs}
                  </span>
                </button>
              `;
            })() : ''}

            <!-- Profil Bénévole : juste la photo de profil (PP) et badge admin sur écrans compacts, déplié sur 2xl+ -->
            ${volunteer ? `
              <button data-tab="profile" class="flex items-center gap-1.5 p-1 sm:px-2.5 sm:py-1 rounded-xl transition-all cursor-pointer border ${this.currentTab === 'profile'
                ? 'bg-orange-500/15 border-orange-500/30 text-orange-600 dark:text-orange-400'
                : 'bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
              } text-xs flex-shrink-0" title="${volunteer.name} (${volunteer.isAdmin ? 'Admin' : 'Bénévole'}) - Modifier mon profil">
                ${volunteer.avatarUrl ? `
                  <img src="${volunteer.avatarUrl}" alt="${volunteer.name}" class="w-6 h-6 rounded-full object-cover border border-slate-300 dark:border-slate-600 flex-shrink-0" />
                ` : `
                  <span class="w-6 h-6 rounded-full text-white flex items-center justify-center font-black text-[11px] flex-shrink-0 shadow-xs" style="background-color: ${volunteer.avatarColor}">
                    ${volunteer.name.charAt(0)}
                  </span>
                `}
                <span class="font-semibold hidden 2xl:inline truncate max-w-28">${volunteer.name}</span>
                ${volunteer.isAdmin ? `
                  <span class="hidden 2xl:inline px-1 py-0.2 rounded bg-orange-500/10 text-orange-600 dark:text-orange-400 text-[9px] font-extrabold">ADMIN</span>
                ` : ''}
              </button>
            ` : ''}

            <!-- Clôturer la séance -->
            ${activeSession ? `
              <button id="btn-close-session" class="px-2.5 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-xs font-bold transition-all shadow-xs flex-shrink-0 cursor-pointer" title="Clôturer la séance active">
                <span class="hidden lg:inline">Clôturer la séance</span>
                <span class="lg:hidden">Clôture</span>
              </button>
            ` : ''}

            <!-- Déconnexion -->
            <button id="btn-logout" class="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl text-slate-500 hover:text-rose-600 hover:bg-rose-500/10 transition-all text-xs font-semibold cursor-pointer flex-shrink-0" title="Déconnexion">
              ${Icons.logOut('w-4 h-4')}
              <span class="hidden 2xl:inline">Quitter</span>
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
      this.onTabChange(isVisco ? 'decaisse' : 'dashboard');
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

    header.querySelector('#btn-header-sync-now')?.addEventListener('click', async () => {
      const btn = header.querySelector('#btn-header-sync-now') as HTMLButtonElement;
      if (btn) btn.classList.add('opacity-50', 'pointer-events-none');
      await syncService.syncFromLanServer();
      if (btn) btn.classList.remove('opacity-50', 'pointer-events-none');
      this.onTabChange(this.currentTab);
    });

    header.querySelector('#btn-close-session')?.addEventListener('click', () => {
      const modal = new CloseSessionModalComponent(() => {
        this.onLogout();
      });
      modal.show();
    });

    header.querySelector('#btn-logout')?.addEventListener('click', () => {
      AppDialog.confirm({
        title: 'Déconnexion',
        message: 'Voulez-vous vous déconnecter ? Une sauvegarde automatique de la base de données sera créée.',
        type: 'warning',
        confirmText: 'Se déconnecter',
        cancelText: 'Rester',
        onConfirm: () => {
          db.logout();
          this.onLogout();
        }
      });
    });

    // Gestionnaires des contrôles de fenêtre Tauri (Minimiser, Agrandir/Restaurer, Fermer)
    header.querySelector('#btn-win-min')?.addEventListener('click', async () => {
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        await getCurrentWindow().minimize();
      } catch (e) {
        console.warn('Tauri window minimize:', e);
      }
    });

    const updateMaxIcon = async () => {
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        const isMax = await getCurrentWindow().isMaximized();
        const maxBtn = header.querySelector('#btn-win-max');
        if (maxBtn) {
          if (isMax) {
            maxBtn.setAttribute('title', 'Restaurer');
            maxBtn.innerHTML = `<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="8" width="12" height="12" rx="1.5"/><path d="M8 4h10a2 2 0 0 1 2 2v10"/></svg>`;
          } else {
            maxBtn.setAttribute('title', 'Agrandir');
            maxBtn.innerHTML = `<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>`;
          }
        }
      } catch {
        // Fallback Web standard
      }
    };

    updateMaxIcon();

    header.querySelector('#btn-win-max')?.addEventListener('click', async () => {
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        const win = getCurrentWindow();
        await win.toggleMaximize();
        setTimeout(updateMaxIcon, 50);
      } catch (e) {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => { });
        } else {
          document.exitFullscreen().catch(() => { });
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

    // Rendu du bouton Ko-fi si connecté à Internet
    const kofiContainer = header.querySelector('#header-kofi-container') as HTMLElement | null;
    if (kofiContainer) {
      kofiService.renderHotbarWidget(kofiContainer);
    }

    return header;
  }
}
