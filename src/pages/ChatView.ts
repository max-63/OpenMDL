import { db } from '../services/db';
import { Icons } from '../components/Icons';
import { escapeHtml } from '../utils/security';
import { ChatMessage, ChatChannel } from '../types';
import { AppDialog } from '../components/AppDialog';

export class ChatView {
  private activeChannelId: string = 'all';
  private broadcastListener: BroadcastChannel | null = null;
  private messageInputVal: string = '';

  constructor() {
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        this.broadcastListener = new BroadcastChannel('openmdl_chat_sync');
        this.broadcastListener.onmessage = () => {
          this.refreshMessages();
        };
      }
    } catch {}
  }

  private currentContainer: HTMLElement | null = null;

  public render(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'w-full h-full flex flex-col gap-3 overflow-hidden animate-enter select-none';
    this.currentContainer = container;

    const current = db.getCurrentVolunteer();
    const chatSettings = db.getChatSettings();
    const allVolunteers = db.getVolunteers();

    if (!chatSettings.enabled) {
      container.innerHTML = `
        <div class="h-full rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 flex flex-col items-center justify-center text-center gap-3">
          <div class="w-16 h-16 rounded-3xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center">
            ${Icons.messageSquare('w-8 h-8')}
          </div>
          <h2 class="text-lg font-black text-slate-800 dark:text-slate-100">Messagerie Désactivée</h2>
          <p class="text-xs text-slate-500 max-w-sm">
            La messagerie instantanée a été désactivée par un administrateur. Vous pouvez la réactiver dans les Paramètres généraux.
          </p>
        </div>
      `;
      return container;
    }

    const channels = db.getChatChannels(current);
    // Vérifier que le canal actif est toujours valide
    if (!channels.some(c => c.id === this.activeChannelId)) {
      this.activeChannelId = channels[0]?.id || 'all';
    }

    // Marquer le canal courant comme lu
    db.markChannelAsRead(this.activeChannelId);

    const activeChannel = channels.find(c => c.id === this.activeChannelId);
    const messages = db.getChatMessages(this.activeChannelId);

    // Ambiance de fond personnalisée selon le profil
    const chatBg = current?.themeSettings?.chatBg || 'default';
    let bgClasses = 'bg-slate-50/70 dark:bg-[#0b101c]';
    if (chatBg === 'slate') bgClasses = 'bg-slate-800 text-slate-100';
    else if (chatBg === 'midnight') bgClasses = 'bg-[#0b1528] text-slate-100';
    else if (chatBg === 'emerald') bgClasses = 'bg-[#062419] text-emerald-100';
    else if (chatBg === 'amber') bgClasses = 'bg-[#26180b] text-amber-100';
    else if (chatBg === 'sunset') bgClasses = 'bg-[#1e102f] text-fuchsia-100';

    // Séparer les salons publics/groupes et les messages privés (MP)
    const groupChannels = channels.filter(c => !c.isDirectMessage);
    const dmChannels = channels.filter(c => c.isDirectMessage);

    // Liste des autres bénévoles pour démarrer un MP direct
    const otherVolunteers = allVolunteers.filter(v => v.id !== current?.id && !v.isSuspended);

    container.innerHTML = `
      <!-- En-tête Messagerie -->
      <div id="chat-header" class="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-5 py-3.5 shadow-sm flex items-center justify-between gap-4 flex-shrink-0">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20 flex items-center justify-center font-bold">
            ${activeChannel?.isDirectMessage ? Icons.user('w-5 h-5') : Icons.messageSquare('w-5 h-5')}
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h1 class="text-base font-black text-slate-900 dark:text-white tracking-tight">
                ${activeChannel?.isDirectMessage ? '' : '#'} ${escapeHtml(activeChannel?.name || 'Général')}
              </h1>
              ${activeChannel?.isDirectMessage ? `
                <span class="px-2 py-0.5 rounded-md bg-purple-500/15 text-purple-600 dark:text-purple-400 text-[10px] font-extrabold uppercase tracking-wide border border-purple-500/25">
                  Message Privé (MP)
                </span>
              ` : activeChannel?.isPrivate ? `
                <span class="px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400 text-[10px] font-extrabold uppercase tracking-wide border border-amber-500/25">
                  Privé
                </span>
              ` : `
                <span class="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-extrabold uppercase tracking-wide border border-emerald-500/20">
                  Public
                </span>
              `}
            </div>
            <p class="text-xs text-slate-400 font-medium">
              ${escapeHtml(activeChannel?.description || 'Canal d\'échange sécurisé sans serveur')}
            </p>
          </div>
        </div>

        <!-- Badges d'état sécurité & Rétention -->
        <div class="flex items-center gap-2 text-xs">
          <div class="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[11px] font-bold border border-slate-200 dark:border-slate-700 flex items-center gap-1.5" title="Chaque message est signé pour empêcher toute usurpation d'identité">
            ${Icons.shieldCheck('w-3.5 h-3.5 text-emerald-500')}
            <span>Anti-usurpation actif</span>
          </div>

          <div class="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[11px] font-bold border border-slate-200 dark:border-slate-700">
            Rétention : ${chatSettings.retentionDays > 0 ? `${chatSettings.retentionDays}j` : 'Illimitée'}
          </div>

          <button 
            type="button" 
            id="btn-create-channel"
            class="px-3 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all shadow-xs"
            title="Créer un nouveau salon ou groupe de discussion avec choix des membres"
          >
            ${Icons.plus('w-3.5 h-3.5')}
            <span>Nouveau groupe</span>
          </button>
        </div>
      </div>

      <!-- Corps du Chat : Sidebar Salons + MPs (gauche) + Zone Discussion (droite) -->
      <div class="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-12 gap-3">
        
        <!-- Sidebar Salons & Canaux & MPs (3 cols) -->
        <div class="md:col-span-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 shadow-sm flex flex-col gap-3 min-h-0 overflow-y-auto">
          
          <!-- Section 1 : Salons & Groupes -->
          <div>
            <div class="text-[11px] font-black text-slate-400 uppercase tracking-wider px-2 py-1 flex items-center justify-between">
              <span>Salons & Groupes</span>
              <span class="text-[10px] font-bold text-slate-500">${groupChannels.length}</span>
            </div>

            <div id="channels-list-groups" class="space-y-1 mt-1">
              ${groupChannels.map(ch => {
                const isSelected = ch.id === this.activeChannelId;
                return `
                  <button 
                    type="button"
                    data-channel-id="${ch.id}"
                    class="w-full px-3 py-2 rounded-xl text-left flex items-center justify-between transition-all cursor-pointer ${isSelected
                      ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400 font-extrabold border border-orange-500/20'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 font-semibold'
                    }"
                  >
                    <div class="flex items-center gap-2 truncate">
                      <span class="text-xs opacity-60">#</span>
                      <span class="text-xs truncate">${escapeHtml(ch.name)}</span>
                    </div>
                    ${ch.isPrivate ? Icons.lock('w-3 h-3 opacity-60 flex-shrink-0') : ''}
                  </button>
                `;
              }).join('')}
            </div>
          </div>

          <!-- Section 2 : Messages Privés (MP) en cours -->
          <div class="pt-2 border-t border-slate-100 dark:border-slate-800">
            <div class="text-[11px] font-black text-slate-400 uppercase tracking-wider px-2 py-1 flex items-center justify-between">
              <span>Messages Privés (MP)</span>
              <span class="text-[10px] font-bold text-slate-500">${dmChannels.length}</span>
            </div>

            <div id="channels-list-dms" class="space-y-1 mt-1">
              ${dmChannels.map(ch => {
                const isSelected = ch.id === this.activeChannelId;
                // Retrouver l'interlocuteur
                const targetId = ch.memberIds?.find(id => id !== current?.id) || ch.dmTargetVolunteerId;
                const targetVol = allVolunteers.find(v => v.id === targetId);

                return `
                  <button 
                    type="button"
                    data-channel-id="${ch.id}"
                    class="w-full px-3 py-2 rounded-xl text-left flex items-center justify-between transition-all cursor-pointer ${isSelected
                      ? 'bg-purple-500/15 text-purple-600 dark:text-purple-400 font-extrabold border border-purple-500/30'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 font-semibold'
                    }"
                  >
                    <div class="flex items-center gap-2 truncate">
                      ${targetVol?.avatarUrl ? `
                        <img src="${targetVol.avatarUrl}" alt="Avatar" class="w-4 h-4 rounded-full object-cover flex-shrink-0" />
                      ` : `
                        <span class="w-4 h-4 rounded-full text-white text-[9px] font-black flex items-center justify-center flex-shrink-0" style="background-color: ${targetVol?.avatarColor || '#a855f7'}">
                          ${(targetVol?.name || ch.name).charAt(0)}
                        </span>
                      `}
                      <span class="text-xs truncate">${escapeHtml(targetVol?.name || ch.name)}</span>
                    </div>
                    <span class="text-[10px] font-mono text-purple-500 font-bold">MP</span>
                  </button>
                `;
              }).join('')}
            </div>
          </div>

          <!-- Section 3 : Démarrer un MP avec un bénévole -->
          <div class="pt-2 border-t border-slate-100 dark:border-slate-800">
            <div class="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1">
              Écrire à un membre (MP)
            </div>
            <div class="space-y-1 mt-1 max-h-36 overflow-y-auto">
              ${otherVolunteers.map(vol => `
                <button
                  type="button"
                  data-start-dm="${vol.id}"
                  class="w-full px-2.5 py-1.5 rounded-lg text-left flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs transition-colors cursor-pointer group"
                >
                  ${vol.avatarUrl ? `
                    <img src="${vol.avatarUrl}" alt="Avatar" class="w-5 h-5 rounded-md object-cover flex-shrink-0" />
                  ` : `
                    <span class="w-5 h-5 rounded-md text-white text-[10px] font-black flex items-center justify-center flex-shrink-0 shadow-xs" style="background-color: ${vol.avatarColor}">
                      ${vol.name.charAt(0)}
                    </span>
                  `}
                  <div class="truncate flex-1">
                    <span class="font-semibold group-hover:text-orange-500 truncate block">${escapeHtml(vol.name)}</span>
                  </div>
                  <span class="text-[9px] text-slate-400 font-mono">@${escapeHtml(vol.username)}</span>
                </button>
              `).join('')}
            </div>
          </div>

          <!-- Note bas de sidebar -->
          <div class="mt-auto pt-3 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-400 px-2 leading-relaxed">
            Vos messages sont synchronisés en direct sur le réseau local et stockés dans la base de données.
          </div>
        </div>

        <!-- Zone de discussion & saisie (9 cols) -->
        <div class="md:col-span-9 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col min-h-0 overflow-hidden">
          
          <!-- Conteneur des bulles de messages -->
          <div id="chat-messages-container" class="flex-1 p-4 overflow-y-auto space-y-3.5 ${bgClasses}">
            ${this.renderMessagesListHtml(messages, current, allVolunteers)}
          </div>

          <!-- Zone de composition de message -->
          <div class="p-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2 flex-shrink-0">
            <input 
              type="text"
              id="input-chat-message"
              placeholder="Écrire un message dans ${activeChannel?.isDirectMessage ? '' : '#'}${escapeHtml(activeChannel?.name || 'Général')}..."
              value="${escapeHtml(this.messageInputVal)}"
              autocomplete="off"
              class="flex-1 px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-orange-500 dark:focus:border-orange-500 text-slate-900 dark:text-white text-xs outline-none transition-all placeholder:text-slate-400"
            />
            <button 
              type="button"
              id="btn-send-chat-message"
              class="px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95 flex-shrink-0"
              title="Envoyer (Touche Entrée)"
            >
              <span>Envoyer</span>
              ${Icons.send('w-3.5 h-3.5')}
            </button>
          </div>

        </div>

      </div>
    `;

    this.attachEvents(container);
    this.scrollToBottom(container);
    return container;
  }

  private renderMessagesListHtml(messages: ChatMessage[], current: any, allVolunteers: any[]): string {
    if (messages.length === 0) {
      return `
        <div class="h-full flex flex-col items-center justify-center text-center p-8 text-slate-400 gap-2">
          <div class="w-12 h-12 rounded-2xl bg-slate-200/50 dark:bg-slate-800/50 flex items-center justify-center">
            ${Icons.messageSquare('w-6 h-6')}
          </div>
          <div class="font-bold text-xs">Aucun message dans ce salon</div>
          <div class="text-[11px] max-w-xs">Soyez le premier à envoyer un message aux bénévoles et à la Vie Scolaire !</div>
        </div>
      `;
    }

    return messages.map(msg => this.renderMessageBubbleHtml(msg, current, allVolunteers)).join('');
  }

  private renderMessageBubbleHtml(msg: ChatMessage, current: any, allVolunteers: any[]): string {
    const isMe = msg.authorId === current?.id;
    const dateStr = new Date(msg.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    
    // Résolution dynamique de l'avatar et du profil de l'auteur
    const authorVolunteer = allVolunteers.find(v => v.id === msg.authorId);
    const authorAvatarUrl = authorVolunteer?.avatarUrl || msg.authorAvatarUrl;
    const authorAvatarColor = authorVolunteer?.avatarColor || msg.authorAvatarColor || '#64748b';
    const authorBubbleColor = isMe 
      ? (current?.themeSettings?.bubbleColor || '#ea580c')
      : (authorVolunteer?.themeSettings?.bubbleColor || msg.authorBubbleColor || '');

    return `
      <div class="flex items-start gap-2.5 ${isMe ? 'justify-end' : 'justify-start'} group" data-message-id="${msg.id}">
        ${!isMe ? `
          ${authorAvatarUrl ? `
            <img src="${authorAvatarUrl}" alt="${escapeHtml(msg.authorName)}" class="w-8 h-8 rounded-xl object-cover border border-slate-300 dark:border-slate-700 flex-shrink-0" />
          ` : `
            <div class="w-8 h-8 rounded-xl flex items-center justify-center text-white font-bold text-xs flex-shrink-0 shadow-xs" style="background-color: ${authorAvatarColor}">
              ${msg.authorName.charAt(0)}
            </div>
          `}
        ` : ''}

        <div class="max-w-[78%] flex flex-col ${isMe ? 'items-end' : 'items-start'}">
          <div class="flex items-center gap-1.5 px-1 mb-1 text-[11px]">
            <span class="font-bold text-slate-700 dark:text-slate-300">${escapeHtml(msg.authorName)}</span>
            <span class="text-[9px] text-slate-400">${dateStr}</span>
            ${msg.signature ? `
              <span title="Message signé et vérifié" class="text-emerald-500">${Icons.shieldCheck('w-3 h-3')}</span>
            ` : ''}
          </div>

          <div 
            class="px-4 py-2.5 rounded-2xl text-xs leading-relaxed shadow-xs break-words ${isMe
              ? 'rounded-tr-xs text-white'
              : 'rounded-tl-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100'
            }"
            style="${isMe ? `background-color: ${authorBubbleColor || '#ea580c'}` : ''}"
          >
            ${escapeHtml(msg.content)}
          </div>
        </div>

        ${isMe ? `
          ${current?.avatarUrl ? `
            <img src="${current.avatarUrl}" alt="${escapeHtml(current.name)}" class="w-8 h-8 rounded-xl object-cover border border-slate-300 dark:border-slate-700 flex-shrink-0" />
          ` : `
            <div class="w-8 h-8 rounded-xl flex items-center justify-center text-white font-bold text-xs flex-shrink-0 shadow-xs" style="background-color: ${current?.avatarColor || '#ea580c'}">
              ${current?.name.charAt(0) || 'M'}
            </div>
          `}
        ` : ''}
      </div>
    `;
  }

  private attachEvents(container: HTMLElement): void {
    // Changement de salon
    container.querySelectorAll('[data-channel-id]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const chanId = (e.currentTarget as HTMLElement).getAttribute('data-channel-id');
        if (chanId && chanId !== this.activeChannelId) {
          this.activeChannelId = chanId;
          const parent = container.parentElement;
          if (parent) {
            parent.innerHTML = '';
            parent.appendChild(this.render());
          }
        }
      });
    });

    // Démarrage d'un Message Privé direct
    container.querySelectorAll('[data-start-dm]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const targetId = (e.currentTarget as HTMLElement).getAttribute('data-start-dm');
        if (!targetId) return;
        try {
          const dmChan = db.getOrCreateDirectMessageChannel(targetId);
          this.activeChannelId = dmChan.id;
          const parent = container.parentElement;
          if (parent) {
            parent.innerHTML = '';
            parent.appendChild(this.render());
          }
        } catch (err: any) {
          AppDialog.alert({
            title: 'Message privé impossible',
            message: err.message || 'Erreur lors de l\'ouverture du message privé.',
            type: 'warning'
          });
        }
      });
    });

    // Envoi de message sans flash ni reload de page
    const input = container.querySelector('#input-chat-message') as HTMLInputElement;
    const btnSend = container.querySelector('#btn-send-chat-message') as HTMLButtonElement;

    const handleSend = () => {
      const text = input?.value.trim() || '';
      if (!text) return;

      const res = db.sendChatMessage(this.activeChannelId, text);
      if (res.success && res.chatMessage) {
        input.value = '';
        this.messageInputVal = '';
        input.focus();

        const messagesBox = container.querySelector('#chat-messages-container');
        if (messagesBox) {
          const current = db.getCurrentVolunteer();
          const allVolunteers = db.getVolunteers();
          
          // Si la boîte affichait le message vide "Aucun message", on le retire
          const emptyState = messagesBox.querySelector('.h-full');
          if (emptyState) {
            messagesBox.innerHTML = '';
          }

          // Ajout direct de la bulle dans le DOM existant
          const temp = document.createElement('div');
          temp.innerHTML = this.renderMessageBubbleHtml(res.chatMessage, current, allVolunteers);
          if (temp.firstElementChild) {
            messagesBox.appendChild(temp.firstElementChild);
          }
          this.scrollToBottom(container);
        } else {
          this.refreshMessages();
        }
      } else {
        AppDialog.alert({
          title: 'Envoi impossible',
          message: res.message,
          type: 'warning'
        });
      }
    };

    btnSend?.addEventListener('click', handleSend);
    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSend();
      }
    });

    // Création de groupe avec sélection des membres
    container.querySelector('#btn-create-channel')?.addEventListener('click', () => {
      this.openCreateGroupModal();
    });
  }

  private openCreateGroupModal(): void {
    const current = db.getCurrentVolunteer();
    const allVolunteers = db.getVolunteers().filter(v => !v.isSuspended);

    const modalContent = document.createElement('div');
    modalContent.className = 'space-y-4';

    modalContent.innerHTML = `
      <div class="space-y-3">
        <!-- Nom du groupe -->
        <div>
          <label class="block font-bold text-xs text-slate-700 dark:text-slate-300 mb-1">Nom du groupe *</label>
          <input 
            type="text" 
            id="new-group-name" 
            placeholder="ex: Bureau MDL, Bal de fin d'année, Logistique..." 
            class="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white outline-none focus:border-orange-500 transition-all placeholder:text-slate-400"
          />
        </div>

        <!-- Description du groupe -->
        <div>
          <label class="block font-bold text-xs text-slate-700 dark:text-slate-300 mb-1">Description (optionnelle)</label>
          <input 
            type="text" 
            id="new-group-desc" 
            placeholder="ex: Groupe de travail pour l'organisation de l'événement" 
            class="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white outline-none focus:border-orange-500 transition-all placeholder:text-slate-400"
          />
        </div>

        <!-- Option Groupe Privé -->
        <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 flex items-start gap-3">
          <input 
            type="checkbox" 
            id="new-group-private" 
            checked
            class="mt-0.5 rounded text-orange-600 focus:ring-orange-500 cursor-pointer"
          />
          <label for="new-group-private" class="cursor-pointer text-xs">
            <span class="font-bold text-slate-900 dark:text-white block">Groupe restreint (privé)</span>
            <span class="text-slate-500 dark:text-slate-400 text-[11px] block">
              Seuls les membres sélectionnés ci-dessous pourront voir et échanger dans ce groupe.
            </span>
          </label>
        </div>

        <!-- Sélection des membres -->
        <div>
          <div class="flex items-center justify-between mb-1.5">
            <label class="font-bold text-xs text-slate-700 dark:text-slate-300">
              Membres à inclure dans le groupe (${allVolunteers.length} bénévoles)
            </label>
            <div class="flex items-center gap-2">
              <button type="button" id="btn-select-all-members" class="text-[11px] text-orange-600 hover:text-orange-500 font-bold cursor-pointer">
                Tout cocher
              </button>
              <span class="text-slate-300 dark:text-slate-600">|</span>
              <button type="button" id="btn-deselect-all-members" class="text-[11px] text-slate-400 hover:text-slate-300 font-bold cursor-pointer">
                Décocher
              </button>
            </div>
          </div>

          <div class="border border-slate-200 dark:border-slate-700 rounded-xl p-2 max-h-56 overflow-y-auto space-y-1.5 bg-slate-50/50 dark:bg-slate-800/30">
            ${allVolunteers.map(vol => {
              const isCreator = vol.id === current?.id;
              return `
                <div 
                  class="group-member-row flex items-center justify-between p-2.5 rounded-xl border transition-all select-none ${
                    isCreator 
                      ? 'cursor-not-allowed opacity-90 bg-orange-500/10 border-orange-500/30 dark:bg-orange-500/15' 
                      : 'cursor-pointer hover:border-orange-500/50 hover:bg-orange-500/5 dark:hover:bg-orange-500/10 bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800'
                  }"
                  data-vol-id="${vol.id}"
                  data-creator="${isCreator ? 'true' : 'false'}"
                >
                  <input 
                    type="checkbox" 
                    value="${vol.id}" 
                    class="group-member-checkbox hidden"
                    ${isCreator ? 'checked disabled' : 'checked'}
                  />
                  <div class="flex items-center gap-3 truncate flex-1 min-w-0 pointer-events-none">
                    <div class="custom-cb w-5 h-5 rounded-md flex items-center justify-center border transition-all flex-shrink-0 bg-orange-600 border-orange-600 text-white shadow-sm shadow-orange-600/20">
                      ${Icons.check('w-3.5 h-3.5 stroke-[3]')}
                    </div>
                    ${vol.avatarUrl ? `
                      <img src="${vol.avatarUrl}" alt="Avatar" class="w-7 h-7 rounded-lg object-cover flex-shrink-0" />
                    ` : `
                      <span class="w-7 h-7 rounded-lg text-white text-xs font-black flex items-center justify-center flex-shrink-0 shadow-sm" style="background-color: ${vol.avatarColor}">
                        ${vol.name.charAt(0)}
                      </span>
                    `}
                    <div class="truncate">
                      <div class="font-bold text-xs text-slate-800 dark:text-slate-200 truncate flex items-center gap-1.5">
                        <span>${escapeHtml(vol.name)}</span>
                        ${isCreator ? '<span class="text-[9px] px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-600 dark:text-orange-400 font-extrabold">Vous (Créateur)</span>' : ''}
                      </div>
                      <div class="text-[10px] text-slate-400 font-mono">@${escapeHtml(vol.username)} &bull; ${escapeHtml(vol.role)}</div>
                    </div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>

      <!-- Boutons d'action -->
      <div class="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
        <button 
          type="button" 
          id="btn-cancel-create-group"
          class="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-all"
        >
          Annuler
        </button>
        <button 
          type="button" 
          id="btn-confirm-create-group"
          class="px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-black text-xs flex items-center gap-1.5 shadow-md shadow-orange-600/20 active:scale-95 cursor-pointer transition-all"
        >
          ${Icons.plus('w-3.5 h-3.5')}
          <span>Créer le groupe</span>
        </button>
      </div>
    `;

    const closeModal = AppDialog.custom({
      title: 'Créer un nouveau groupe de discussion',
      content: modalContent,
      size: 'md'
    });

    const updateRowVisual = (row: HTMLElement, isChecked: boolean) => {
      const cbBox = row.querySelector('.custom-cb');
      const isCreator = row.dataset.creator === 'true';
      if (!cbBox) return;

      if (isChecked) {
        cbBox.className = 'custom-cb w-5 h-5 rounded-md flex items-center justify-center border transition-all flex-shrink-0 bg-orange-600 border-orange-600 text-white shadow-sm shadow-orange-600/20';
        cbBox.innerHTML = Icons.check('w-3.5 h-3.5 stroke-[3]');
        row.className = `group-member-row flex items-center justify-between p-2.5 rounded-xl border transition-all select-none ${
          isCreator 
            ? 'cursor-not-allowed opacity-90 bg-orange-500/10 border-orange-500/30 dark:bg-orange-500/15' 
            : 'cursor-pointer bg-orange-500/10 dark:bg-orange-500/20 border-orange-500/40 text-orange-950 dark:text-orange-50 shadow-xs'
        }`;
      } else {
        cbBox.className = 'custom-cb w-5 h-5 rounded-md flex items-center justify-center border transition-all flex-shrink-0 bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-transparent';
        cbBox.innerHTML = '';
        row.className = 'group-member-row flex items-center justify-between p-2.5 rounded-xl border transition-all select-none cursor-pointer hover:border-orange-500/30 hover:bg-orange-500/5 dark:hover:bg-orange-500/10 bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 text-slate-800 dark:text-slate-200 opacity-70';
      }
    };

    // Initialiser les bordures visuelles pour ceux cochés au départ
    modalContent.querySelectorAll<HTMLElement>('.group-member-row').forEach(row => {
      const cb = row.querySelector<HTMLInputElement>('.group-member-checkbox');
      if (cb) updateRowVisual(row, cb.checked);
    });

    // Clic sur toute la ligne pour cocher/décocher
    modalContent.querySelectorAll<HTMLElement>('.group-member-row').forEach(row => {
      row.addEventListener('click', (e) => {
        if (row.dataset.creator === 'true') return;
        const cb = row.querySelector<HTMLInputElement>('.group-member-checkbox');
        if (!cb || cb.disabled) return;
        cb.checked = !cb.checked;
        updateRowVisual(row, cb.checked);
      });
    });

    // Logique des cases à cocher Tout cocher / Décocher
    modalContent.querySelector('#btn-select-all-members')?.addEventListener('click', () => {
      modalContent.querySelectorAll<HTMLElement>('.group-member-row').forEach(row => {
        const cb = row.querySelector<HTMLInputElement>('.group-member-checkbox');
        if (cb) {
          cb.checked = true;
          updateRowVisual(row, true);
        }
      });
    });

    modalContent.querySelector('#btn-deselect-all-members')?.addEventListener('click', () => {
      modalContent.querySelectorAll<HTMLElement>('.group-member-row').forEach(row => {
        if (row.dataset.creator === 'true') return;
        const cb = row.querySelector<HTMLInputElement>('.group-member-checkbox');
        if (cb) {
          cb.checked = false;
          updateRowVisual(row, false);
        }
      });
    });

    modalContent.querySelector('#btn-cancel-create-group')?.addEventListener('click', () => {
      closeModal();
    });

    modalContent.querySelector('#btn-confirm-create-group')?.addEventListener('click', () => {
      const nameInput = modalContent.querySelector('#new-group-name') as HTMLInputElement;
      const descInput = modalContent.querySelector('#new-group-desc') as HTMLInputElement;
      const privateInput = modalContent.querySelector('#new-group-private') as HTMLInputElement;

      const groupName = nameInput?.value.trim() || '';
      if (!groupName) {
        nameInput?.focus();
        AppDialog.alert({
          title: 'Nom requis',
          message: 'Veuillez saisir un nom pour ce groupe de discussion.',
          type: 'warning'
        });
        return;
      }

      const isPrivate = privateInput?.checked ?? true;
      const description = descInput?.value.trim() || 'Groupe créé par les membres';

      // Récupérer les membres sélectionnés
      const selectedMemberIds: string[] = [];
      modalContent.querySelectorAll<HTMLInputElement>('.group-member-checkbox:checked').forEach(cb => {
        selectedMemberIds.push(cb.value);
      });

      // Toujours s'assurer que le créateur est membre de son propre groupe
      if (current?.id && !selectedMemberIds.includes(current.id)) {
        selectedMemberIds.push(current.id);
      }

      const res = db.createChatChannel(groupName, description, isPrivate, selectedMemberIds);
      if (res.success && res.channel) {
        closeModal();
        this.activeChannelId = res.channel.id;
        const parent = this.currentContainer?.parentElement || document.querySelector('main');
        if (parent) {
          parent.innerHTML = '';
          parent.appendChild(this.render());
        }
      } else {
        AppDialog.alert({
          title: 'Erreur',
          message: res.message || 'Impossible de créer le groupe.',
          type: 'error'
        });
      }
    });

    // Auto-focus sur le champ nom
    setTimeout(() => {
      const nameInput = modalContent.querySelector('#new-group-name') as HTMLInputElement;
      nameInput?.focus();
    }, 100);
  }

  private scrollToBottom(container: HTMLElement): void {
    setTimeout(() => {
      const box = container.querySelector('#chat-messages-container');
      if (box) {
        box.scrollTop = box.scrollHeight;
      }
    }, 50);
  }

  public refreshMessages(): void {
    const container = this.currentContainer || document.querySelector('main')?.firstElementChild as HTMLElement;
    const messagesBox = container?.querySelector('#chat-messages-container') as HTMLElement;
    
    // Si la vue du chat est affichée et possède son conteneur de messages, mettre à jour uniquement la liste des messages
    if (messagesBox && container) {
      const current = db.getCurrentVolunteer();
      const allVolunteers = db.getVolunteers();
      const messages = db.getChatMessages(this.activeChannelId);

      // Mémoriser la position de scroll pour éviter tout saut brutal
      const isNearBottom = messagesBox.scrollHeight - messagesBox.scrollTop - messagesBox.clientHeight < 120;
      
      messagesBox.innerHTML = this.renderMessagesListHtml(messages, current, allVolunteers);

      if (isNearBottom) {
        this.scrollToBottom(container);
      }
      return;
    }

    // Fallback : si la structure n'est pas encore présente
    const parent = document.querySelector('main');
    if (parent) {
      parent.innerHTML = '';
      parent.appendChild(this.render());
    }
  }
}

