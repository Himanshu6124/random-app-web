import { useEffect, useState, useCallback, useRef } from 'react';
import { socketService } from '../../services/socketService';
import { authService, BASE_URL, handleApiResponse, getAuthHeaders } from '../../services/authService';

/**
 * Instagram-style chat themes. A theme recolours the chat itself (feed background, your
 * bubbles, their bubbles, small accents) and scatters its own emoji motif over the feed;
 * the app chrome stays as it is.
 *
 * A theme belongs to the CONVERSATION, not to one person: when either of you picks one, the
 * server stores it (friend DMs) or relays it (random chats) and both chats switch to it.
 *
 * Each theme becomes a set of CSS custom properties on the chat screen, read by
 * .chat-feed / .chat-bubble / .typing-bubble (see styles/chat.css).
 * Gradient themes paint "my" bubbles with a gradient fixed to the viewport, so the bubble
 * colour shifts as it scrolls, like Instagram.
 */

// Where each emoji sits on the 168px pattern tile: [x, y, rotation, size, emoji index].
const SPOTS = [
  [20, 28, -14, 20, 0], [86, 18, 12, 15, 1], [140, 40, -8, 19, 2],
  [52, 72, 10, 16, 2], [118, 90, -12, 22, 0], [18, 116, 8, 17, 1],
  [70, 140, -6, 20, 0], [146, 148, 14, 15, 1]
];

