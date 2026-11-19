import type {
  ChatMessage,
  ChatChannel,
  ChatSettings,
  Volunteer
} from '../../types';
import { resolveVolunteerPermissions } from '../../types/index.ts';
import {
  computeCrc32Hex,
  STORAGE_KEYS
} from './constants.ts';
import { storageService } from './storageService.ts';

export class ChatService {
  public broadcastChatUpdate(): void {
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        const channel = new BroadcastChannel('openmdl_chat_sync');
        channel.postMessage({ type: 'CHAT_UPDATED', timestamp: Date.now() });
        channel.close();
      }
    } catch {}
  }

  public saveChatMessages(chatMessages: ChatMessage[]): void {
    storageService.safeSetItem(STORAGE_KEYS.CHAT_MESSAGES, JSON.stringify(chatMessages));
    try {
      import('@tauri-apps/api/core').then(({ invoke }) => {
        for (const msg of chatMessages) {
          invoke('sqlite_save_chat_message', {
            id: msg.id,
            channelId: msg.channelId,
            authorId: msg.authorId,
            authorName: msg.authorName,
            authorRole: msg.authorRole,
            authorAvatarColor: msg.authorAvatarColor || null,
            authorBubbleColor: msg.authorBubbleColor || null,
            content: msg.content,
            timestamp: msg.timestamp,
            signature: msg.signature
          }).catch(() => {});
        }
      }).catch(() => {});
    } catch {}
  }

  public saveChatChannels(chatChannels: ChatChannel[]): void {
    storageService.safeSetItem(STORAGE_KEYS.CHAT_CHANNELS, JSON.stringify(chatChannels));
  }

  public getChatChannels(
    chatChannels: ChatChannel[],
    currentVolunteer: Volunteer | null,
    appProfile: string,
    forVolunteer?: Volunteer | null
  ): ChatChannel[] {
    const user = forVolunteer || currentVolunteer;
    const perms = user ? resolveVolunteerPermissions(user) : null;
    const isSpecialAccess = !!(
      user?.isAdmin ||
      perms?.canViewDecaisse ||
      perms?.canManageUsers ||
      appProfile === 'visco'
    );

    return chatChannels.filter(c => {
      if (!c.isPrivate) return true;
      if (isSpecialAccess) return true;
      if (user && c.memberIds && c.memberIds.includes(user.id)) return true;
      return false;
    });
  }

  public getChatMessages(chatMessages: ChatMessage[], chatSettings: ChatSettings, channelId: string): ChatMessage[] {
    if (!chatSettings.enabled) return [];
    return chatMessages
      .filter(m => m.channelId === channelId)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  public purgeExpiredChatMessages(chatMessages: ChatMessage[], retentionDays: number): { purged: number; remaining: ChatMessage[] } {
    if (retentionDays <= 0) return { purged: 0, remaining: chatMessages };

    const cutoff = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);
    const initialCount = chatMessages.length;
    const remaining = chatMessages.filter(m => new Date(m.timestamp).getTime() >= cutoff);
    const purged = initialCount - remaining.length;

    return { purged, remaining };
  }

  public mergeIncomingChatMessages(
    existingMessages: ChatMessage[],
    incoming: ChatMessage[],
    chatSettings: ChatSettings,
    volunteers: Volunteer[],
    logSecurityCallback?: (msg: string) => void
  ): { addedCount: number; mergedMessages: ChatMessage[] } {
    if (!chatSettings.enabled || !Array.isArray(incoming) || incoming.length === 0) {
      return { addedCount: 0, mergedMessages: existingMessages };
    }

    let addedCount = 0;
    const result = [...existingMessages];
    const existingIds = new Set(existingMessages.map(m => m.id));

    incoming.forEach(inc => {
      if (!inc.id || existingIds.has(inc.id)) return;

      if (inc.authorAvatarUrl && inc.authorAvatarUrl.startsWith('data:')) {
        delete inc.authorAvatarUrl;
      }

      if (inc.authorId && inc.signature) {
        const author = volunteers.find(v => v.id === inc.authorId);
        if (author) {
          const expectedSig = computeCrc32Hex(`${author.id}:${author.username}:${inc.content}:${inc.timestamp}:${author.password}`);
          if (inc.signature !== expectedSig) {
            if (logSecurityCallback) {
              logSecurityCallback(`Message rejeté pour usurpation suspectée sur @${author.username}`);
            }
            return;
          }
        }
      }

      result.push(inc);
      existingIds.add(inc.id);
      addedCount++;
    });

    return { addedCount, mergedMessages: result };
  }

  public getUnreadDirectMessagesCount(
    chatChannels: ChatChannel[],
    chatMessages: ChatMessage[],
    chatSettings: ChatSettings,
    currentVolunteer: Volunteer | null
  ): number {
    const me = currentVolunteer;
    if (!me || !chatSettings.enabled) return 0;

    let readState: Record<string, string> = {};
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.CHAT_READ_STATE);
      if (stored) readState = JSON.parse(stored);
    } catch {}

    const myDmChannels = chatChannels.filter(c => 
      c.isDirectMessage && c.memberIds && c.memberIds.includes(me.id)
    );

    let unreadCount = 0;
    myDmChannels.forEach(c => {
      const lastReadIso = readState[c.id] || '1970-01-01T00:00:00.000Z';
      const unreadInChan = chatMessages.filter(m => 
        m.channelId === c.id && 
        m.authorId !== me.id && 
        new Date(m.timestamp).getTime() > new Date(lastReadIso).getTime()
      );
      unreadCount += unreadInChan.length;
    });

    return unreadCount;
  }

  public markChannelAsRead(channelId: string, currentVolunteer: Volunteer | null): void {
    if (!currentVolunteer) return;

    let readState: Record<string, string> = {};
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.CHAT_READ_STATE);
      if (stored) readState = JSON.parse(stored);
    } catch {}

    readState[channelId] = new Date().toISOString();
    try {
      localStorage.setItem(STORAGE_KEYS.CHAT_READ_STATE, JSON.stringify(readState));
    } catch {}
  }
}

export const chatService = new ChatService();
