import { db } from '../services/db';
import { Icons } from './Icons';

export class SnakeModalComponent {
  private container: HTMLElement | null = null;
  private iframeEl: HTMLIFrameElement | null = null;
  private volunteerId: string = '';
  private playerName: string = '';
  private score: number = 0;
  private activeView: 'pacman' | 'leaderboard' = 'pacman';
  
  private messageListener: ((e: MessageEvent) => void) | null = null;
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;
  private pollInterval: any = null;

  constructor() {
    const current = db.getCurrentVolunteer();
    this.playerName = current ? current.name : '';
    this.volunteerId = current ? current.id : '';
  }

  public show(): void {
    const current = db.getCurrentVolunteer();
    if (!current) {
      return;
    }
    this.playerName = current.name;
    this.volunteerId = current.id;

    this.container = document.createElement('div');
    this.container.className = 'fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-black/90 backdrop-blur-md animate-enter';
    this.render();
    document.body.appendChild(this.container);

    this.setupListeners();

    // Auto-focus de l'iframe pour diriger Pac-Man immédiatement aux touches
    setTimeout(() => {
      this.focusIframe();
    }, 250);
  }

  public hide(): void {
    if (this.score > 0 && this.volunteerId) {
      db.addPacmanScore(this.playerName, this.score, this.volunteerId);
    }

    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }

    if (this.messageListener) {
      window.removeEventListener('message', this.messageListener);
      this.messageListener = null;
    }

