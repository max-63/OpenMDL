import { db } from '../services/db';
import { Icons } from '../components/Icons';
import { escapeHtml } from '../utils/security';
import { AppDialog } from '../components/AppDialog';

export class ProfileView {
  private onUpdate: () => void;
  private previewAvatarUrl: string | null = null;
  private selectedBubbleColor: string = '#ea580c';
  private selectedChatBg: 'default' | 'slate' | 'midnight' | 'emerald' | 'amber' | 'sunset' = 'default';
  private successMsg: string | null = null;

  constructor(onUpdate: () => void) {
    this.onUpdate = onUpdate;
    const current = db.getCurrentVolunteer();
    if (current) {
      this.previewAvatarUrl = current.avatarUrl || null;
      this.selectedBubbleColor = current.themeSettings?.bubbleColor || current.avatarColor || '#ea580c';
      this.selectedChatBg = (current.themeSettings?.chatBg as any) || 'default';
    }
  }

  public render(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'w-full h-full flex flex-col gap-4 overflow-y-auto pr-1 animate-enter select-none';

    const current = db.getCurrentVolunteer();
    if (!current) {
      container.innerHTML = '<div class="p-8 text-center text-slate-500 font-bold">Aucun utilisateur connecté</div>';
      return container;
    }

    const availableColors = [
      '#ea580c', '#f97316', '#3b82f6', '#0284c7', '#10b981', '#059669',
      '#8b5cf6', '#7c3aed', '#ec4899', '#db2777', '#f59e0b', '#06b6d4'
    ];

    const bgOptions = [
      { id: 'default', label: 'Défaut (Thème système)', preview: 'bg-slate-100 dark:bg-slate-900/90' },
      { id: 'slate', label: 'Ardoise Sombre', preview: 'bg-slate-800' },
      { id: 'midnight', label: 'Nuit Étoilée (Bleu Nuit)', preview: 'bg-[#0b1528]' },
      { id: 'emerald', label: 'Menthe / Forêt', preview: 'bg-[#062419]' },
      { id: 'amber', label: 'Café & Boisé', preview: 'bg-[#26180b]' },
      { id: 'sunset', label: 'Crépuscule Violet', preview: 'bg-[#1e102f]' }
    ];

    container.innerHTML = `
      <!-- En-tête -->
      <div class="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div class="flex items-center gap-3.5">
          <div class="w-12 h-12 rounded-2xl bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20 flex items-center justify-center font-bold">
            ${Icons.user('w-6 h-6')}
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h1 class="text-lg font-black text-slate-900 dark:text-white tracking-tight">Mon Profil & Personnalisation</h1>
              <span class="px-2.5 py-0.5 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 text-[10px] font-extrabold uppercase tracking-wide border border-orange-500/20">
                Compte @${escapeHtml(current.username)}
              </span>
            </div>
            <p class="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
              Changez votre photo de profil visible à la connexion, ainsi que votre thème de messagerie.
            </p>
          </div>
        </div>

        ${this.successMsg ? `
          <div class="px-3.5 py-2 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold animate-pulse">
            ${escapeHtml(this.successMsg)}
          </div>
        ` : ''}
      </div>

      <!-- Grille 2 colonnes : Photo de profil & Thème Messagerie -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        <!-- Colonne 1 : Photo de profil (5 cols) -->
        <div class="lg:col-span-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-5">
          <div class="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            ${Icons.image('w-4 h-4 text-orange-500')}
            <span>Photo de profil</span>
          </div>

          <div class="flex flex-col items-center justify-center p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-300 dark:border-slate-700 gap-4 text-center">
            <div class="relative group">
              ${this.previewAvatarUrl ? `
                <img src="${this.previewAvatarUrl}" alt="Aperçu photo" class="w-28 h-28 rounded-3xl object-cover shadow-lg border-2 border-orange-500/50" />
              ` : `
                <div class="w-28 h-28 rounded-3xl flex items-center justify-center text-white text-3xl font-black shadow-lg" style="background-color: ${current.avatarColor}">
                  ${current.name.charAt(0)}
                </div>
              `}
              <label for="input-avatar-file" class="absolute inset-0 rounded-3xl bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white cursor-pointer text-xs font-bold gap-1">
                ${Icons.upload('w-5 h-5')}
                <span>Changer</span>
              </label>
            </div>

            <div class="space-y-1">
              <div class="font-bold text-sm text-slate-800 dark:text-slate-200">${escapeHtml(current.name)}</div>
              <div class="text-xs text-slate-400 font-mono">@${escapeHtml(current.username)} • ${current.role}</div>
            </div>

            <input type="file" id="input-avatar-file" accept="image/png, image/jpeg, image/webp" class="hidden" />

            <div class="flex items-center gap-2 pt-2">
              <label for="input-avatar-file" class="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs cursor-pointer transition-all flex items-center gap-1.5 shadow-sm">
                ${Icons.upload('w-3.5 h-3.5')}
                <span>Importer une photo</span>
              </label>

              ${this.previewAvatarUrl ? `
                <button type="button" id="btn-remove-avatar" class="px-3 py-2 rounded-xl bg-slate-200 hover:bg-rose-500/20 hover:text-rose-600 dark:bg-slate-700 dark:hover:bg-rose-500/20 text-slate-600 dark:text-slate-300 font-bold text-xs transition-colors cursor-pointer" title="Supprimer la photo et revenir à l'initiale colorée">
                  Supprimer
                </button>
              ` : ''}
            </div>
            <p class="text-[11px] text-slate-400">Formats acceptés : PNG, JPEG ou WEBP (redimensionnement automatique)</p>
          </div>
        </div>

        <!-- Colonne 2 : Personnalisation du Chat (7 cols) -->
        <div class="lg:col-span-7 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-6">
          <div class="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            ${Icons.palette('w-4 h-4 text-orange-500')}
            <span>Ambiance & Bulles de Messagerie</span>
          </div>

          <!-- Choix de couleur des bulles envoyées -->
          <div class="space-y-2.5">
            <label class="block text-xs font-bold text-slate-700 dark:text-slate-300">
              Couleur de mes bulles de messages
            </label>
            <div class="flex items-center gap-2.5 flex-wrap">
              ${availableColors.map(color => `
                <button 
                  type="button" 
                  data-bubble-color="${color}"
                  class="w-8 h-8 rounded-xl cursor-pointer transition-transform hover:scale-110 flex items-center justify-center ${this.selectedBubbleColor === color ? 'ring-2 ring-offset-2 ring-orange-500 scale-110' : 'opacity-80 hover:opacity-100'}"
                  style="background-color: ${color}"
                >
                  ${this.selectedBubbleColor === color ? Icons.check('w-4 h-4 text-white') : ''}
                </button>
              `).join('')}
            </div>
          </div>

          <!-- Choix du fond d'ambiance du chat -->
          <div class="space-y-2.5">
            <label class="block text-xs font-bold text-slate-700 dark:text-slate-300">
              Arrière-plan personnalisé du chat
            </label>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              ${bgOptions.map(bg => `
                <button 
                  type="button"
                  data-chat-bg="${bg.id}"
                  class="p-3 rounded-2xl border text-left flex items-center gap-3 transition-all cursor-pointer ${this.selectedChatBg === bg.id
                    ? 'border-orange-500 bg-orange-500/10 text-orange-600 dark:text-orange-400 font-bold'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-700 dark:text-slate-300'
                  }"
                >
                  <div class="w-6 h-6 rounded-lg ${bg.preview} border border-slate-300 dark:border-slate-700 flex-shrink-0"></div>
                  <span class="text-xs">${bg.label}</span>
                </button>
              `).join('')}
            </div>
          </div>

          <!-- Aperçu interactif en direct -->
          <div class="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Aperçu en direct de vos messages</div>
            <div class="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3 bg-slate-50 dark:bg-slate-950/50">
              <div class="flex items-start gap-2.5 max-w-[80%]">
                <div class="w-6 h-6 rounded-lg bg-sky-500 text-white font-bold text-[10px] flex items-center justify-center flex-shrink-0">VS</div>
                <div class="p-2.5 rounded-2xl rounded-tl-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-200">
                  <div class="text-[10px] font-bold text-sky-600 dark:text-sky-400">Vie Scolaire</div>
                  Bonjour à tous ! La permanence est-elle bien ouverte ?
                </div>
              </div>

              <div class="flex items-start justify-end gap-2.5 ml-auto max-w-[80%]">
                <div class="p-2.5 rounded-2xl rounded-tr-sm text-white text-xs shadow-sm" style="background-color: ${this.selectedBubbleColor}">
                  <div class="text-[10px] font-bold opacity-80">${escapeHtml(current.name)} (Moi)</div>
                  Oui, nous sommes en place avec les stocks prêts !
                </div>
                ${this.previewAvatarUrl ? `
                  <img src="${this.previewAvatarUrl}" alt="Moi" class="w-6 h-6 rounded-lg object-cover flex-shrink-0" />
                ` : `
                  <div class="w-6 h-6 rounded-lg text-white font-bold text-[10px] flex items-center justify-center flex-shrink-0" style="background-color: ${current.avatarColor}">
                    ${current.name.charAt(0)}
                  </div>
                `}
              </div>
            </div>
          </div>

          <!-- Bouton de sauvegarde -->
          <div class="pt-2 flex justify-end">
            <button 
              type="button" 
              id="btn-save-profile" 
              class="px-5 py-2.5 rounded-2xl bg-orange-600 hover:bg-orange-500 text-white font-extrabold text-xs shadow-md shadow-orange-600/20 active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
            >
              ${Icons.check('w-4 h-4')}
              <span>Enregistrer mes préférences</span>
            </button>
          </div>

        </div>

      </div>
    `;

