import { marked } from 'marked';
import { escapeHtml } from './security';

// Configuration de marked pour les messages de chat (liens sécurisés, gfm, retour à la ligne)
marked.setOptions({
  gfm: true,
  breaks: true
});

/**
 * Dictionnaire complet des emojis style Reddit / Discord / Slack (:smile:, :fire:, :coffee:, etc.)
 */
export const CHAT_EMOJIS: Record<string, string> = {
  // Émotions / Visages
  'smile': '😊',
  'grin': '😁',
  'joy': '😂',
  'rofl': '🤣',
  'sweat_smile': '😅',
  'laughing': '😆',
  'wink': '😉',
  'blush': '😊',
  'innocent': '😇',
  'heart_eyes': '😍',
  'kissing_heart': '😘',
  'yum': '😋',
  'stuck_out_tongue': '😛',
  'sunglasses': '😎',
  'smirk': '😏',
  'thinking': '🤔',
  'neutral_face': '😐',
  'expressionless': '😑',
  'unamused': '😒',
  'rolling_eyes': '🙄',
  'grimacing': '😬',
  'relieved': '😌',
  'pensive': '😔',
  'sleepy': '😪',
  'sleeping': '😴',
  'mask': '😷',
  'dizzy_face': '😵',
  'exploding_head': '🤯',
  'partying_face': '🥳',
  'nerd': '🤓',
  'pleading': '🥺',
  'cry': '😢',
  'sob': '😭',
  'scream': '😱',
  'angry': '😠',
  'rage': '😡',
  'skull': '💀',
  'clown': '🤡',
  'ghost': '👻',
  'alien': '👽',
  'robot': '🤖',
  'poop': '💩',

  // Gestes & Mains
  'thumbsup': '👍',
  '+1': '👍',
  'thumbsdown': '👎',
  '-1': '👎',
  'clap': '👏',
  'wave': '👋',
  'ok_hand': '👌',
  'peace': '✌️',
  'v': '✌️',
  'crossed_fingers': '🤞',
  'muscle': '💪',
  'pray': '🙏',
  'handshake': '🤝',
  'eyes': '👀',
  'point_up': '☝️',
  'point_down': '👇',
  'point_left': '👈',
  'point_right': '👉',

  // Foyer, Pause, Boissons & Snacks
  'coffee': '☕',
  'tea': '🍵',
  'croissant': '🥐',
  'baguette': '🥖',
  'cookie': '🍪',
  'chocolate': '🍫',
  'candy': '🍬',
  'lollipop': '🍭',
  'pizza': '🍕',
  'burger': '🍔',
  'fries': '🍟',
  'popcorn': '🍿',
  'cupcake': '🧁',
  'cake': '🍰',
  'donut': '🍩',
  'icecream': '🍦',
  'apple': '🍎',
  'soda': '🥤',
  'juice': '🧃',

  // Symboles & Caisse
  'euro': '💶',
  'money': '💰',
  'moneybag': '💰',
  'credit_card': '💳',
  'receipt': '🧾',
  'fire': '🔥',
  'sparkles': '✨',
  'star': '⭐',
  'star2': '🌟',
  'heart': '❤️',
  'red_heart': '❤️',
  'orange_heart': '🧡',
  'purple_heart': '💜',
  'broken_heart': '💔',
  'check': '✅',
  'white_check_mark': '✅',
  'cross': '❌',
  'x': '❌',
  'warning': '⚠️',
  'bulb': '💡',
  'bell': '🔔',
  'megaphone': '📢',
  'loudspeaker': '📢',
  'lock': '🔒',
  'key': '🔑',
  'shield': '🛡️',
  'rocket': '🚀',
  'tada': '🎉',
  'party': '🎉',
  'trophy': '🏆',
  'medal': '🥇',
  'crown': '👑',
  '100': '💯',
  'pin': '📌',
  'calendar': '📅',
  'chart': '📊',
  'package': '📦',
  'fast_forward': '⏩',
  'rewind': '⏪'
};

/**
 * Remplace les codes :emoji: (comme sur Reddit / Slack / Discord) par les vrais caractères Unicode.
 */
export function parseChatEmojis(text: string): string {
  if (!text) return '';
  return text.replace(/:([a-zA-Z0-9_+]+):/g, (match, code) => {
    const key = code.toLowerCase();
    return CHAT_EMOJIS[key] || match;
  });
}

/**
 * Rend un texte de message en HTML sécurisé supportant :
 * 1. La conversion des codes :emoji: en Unicode
 * 2. Le balisage Markdown (gras, italique, code, listes, citations) via marked
 * 3. La détection et le rendu direct des images Markdown ![alt](url) ou des URLs directes d'images
 * 4. La prévention des attaques XSS (neutralisation des balises <script>, <iframe>, etc.)
 */
export function formatChatMessage(content: string): string {
  if (!content) return '';

  // 1. Remplacement des emojis style Reddit :code:
  const withEmojis = parseChatEmojis(content);

  // 2. Traitement Markdown avec `marked`
  try {
    const rawHtml = marked.parse(withEmojis, { async: false }) as string;
    
    // Nettoyage et assainissement léger pour autoriser le formatage riche mais bloquer les XSS
    return sanitizeChatHtml(rawHtml);
  } catch {
    // Fallback de sécurité : échappement strict
    return escapeHtml(withEmojis);
  }
}

/**
 * Filtre le HTML généré par le parser Markdown pour sécuriser l'affichage
 * (autorise p, b, strong, i, em, u, s, code, pre, a, ul, ol, li, blockquote, img)
 */
function sanitizeChatHtml(html: string): string {
  // Retirer les balises dangereuses
  let safe = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
    .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '')
    .replace(/<link\b[^>]*>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/on\w+\s*=\s*(?:'[^']*'|"[^"]*"|[^\s>]+)/gi, ''); // Supprime onmouseover, onclick, onerror...

  // Sécuriser les liens <a> pour ouvrir dans un nouvel onglet sans accès window.opener
  safe = safe.replace(/<a\s+([^>]*?)href=(["'])(.*?)\2([^>]*?)>/gi, (_match, before, _quote, url, after) => {
    // Bloquer javascript: pseudo-protocol
    if (/^\s*javascript:/i.test(url)) {
      return `<span class="text-slate-400 underline cursor-not-allowed">`;
    }
    return `<a ${before} href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" class="text-orange-600 dark:text-orange-400 underline font-semibold hover:opacity-80" ${after}>`;
  });

  // Styliser les images <img> avec zoom au clic et coins arrondis
  safe = safe.replace(/<img\s+([^>]*?)src=(["'])(.*?)\2([^>]*?)>/gi, (_match, before, _quote, src, after) => {
    const safeSrc = src.startsWith('data:image/') || /^https?:\/\//i.test(src) || src.startsWith('/')
      ? escapeHtml(src)
      : '';
    if (!safeSrc) return '';
    return `<div class="my-2 max-w-sm overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-black/5 dark:bg-black/30 shadow-sm">
      <img ${before} src="${safeSrc}" class="max-h-64 w-auto rounded-xl object-contain cursor-pointer hover:opacity-95 transition-opacity" loading="lazy" onclick="window.OpenMDL?.previewImage?.('${safeSrc}')" ${after} />
    </div>`;
  });

  return safe;
}

/**
 * Optimise et compresse une image client-side (ex: photo prise par téléphone ou collée)
 * en Base64 JPEG/WebP de taille modérée (< 180 Ko) pour persistance et transmission instantanée en LAN
 */
export async function compressImageToDataUrl(file: File, maxWidth = 1000, quality = 0.75): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        // Format WebP si disponible, sinon JPEG
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