/** A tiled SVG of the theme's emojis, as a CSS background image. */
function emojiPattern(emojis, opacity = 0.14) {
  const texts = SPOTS.map(([x, y, r, size, i]) =>
    `<text x="${x}" y="${y}" font-size="${size}" text-anchor="middle" dominant-baseline="central" transform="rotate(${r} ${x} ${y})">${emojis[i % emojis.length]}</text>`
  ).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="168" height="168" viewBox="0 0 168 168"><g opacity="${opacity}" font-family="Apple Color Emoji,Segoe UI Emoji,Noto Color Emoji,sans-serif">${texts}</g></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

function theme(id, name, icon, emojis, vars, patternOpacity) {
  return {
    id,
    name,
    icon,
    // The theme's own quick reaction (Instagram swaps the like button per theme).
    quickEmoji: emojis[0] || icon,
    vars: emojis.length ? { ...vars, '--ct-pattern': emojiPattern(emojis, patternOpacity) } : vars
  };
}

const gradientMe = (from, mid, to) => `linear-gradient(180deg, ${from} 0%, ${mid} 50%, ${to} 100%)`;

export const CHAT_THEMES = [
  theme('default', 'Classic', '💬', [], {}),
  theme('love', 'Love', '❤️', ['❤️', '💕', '💗'], {
    '--ct-feed-bg': 'radial-gradient(120% 70% at 100% 0%, rgba(255, 64, 129, 0.16), transparent 60%), radial-gradient(90% 60% at 0% 100%, rgba(193, 53, 132, 0.18), transparent 60%), #170c14',
    '--ct-me-bg': gradientMe('#ff6a95', '#e1306c', '#a8328f'),
    '--ct-me-border': 'transparent', '--ct-me-text': '#ffffff',
    '--ct-them-bg': '#2d1a28', '--ct-them-border': 'rgba(255, 106, 149, 0.18)',
    '--ct-accent': '#ff6a95', '--ct-attach': 'fixed'
  }),
  theme('ocean', 'Ocean', '🌊', ['🌊', '🐠', '🐚'], {
    '--ct-feed-bg': 'linear-gradient(180deg, #08182b 0%, #0c2236 100%)',
    '--ct-me-bg': gradientMe('#3ad0e0', '#3b8de8', '#4a5fe0'),
    '--ct-me-border': 'transparent', '--ct-me-text': '#ffffff',
    '--ct-them-bg': '#14293f', '--ct-them-border': 'rgba(58, 208, 224, 0.16)',
    '--ct-accent': '#5fd3ef', '--ct-attach': 'fixed'
  }),
  theme('sunset', 'Sunset', '🌅', ['🌅', '🌴', '☀️'], {
    '--ct-feed-bg': 'radial-gradient(110% 60% at 50% 0%, rgba(255, 140, 66, 0.14), transparent 65%), #1a0f0d',
    '--ct-me-bg': gradientMe('#ffb347', '#ff7a59', '#f2546f'),
    '--ct-me-border': 'transparent', '--ct-me-text': '#ffffff',
    '--ct-them-bg': '#2e1b17', '--ct-them-border': 'rgba(255, 150, 90, 0.18)',
    '--ct-accent': '#ffa25a', '--ct-attach': 'fixed'
  }),
  theme('lavender', 'Lavender', '💜', ['💜', '🦋', '🌸'], {
    '--ct-feed-bg': 'linear-gradient(180deg, #15111f 0%, #1c1630 100%)',
    '--ct-me-bg': gradientMe('#c3a6ff', '#9b7bf0', '#7457d9'),
    '--ct-me-border': 'transparent', '--ct-me-text': '#ffffff',
    '--ct-them-bg': '#251f38', '--ct-them-border': 'rgba(195, 166, 255, 0.18)',
    '--ct-accent': '#c3a6ff', '--ct-attach': 'fixed'
  }),
  theme('forest', 'Forest', '🌿', ['🌿', '🍃', '🌲'], {
    '--ct-feed-bg': 'linear-gradient(180deg, #0c1a12 0%, #10231a 100%)',
    '--ct-me-bg': gradientMe('#7bd88f', '#38a169', '#23795a'),
    '--ct-me-border': 'transparent', '--ct-me-text': '#ffffff',
    '--ct-them-bg': '#17291f', '--ct-them-border': 'rgba(123, 216, 143, 0.16)',
    '--ct-accent': '#7bd88f', '--ct-attach': 'fixed'
  }),
  theme('galaxy', 'Galaxy', '🪐', ['🪐', '✨', '🌙'], {
    '--ct-feed-bg': 'radial-gradient(80% 60% at 80% 10%, rgba(142, 45, 226, 0.25), transparent 70%), radial-gradient(70% 50% at 10% 90%, rgba(74, 0, 224, 0.25), transparent 70%), #0b0718',
    '--ct-me-bg': gradientMe('#b04cff', '#7a2ff0', '#4a1fd0'),
    '--ct-me-border': 'transparent', '--ct-me-text': '#ffffff',
    '--ct-them-bg': '#1e1836', '--ct-them-border': 'rgba(176, 76, 255, 0.2)',
    '--ct-accent': '#c084fc', '--ct-attach': 'fixed'
  }, 0.18),
  theme('aurora', 'Aurora', '🌌', ['🌌', '⭐', '❄️'], {
    '--ct-feed-bg': 'radial-gradient(90% 55% at 0% 0%, rgba(0, 201, 167, 0.16), transparent 65%), radial-gradient(90% 55% at 100% 100%, rgba(132, 94, 194, 0.2), transparent 65%), #0d1318',
    '--ct-me-bg': gradientMe('#00d2a8', '#3aa0c8', '#845ec2'),
    '--ct-me-border': 'transparent', '--ct-me-text': '#ffffff',
    '--ct-them-bg': '#1a242c', '--ct-them-border': 'rgba(0, 210, 168, 0.16)',
    '--ct-accent': '#2fe0bd', '--ct-attach': 'fixed'
  }),
  theme('candy', 'Candy', '🍭', ['🍭', '🍬', '🧁'], {
    '--ct-feed-bg': 'linear-gradient(180deg, #1c1018 0%, #22121e 100%)',
    '--ct-me-bg': gradientMe('#ffa8c5', '#ff7eb3', '#ff5c8a'),
    '--ct-me-border': 'transparent', '--ct-me-text': '#3a0718',
    '--ct-them-bg': '#2f1d2a', '--ct-them-border': 'rgba(255, 168, 197, 0.2)',
    '--ct-accent': '#ff9cc2', '--ct-attach': 'fixed'
  }),
  theme('pizza', 'Pizza', '🍕', ['🍕', '🍟', '🍔'], {
    '--ct-feed-bg': 'radial-gradient(100% 60% at 50% 0%, rgba(255, 176, 59, 0.12), transparent 65%), #1b120b',
    '--ct-me-bg': gradientMe('#ffcf4a', '#ff9a3c', '#e8552f'),
    '--ct-me-border': 'transparent', '--ct-me-text': '#2b1200',
    '--ct-them-bg': '#2f2016', '--ct-them-border': 'rgba(255, 176, 59, 0.18)',
    '--ct-accent': '#ffb347', '--ct-attach': 'fixed'
  }),
  theme('kitty', 'Kitty', '🐱', ['🐱', '🐾', '🧶'], {
    '--ct-feed-bg': 'linear-gradient(180deg, #1d1416 0%, #24181b 100%)',
    '--ct-me-bg': gradientMe('#ffd3b6', '#ffaaa5', '#ff8b94'),
    '--ct-me-border': 'transparent', '--ct-me-text': '#3a1214',
    '--ct-them-bg': '#33242a', '--ct-them-border': 'rgba(255, 170, 165, 0.2)',
    '--ct-accent': '#ffaaa5', '--ct-attach': 'fixed'
  }),
  theme('football', 'Football', '⚽', ['⚽', '🏆', '🥅'], {
    '--ct-feed-bg': 'repeating-linear-gradient(180deg, rgba(255,255,255,0.025) 0 48px, transparent 48px 96px), linear-gradient(180deg, #0b1d10 0%, #0f2715 100%)',
    '--ct-me-bg': gradientMe('#5fe08a', '#22b357', '#138a44'),
    '--ct-me-border': 'transparent', '--ct-me-text': '#ffffff',
    '--ct-them-bg': '#183022', '--ct-them-border': 'rgba(95, 224, 138, 0.18)',
    '--ct-accent': '#5fe08a', '--ct-attach': 'fixed'
  }),
  theme('music', 'Music', '🎧', ['🎧', '🎵', '🎸'], {
    '--ct-feed-bg': 'radial-gradient(80% 50% at 100% 0%, rgba(255, 0, 153, 0.16), transparent 65%), radial-gradient(80% 50% at 0% 100%, rgba(0, 178, 255, 0.16), transparent 65%), #0e0b16',
    '--ct-me-bg': gradientMe('#ff4ecd', '#a447ff', '#2f8cff'),
    '--ct-me-border': 'transparent', '--ct-me-text': '#ffffff',
    '--ct-them-bg': '#1f1a2e', '--ct-them-border': 'rgba(164, 71, 255, 0.2)',
    '--ct-accent': '#ff7ad9', '--ct-attach': 'fixed'
  }),
  theme('spooky', 'Spooky', '🎃', ['🎃', '👻', '🦇'], {
    '--ct-feed-bg': 'radial-gradient(90% 55% at 50% 100%, rgba(255, 117, 24, 0.14), transparent 65%), #120c14',
    '--ct-me-bg': gradientMe('#ff9a3c', '#ff6a1a', '#8a3ffc'),
    '--ct-me-border': 'transparent', '--ct-me-text': '#ffffff',
    '--ct-them-bg': '#251a29', '--ct-them-border': 'rgba(255, 154, 60, 0.18)',
    '--ct-accent': '#ff9a3c', '--ct-attach': 'fixed'
  }),
  theme('party', 'Party', '🎉', ['🎉', '🎈', '🥳'], {
    '--ct-feed-bg': 'radial-gradient(70% 45% at 0% 0%, rgba(255, 214, 0, 0.12), transparent 65%), radial-gradient(70% 45% at 100% 100%, rgba(255, 64, 160, 0.14), transparent 65%), #14101a',
    '--ct-me-bg': gradientMe('#ffd23f', '#ff6b9a', '#7b5cff'),
    '--ct-me-border': 'transparent', '--ct-me-text': '#ffffff',
    '--ct-them-bg': '#251f2e', '--ct-them-border': 'rgba(255, 210, 63, 0.18)',
    '--ct-accent': '#ffd23f', '--ct-attach': 'fixed'
  }),
  theme('coffee', 'Coffee', '☕', ['☕', '🥐', '🤎'], {
    '--ct-feed-bg': 'linear-gradient(180deg, #17110d 0%, #1e1611 100%)',
    '--ct-me-bg': gradientMe('#e6c29a', '#c08b5c', '#8a5a3b'),
    '--ct-me-border': 'transparent', '--ct-me-text': '#ffffff',
    '--ct-them-bg': '#2b211b', '--ct-them-border': 'rgba(230, 194, 154, 0.16)',
    '--ct-accent': '#e6c29a', '--ct-attach': 'fixed'
  }),
  theme('mono', 'Mono', '🖤', ['🖤', '◼️', '▫️'], {
    '--ct-feed-bg': '#0c0c0d',
    '--ct-me-bg': '#f2f2f2',
    '--ct-me-border': 'transparent', '--ct-me-text': '#111111',
    '--ct-them-bg': '#262628', '--ct-them-border': 'transparent',
    '--ct-accent': '#e6e6e6'
  }, 0.08)
];

const THEMES_BY_ID = new Map(CHAT_THEMES.map(t => [t.id, t]));
const CACHE_PREFIX = 'chatTheme:conv:';

export function getChatTheme(id) {
  return THEMES_BY_ID.get(id) || CHAT_THEMES[0];
}

function readCached(conversationId) {
  if (!conversationId) return 'default';
  try {
    const v = window.localStorage.getItem(CACHE_PREFIX + conversationId);
    return v && THEMES_BY_ID.has(v) ? v : 'default';
  } catch {
    return 'default';
  }
}

function writeCached(conversationId, id) {
  if (!conversationId) return;
  try {
    if (id === 'default') window.localStorage.removeItem(CACHE_PREFIX + conversationId);
    else window.localStorage.setItem(CACHE_PREFIX + conversationId, id);
  } catch { /* private mode: the server copy still applies on the next open */ }
}

async function fetchConversationTheme(conversationId) {
  const res = await fetch(`${BASE_URL}/conversations/${encodeURIComponent(conversationId)}/theme`, {
    headers: getAuthHeaders(authService.getToken())
  });
  const data = await handleApiResponse(res);
  return data?.themeId;
}

/**
 * The SHARED theme of one chat. Both people see the same theme: picking one sends it to the
 * server, which stores it (friend DMs, `persisted`) or just relays it (random rooms), and the
 * CHAT_THEME event switches the other person's chat too.
 *
 * `onRemoteChange(themeId, changedBy)` fires for every theme event of this chat (yours echoed
 * back included), e.g. to drop a "X changed the theme" line into the feed.
 * Returns [theme, setThemeId]; setThemeId returns false when it could not be sent.
 */
export function useChatTheme(conversationId, { persisted = false, onRemoteChange } = {}) {
  const [id, setId] = useState(() => readCached(conversationId));
  const onRemoteChangeRef = useRef(onRemoteChange);
  onRemoteChangeRef.current = onRemoteChange;

  useEffect(() => {
    // A random room is new every time: it always starts on the classic look.
    setId(persisted ? readCached(conversationId) : 'default');
    if (!conversationId) return undefined;

    let alive = true;
    if (persisted) {
      fetchConversationTheme(conversationId)
        .then(themeId => {
          if (!alive || !themeId) return;
          const next = THEMES_BY_ID.has(themeId) ? themeId : 'default';
          writeCached(conversationId, next);
          setId(next);
        })
        .catch(() => { /* offline: keep the cached theme */ });
    }

    const off = socketService.addRoomListener(conversationId, {
      onChatTheme: (payload) => {
        if (!payload || (payload.conversationId && payload.conversationId !== conversationId)) return;
        const next = THEMES_BY_ID.has(payload.themeId) ? payload.themeId : 'default';
        if (persisted) writeCached(conversationId, next);
        setId(next);
        onRemoteChangeRef.current?.(next, payload.changedBy);
      }
    });
    return () => { alive = false; off(); };
  }, [conversationId, persisted]);

  const setTheme = useCallback((nextId) => {
    if (!conversationId || !THEMES_BY_ID.has(nextId)) return false;
    const sent = socketService.sendChatTheme(conversationId, nextId);
    if (!sent) return false;
    // Applied right away; the server echo confirms it for both people.
    setId(nextId);
    if (persisted) writeCached(conversationId, nextId);
    return true;
  }, [conversationId, persisted]);

  return [getChatTheme(id), setTheme];
}