    this.attachEvents(container, current);
    return container;
  }

  private attachEvents(container: HTMLElement, current: any): void {
    const fileInput = container.querySelector('#input-avatar-file') as HTMLInputElement;

    fileInput?.addEventListener('change', () => {
      if (!fileInput.files || fileInput.files.length === 0) return;
      const file = fileInput.files[0];

      if (file.size > 2 * 1024 * 1024) {
        AppDialog.alert({
          title: 'Image trop lourde',
          message: 'Veuillez sélectionner une image de moins de 2 Mo.',
          type: 'warning'
        });
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          // Compression & redimensionnement automatique en canvas (128x128 max pour légèreté absolue en db)
          const canvas = document.createElement('canvas');
          const maxDim = 160;
          let w = img.width;
          let h = img.height;
          if (w > h) {
            if (w > maxDim) {
              h = Math.round((h * maxDim) / w);
              w = maxDim;
            }
          } else {
            if (h > maxDim) {
              w = Math.round((w * maxDim) / h);
              h = maxDim;
            }
          }
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, w, h);
            const dataUrl = canvas.toDataURL('image/webp', 0.85);
            this.previewAvatarUrl = dataUrl;
            db.updateVolunteerAvatar(current.id, dataUrl);
            this.successMsg = 'Photo mise à jour !';
            this.onUpdate();
          }
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });

    container.querySelector('#btn-remove-avatar')?.addEventListener('click', () => {
      this.previewAvatarUrl = null;
      db.updateVolunteerAvatar(current.id, '');
      this.successMsg = 'Photo réinitialisée.';
      this.onUpdate();
    });

    container.querySelectorAll('[data-bubble-color]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const col = (e.currentTarget as HTMLElement).getAttribute('data-bubble-color');
        if (col) {
          this.selectedBubbleColor = col;
          db.updateVolunteerThemeSettings(current.id, {
            bubbleColor: this.selectedBubbleColor,
            chatBg: this.selectedChatBg
          });
          this.successMsg = 'Couleur des bulles mise à jour !';
          this.onUpdate();
        }
      });
    });

    container.querySelectorAll('[data-chat-bg]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const bg = (e.currentTarget as HTMLElement).getAttribute('data-chat-bg') as any;
        if (bg) {
          this.selectedChatBg = bg;
          db.updateVolunteerThemeSettings(current.id, {
            bubbleColor: this.selectedBubbleColor,
            chatBg: this.selectedChatBg
          });
          this.successMsg = 'Arrière-plan du chat mis à jour !';
          this.onUpdate();
        }
      });
    });

    container.querySelector('#btn-save-profile')?.addEventListener('click', () => {
      db.updateVolunteerThemeSettings(current.id, {
        bubbleColor: this.selectedBubbleColor,
        chatBg: this.selectedChatBg
      });
      this.successMsg = 'Toutes vos préférences sont enregistrées !';
      this.onUpdate();
    });
  }
}