    if (this.keydownHandler) {
      window.removeEventListener('keydown', this.keydownHandler);
      this.keydownHandler = null;
    }

    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
      this.container = null;
    }
  }

  private focusIframe(): void {
    if (this.iframeEl && this.iframeEl.contentWindow) {
      try {
        this.iframeEl.contentWindow.focus();
      } catch {}
    }
  }

  private setupListeners(): void {
    // Écoute des scores remontés par la passerelle pacman.js
    this.messageListener = (event: MessageEvent) => {
      if (!event.data || typeof event.data !== 'object') return;

      if (event.data.type === 'PACMAN_SCORE_UPDATE') {
        const newScore = Number(event.data.score) || 0;
        if (newScore !== this.score) {
          this.score = newScore;
          this.updateScoreDisplay();
        }
      } else if (event.data.type === 'PACMAN_GAME_OVER') {
        const finalScore = Number(event.data.score) || 0;
        if (finalScore > 0) {
          this.score = finalScore;
          db.addPacmanScore(this.playerName, finalScore, this.volunteerId);
          this.showNotification(`Game Over : ${finalScore} points enregistrés pour ${this.playerName} !`);
          this.updateScoreDisplay();
        }
      }
    };
    window.addEventListener('message', this.messageListener);

    // Polling de secours sur l'objet google.pacman de l'iframe locale (même domaine)
    this.pollInterval = setInterval(() => {
      if (this.activeView !== 'pacman' || !this.iframeEl) return;
      try {
        const win = this.iframeEl.contentWindow as any;
        if (win && win.google && win.google.pacman && typeof win.google.pacman.getScore === 'function') {
          const current = win.google.pacman.getScore();
          if (typeof current === 'number' && current > this.score) {
            this.score = current;
            this.updateScoreDisplay();
          }
        }
      } catch {}
    }, 300);

    // Fermeture avec Échap
    this.keydownHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        this.hide();
      }
    };
    window.addEventListener('keydown', this.keydownHandler);
  }

  private updateScoreDisplay(): void {
    const el = this.container?.querySelector('#pacman-live-score');
    if (el) {
      el.textContent = `${this.score}`;
    }
  }

  private showNotification(msg: string): void {
    const toast = this.container?.querySelector('#pacman-toast');
    if (!toast) return;

    toast.innerHTML = `
      <div class="px-4 py-2 rounded-xl bg-amber-500/95 text-slate-950 font-black text-xs flex items-center gap-2 shadow-xl animate-enter">
        ${Icons.trophy('w-4 h-4 text-slate-950')}
        <span>${msg}</span>
      </div>
    `;
    toast.classList.remove('hidden');

    setTimeout(() => {
      toast.classList.add('hidden');
    }, 4500);
  }

  private restartGame(): void {
    this.score = 0;
    this.updateScoreDisplay();
    if (this.iframeEl) {
      this.iframeEl.src = '/games/pacman/index.html';
      setTimeout(() => {
        this.focusIframe();
      }, 300);
    }
  }

  private render(): void {
    if (!this.container) return;

    const scores = db.getPacmanScores();
    const bestScore = scores.length > 0 ? scores[0].score : 0;

    this.container.innerHTML = `
      <div class="relative w-full max-w-3xl rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden text-slate-100 flex flex-col max-h-[96vh]">
        
        <!-- Header Arcade -->
        <div class="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-950/80 gap-3">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shadow-xs flex-shrink-0">
              ${Icons.gamepad('w-5 h-5')}
            </div>
            <div>
              <div class="flex items-center gap-2">
                <h2 class="text-sm font-black text-white tracking-tight">Google PAC-MAN Original</h2>
                <span class="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 font-extrabold uppercase">
                  Foyer MDL Arcade
                </span>
              </div>
              <p class="text-xs text-slate-400">Édition authentique sans mentions ni liens externes • Son Web Audio arcade</p>
            </div>
          </div>

          <!-- Onglets -->
          <div class="flex items-center gap-1 p-1 rounded-xl bg-slate-800/80 border border-slate-700 text-xs font-bold">
            <button id="tab-pacman" class="px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
              this.activeView === 'pacman' ? 'bg-amber-500 text-slate-950 font-black shadow-xs' : 'text-slate-400 hover:text-white'
            }">
              ${Icons.gamepad('w-3.5 h-3.5')}
              <span>PAC-MAN</span>
            </button>
            <button id="tab-leaderboard" class="px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
              this.activeView === 'leaderboard' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
            }">
              ${Icons.trophy('w-3.5 h-3.5')}
              <span>Classement (${scores.length})</span>
            </button>
          </div>

          <!-- Bouton Fermer -->
          <button id="btn-close-pacman" class="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer" title="Fermer (Échap)">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <!-- Toast de notification -->
        <div id="pacman-toast" class="absolute top-16 left-1/2 -translate-x-1/2 z-50 hidden"></div>

        <!-- Contenu -->
        <div class="flex-1 overflow-y-auto p-6 flex flex-col items-center justify-center bg-[#070b13]">
          
          ${this.activeView === 'pacman' ? `
            <div class="flex flex-col items-center gap-4 w-full max-w-[620px]">
              
              <!-- Barre d'état Joueur & Scores -->
              <div class="w-full flex items-center justify-between px-4 py-2.5 rounded-2xl bg-slate-950 border border-slate-800 text-xs">
                
                <!-- Nom du Joueur connecté (verrouillé sur le compte actif) -->
                <div class="flex items-center gap-2">
                  <span class="text-slate-400 font-bold">Joueur :</span>
                  <div class="px-2.5 py-1 rounded-xl bg-slate-800/90 border border-slate-700 text-amber-400 font-black text-xs flex items-center gap-2 shadow-xs" title="Lié à votre compte connecté (modifiable dans Paramètres)">
                    <div class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
                    <span>${this.playerName}</span>
                  </div>
                </div>

                <!-- Scores en direct -->
                <div class="flex items-center gap-4">
                  
                  <!-- Score actuel -->
                  <div class="flex items-center gap-1.5 font-mono">
                    <span class="text-slate-400 font-bold text-xs">SCORE</span>
                    <span id="pacman-live-score" class="font-black text-lg text-amber-400">${this.score}</span>
                    <span class="text-[11px] text-slate-500 font-sans">pts</span>
                  </div>

                  <!-- Meilleur score local -->
                  <div class="flex items-center gap-1.5 font-mono text-indigo-300">
                    ${Icons.trophy('w-4 h-4 text-amber-400')}
                    <span class="font-black text-sm">${bestScore}</span>
                  </div>

                  <!-- Bouton Recommencer -->
                  <button id="btn-pacman-reload" class="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs" title="Nouvelle partie">
                    ${Icons.rotateCcw('w-3.5 h-3.5 text-amber-400')}
                    <span>Rejouer</span>
                  </button>
                </div>

              </div>

              <!-- Cadre Bezel Arcade de Google PAC-MAN -->
              <div class="relative w-[594px] h-[236px] rounded-2xl p-3 bg-gradient-to-b from-slate-900 via-black to-slate-950 border-2 border-slate-700/80 shadow-[0_0_50px_rgba(245,158,11,0.18)] flex items-center justify-center overflow-hidden">
                <iframe 
                  id="pacman-frame"
                  src="/games/pacman/index.html" 
                  class="w-[570px] h-[212px] border-0 rounded-xl overflow-hidden block" 
                  allow="autoplay"
                ></iframe>
              </div>

              <!-- Instructions & Contrôles -->
              <div class="w-full flex items-center justify-between text-[11px] text-slate-400 px-2">
                <span>Contrôles : <strong>Flèches du clavier</strong> pour diriger Pac-Man</span>
                <span class="text-amber-400 font-medium">Scores archivés automatiquement en cas de Game Over</span>
              </div>

            </div>
          ` : `
            <!-- Onglet Classement -->
            <div class="w-full max-w-xl mx-auto py-2 space-y-4">
              <div class="flex items-center justify-between pb-3 border-b border-slate-800">
                <div class="flex items-center gap-2.5">
                  <div class="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
                    ${Icons.crown('w-5 h-5')}
                  </div>
                  <div>
                    <h3 class="text-sm font-black text-white">Classement Officiel PAC-MAN du Foyer</h3>
                    <p class="text-[11px] text-slate-400">Enregistré automatiquement à chaque partie terminée</p>
                  </div>
                </div>

                <div class="flex items-center gap-2">
                  ${scores.length > 0 ? `
                    <button id="btn-clear-scores" class="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-950/60 border border-slate-700 hover:border-rose-800 text-slate-400 hover:text-rose-300 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer" title="Effacer tout le classement">
                      ${Icons.trash('w-3.5 h-3.5')}
                      <span>Effacer</span>
                    </button>
                  ` : ''}
                  <button id="btn-back-to-play" class="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1.5 cursor-pointer">
                    ${Icons.gamepad('w-3.5 h-3.5 text-slate-950')}
                    <span>Jouer</span>
                  </button>
                </div>
              </div>

              <!-- Tableau des scores -->
              <div class="space-y-1.5">
                ${scores.length === 0 ? `
                  <div class="p-8 text-center text-slate-500 text-xs">
                    Aucun score enregistré pour l'instant. Lancez une partie pour inaugurer le classement PAC-MAN !
                  </div>
                ` : scores.map((entry, idx) => {
                  const isFirst = idx === 0;
                  const isSecond = idx === 1;
                  const isThird = idx === 2;

                  return `
                    <div class="p-3 rounded-2xl flex items-center justify-between border transition-all ${
                      isFirst 
                        ? 'bg-amber-500/10 border-amber-500/30 text-amber-200' 
                        : isSecond 
                        ? 'bg-slate-800/70 border-slate-700 text-slate-200'
                        : isThird
                        ? 'bg-orange-500/10 border-orange-500/20 text-orange-200'
                        : 'bg-slate-900/60 border-slate-800 text-slate-300'
                    }">
                      <div class="flex items-center gap-3">
                        <span class="w-7 h-7 rounded-xl flex items-center justify-center font-mono font-black text-xs ${
                          isFirst ? 'bg-amber-500 text-slate-950' : isSecond ? 'bg-slate-300 text-slate-900' : isThird ? 'bg-orange-600 text-white' : 'bg-slate-800 text-slate-400'
                        }">
                          #${idx + 1}
                        </span>
                        <div>
                          <div class="font-black text-xs text-white">${entry.playerName}</div>
                          <div class="text-[10px] text-slate-400 font-mono">
                            ${new Date(entry.timestamp).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </div>

                      <div class="flex items-center gap-2 font-mono font-black text-base ${isFirst ? 'text-amber-400' : 'text-white'}">
                        <span>${entry.score}</span>
                        <span class="text-[11px] font-sans text-slate-400 font-normal">pts</span>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          `}

        </div>

      </div>
    `;

    // Éléments du DOM
    this.iframeEl = this.container.querySelector('#pacman-frame');

    // Événements
    this.container.querySelector('#btn-close-pacman')?.addEventListener('click', () => this.hide());

    this.container.querySelector('#tab-pacman')?.addEventListener('click', () => {
      this.activeView = 'pacman';
      this.render();
      setTimeout(() => this.focusIframe(), 200);
    });

    this.container.querySelector('#tab-leaderboard')?.addEventListener('click', () => {
      this.activeView = 'leaderboard';
      this.render();
    });

    this.container.querySelector('#btn-back-to-play')?.addEventListener('click', () => {
      this.activeView = 'pacman';
      this.render();
      setTimeout(() => this.focusIframe(), 200);
    });

    this.container.querySelector('#btn-clear-scores')?.addEventListener('click', () => {
      if (confirm('Voulez-vous vraiment effacer tous les scores enregistrés du classement ?')) {
        db.clearPacmanScores();
        this.render();
      }
    });

    this.container.querySelector('#btn-pacman-reload')?.addEventListener('click', () => {
      this.restartGame();
    });
  }
}
