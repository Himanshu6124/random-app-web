import { useEffect, useState, useCallback, useRef } from 'react';
import { socketService } from '../../services/socketService';
import { authService, BASE_URL, handleApiResponse, getAuthHeaders } from '../../services/authService';

/**
 * Chat themes. A theme restyles the chat itself: a slowly drifting aurora of colour behind the
 * feed (see .ct-backdrop), a fine pattern with film grain over it, gradient "me" bubbles that
 * glow, and tinted glass-like "them" bubbles. The app chrome stays as it is.
 *
 * A theme belongs to the CONVERSATION, not to one person: when either of you picks one, the
 * server stores it (friend DMs) or relays it (random chats) and both chats switch to it.
 *
 * Each theme becomes a set of CSS custom properties on the chat screen, read by .ct-backdrop,
 * .chat-bubble and .typing-bubble (see styles/chat.css). "Me" bubbles use a gradient fixed to
 * the viewport, so the colour shifts as they scroll, like Instagram.
 */

const svgUrl = (svg) => `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
const tile = (size, body) => svgUrl(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${body}</svg>`
);

/** Fine patterns, drawn in white; the theme sets how strongly they show. */
const PATTERNS = {
  dots: [tile(22, '<circle cx="11" cy="11" r="1.2" fill="#fff"/>'), '22px'],
  grid: [tile(32, '<path d="M32 0H0V32" fill="none" stroke="#fff" stroke-width="0.6"/>'), '32px'],
  waves: [tile(120, '<path d="M0 30 Q30 14 60 30 T120 30 M0 70 Q30 54 60 70 T120 70 M0 110 Q30 94 60 110 T120 110" fill="none" stroke="#fff" stroke-width="1"/>'), '120px'],
  stars: [tile(160, [
    [12, 20, 1.2], [58, 8, 0.8], [96, 34, 1.6], [140, 16, 0.9], [30, 70, 0.7], [78, 92, 1.1],
    [124, 76, 0.8], [150, 120, 1.4], [16, 128, 1], [60, 146, 0.7], [104, 132, 0.9], [44, 106, 1.5]
  ].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff"/>`).join('')
    + '<path d="M96 30v8M92 34h8M150 116v8M146 120h8" stroke="#fff" stroke-width="0.8" stroke-linecap="round"/>'), '160px'],
  sparkles: [tile(140, [[24, 30, 7], [100, 22, 4], [70, 78, 9], [20, 112, 4], [120, 110, 6]].map(([x, y, r]) =>
    `<path d="M${x} ${y - r}C${x + r * 0.15} ${y - r * 0.15} ${x + r * 0.15} ${y - r * 0.15} ${x + r} ${y}C${x + r * 0.15} ${y + r * 0.15} ${x + r * 0.15} ${y + r * 0.15} ${x} ${y + r}C${x - r * 0.15} ${y + r * 0.15} ${x - r * 0.15} ${y + r * 0.15} ${x - r} ${y}C${x - r * 0.15} ${y - r * 0.15} ${x - r * 0.15} ${y - r * 0.15} ${x} ${y - r}Z" fill="#fff"/>`
  ).join('')), '140px'],
  hearts: [tile(120, [[26, 28, 1], [88, 20, 0.7], [62, 72, 1.2], [18, 98, 0.75], [104, 96, 0.9]].map(([x, y, k]) =>
    `<path transform="translate(${x} ${y}) scale(${k})" d="M0 4C-2-2-10-1-8 6-6 10 0 14 0 14S6 10 8 6C10-1 2-2 0 4Z" fill="none" stroke="#fff" stroke-width="1.2" stroke-linejoin="round"/>`
  ).join('')), '120px'],
  confetti: [tile(150, [
    [18, 22, 20, '#ffd23f'], [70, 14, -30, '#ff6b9a'], [124, 30, 45, '#7b5cff'], [40, 74, -15, '#3ee0c4'],
    [100, 80, 60, '#ffd23f'], [20, 126, 30, '#7b5cff'], [76, 130, -40, '#ff6b9a'], [132, 118, 10, '#3ee0c4']
  ].map(([x, y, r, c]) => `<rect x="${x - 5}" y="${y - 2}" width="10" height="4" rx="2" fill="${c}" transform="rotate(${r} ${x} ${y})"/>`).join('')), '150px']
};

// Where each emoji sits on the 168px tile: [x, y, rotation, size, emoji index].
const SPOTS = [
  [20, 28, -14, 20, 0], [86, 18, 12, 15, 1], [140, 40, -8, 19, 2],
  [52, 72, 10, 16, 2], [118, 90, -12, 22, 0], [18, 116, 8, 17, 1],
  [70, 140, -6, 20, 0], [146, 148, 14, 15, 1]
];

/** A tiled emoji motif (the "Fun" themes keep their emojis, over the new aurora look). */
function emojiPattern(emojis) {
  const texts = SPOTS.map(([x, y, r, size, i]) =>
    `<text x="${x}" y="${y}" font-size="${size}" text-anchor="middle" dominant-baseline="central" transform="rotate(${r} ${x} ${y})">${emojis[i % emojis.length]}</text>`
  ).join('');
  return [tile(168, `<g font-family="Apple Color Emoji,Segoe UI Emoji,Noto Color Emoji,sans-serif">${texts}</g>`), '168px'];
}

/** Film grain over every theme: keeps big gradients from banding and looks less flat. */
const GRAIN = svgUrl('<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.55 0"/></filter><rect width="160" height="160" filter="url(#n)"/></svg>');

const gradientMe = (...stops) => `linear-gradient(160deg, ${stops.join(', ')})`;

/**
 * id: stored per conversation (keep stable). icon: shown in "X changed the theme" lines.
 * quick: the theme's quick reaction. group: picker section.
 */
function theme({ id, name, icon, quick, group, base, blobs = [], pattern, patternOpacity = 0.06, me, meText = '#ffffff', meGlow, them, themBorder, themText, accent, still = false }) {
  const vars = {
    '--ct-feed-bg': base,
    '--ct-me-bg': me,
    '--ct-me-text': meText,
    '--ct-me-border': 'transparent',
    '--ct-me-glow': meGlow || 'transparent',
    '--ct-them-bg': them,
    '--ct-them-border': themBorder,
    '--ct-accent': accent,
    '--ct-attach': 'fixed',
    '--ct-grain': GRAIN
  };
  blobs.forEach((c, i) => { vars[`--ct-blob-${i + 1}`] = c; });
  if (themText) vars['--ct-them-text'] = themText;
  if (pattern) {
    const [img, size] = Array.isArray(pattern) ? emojiPattern(pattern) : PATTERNS[pattern];
    vars['--ct-pattern'] = img;
    vars['--ct-pattern-size'] = size;
    vars['--ct-pattern-opacity'] = String(patternOpacity);
  }
  return { id, name, icon, quickEmoji: quick || icon, group, still, vars };
}

export const THEME_GROUPS = ['Aurora', 'Fun', 'Vibes'];

export const CHAT_THEMES = [
  { id: 'default', name: 'Classic', icon: '💬', quickEmoji: '💬', group: null, still: true, vars: {} },

  theme({
    id: 'aurora', name: 'Aurora', icon: '🌌', quick: '✨', group: 'Aurora',
    base: 'linear-gradient(180deg, #061217 0%, #0a1220 100%)',
    blobs: ['rgba(0, 224, 176, 0.42)', 'rgba(123, 92, 255, 0.40)', 'rgba(0, 163, 255, 0.32)'],
    pattern: 'stars', patternOpacity: 0.16,
    me: gradientMe('#2ee6b8', '#3a8ee8 55%', '#7b5cff'), meGlow: 'rgba(46, 230, 184, 0.45)',
    them: 'rgba(170, 255, 240, 0.09)', themBorder: 'rgba(170, 255, 240, 0.14)', accent: '#3ff0c8'
  }),
  theme({
    id: 'sunset', name: 'Golden Hour', icon: '🌅', quick: '🧡', group: 'Aurora',
    base: 'linear-gradient(180deg, #170b0b 0%, #1d0c14 100%)',
    blobs: ['rgba(255, 122, 61, 0.45)', 'rgba(255, 61, 119, 0.38)', 'rgba(255, 193, 69, 0.30)'],
    me: gradientMe('#ffc15e', '#ff7a5c 50%', '#e8457a'), meGlow: 'rgba(255, 122, 92, 0.45)',
    them: 'rgba(255, 214, 190, 0.10)', themBorder: 'rgba(255, 190, 150, 0.15)', accent: '#ffa25a'
  }),
  theme({
    id: 'love', name: 'Crush', icon: '💗', quick: '❤️', group: 'Aurora',
    base: 'linear-gradient(180deg, #14070e 0%, #1a0816 100%)',
    blobs: ['rgba(255, 45, 122, 0.42)', 'rgba(181, 23, 158, 0.40)', 'rgba(255, 106, 149, 0.30)'],
    pattern: 'hearts', patternOpacity: 0.08,
    me: gradientMe('#ff7aa2', '#e1306c 50%', '#a8328f'), meGlow: 'rgba(225, 48, 108, 0.5)',
    them: 'rgba(255, 190, 215, 0.10)', themBorder: 'rgba(255, 150, 190, 0.16)', accent: '#ff6a95'
  }),
  theme({
    id: 'ocean', name: 'Deep Sea', icon: '🌊', quick: '🌊', group: 'Aurora',
    base: 'linear-gradient(180deg, #030d1c 0%, #04172b 100%)',
    blobs: ['rgba(0, 119, 255, 0.45)', 'rgba(0, 198, 255, 0.32)', 'rgba(43, 45, 255, 0.34)'],
    pattern: 'waves', patternOpacity: 0.07,
    me: gradientMe('#3ad0e0', '#3b8de8 50%', '#4a5fe0'), meGlow: 'rgba(59, 141, 232, 0.5)',
    them: 'rgba(160, 220, 255, 0.10)', themBorder: 'rgba(120, 200, 255, 0.15)', accent: '#5fd3ef'
  }),
  theme({
    id: 'galaxy', name: 'Nebula', icon: '🪐', quick: '🪐', group: 'Aurora',
    base: 'linear-gradient(180deg, #06031a 0%, #0b0522 100%)',
    blobs: ['rgba(142, 45, 226, 0.48)', 'rgba(74, 0, 224, 0.40)', 'rgba(255, 78, 205, 0.28)'],
    pattern: 'stars', patternOpacity: 0.22,
    me: gradientMe('#c06bff', '#7a2ff0 50%', '#4a1fd0'), meGlow: 'rgba(160, 80, 255, 0.5)',
    them: 'rgba(210, 180, 255, 0.10)', themBorder: 'rgba(190, 150, 255, 0.16)', accent: '#c084fc'
  }),
  theme({
    id: 'lavender', name: 'Lilac Haze', icon: '💜', quick: '💜', group: 'Aurora',
    base: 'linear-gradient(180deg, #100c1b 0%, #160f24 100%)',
    blobs: ['rgba(182, 156, 255, 0.40)', 'rgba(255, 154, 213, 0.30)', 'rgba(122, 139, 255, 0.32)'],
    pattern: 'dots', patternOpacity: 0.07,
    me: gradientMe('#e0c8ff', '#a98bff 50%', '#7c63f0'), meText: '#1b0f35', meGlow: 'rgba(169, 139, 255, 0.45)',
    them: 'rgba(225, 210, 255, 0.10)', themBorder: 'rgba(210, 190, 255, 0.16)', accent: '#c3a6ff'
  }),
  theme({
    id: 'forest', name: 'Matcha', icon: '🍵', quick: '🌿', group: 'Aurora',
    base: 'linear-gradient(180deg, #06130c 0%, #0a1912 100%)',
    blobs: ['rgba(47, 191, 113, 0.40)', 'rgba(163, 217, 119, 0.26)', 'rgba(15, 118, 110, 0.40)'],
    pattern: 'dots', patternOpacity: 0.06,
    me: gradientMe('#b5ea6c', '#3fb27f 50%', '#138a6b'), meGlow: 'rgba(63, 178, 127, 0.45)',
    them: 'rgba(200, 255, 220, 0.09)', themBorder: 'rgba(160, 240, 190, 0.14)', accent: '#7bd88f'
  }),
  theme({
    id: 'candy', name: 'Cotton Candy', icon: '🍭', quick: '🍭', group: 'Aurora',
    base: 'linear-gradient(180deg, #160f1e 0%, #1a1124 100%)',
    blobs: ['rgba(255, 158, 207, 0.40)', 'rgba(143, 211, 255, 0.36)', 'rgba(201, 167, 255, 0.34)'],
    pattern: 'sparkles', patternOpacity: 0.09,
    me: gradientMe('#ffb8dc', '#d2b2ff 50%', '#93d6ff'), meText: '#2a1030', meGlow: 'rgba(255, 170, 220, 0.45)',
    them: 'rgba(255, 220, 240, 0.10)', themBorder: 'rgba(255, 200, 230, 0.16)', accent: '#ff9cc2'
  }),

  theme({
    id: 'pizza', name: 'Pizza', icon: '🍕', quick: '🍕', group: 'Fun',
    base: 'linear-gradient(180deg, #1b120b 0%, #20140c 100%)',
    blobs: ['rgba(255, 176, 59, 0.34)', 'rgba(232, 85, 47, 0.32)', 'rgba(255, 207, 74, 0.22)'],
    pattern: ['🍕', '🍟', '🍔'], patternOpacity: 0.16,
    me: gradientMe('#ffcf4a', '#ff9a3c 50%', '#e8552f'), meText: '#2b1200', meGlow: 'rgba(255, 154, 60, 0.45)',
    them: 'rgba(255, 220, 180, 0.10)', themBorder: 'rgba(255, 176, 59, 0.18)', accent: '#ffb347'
  }),
  theme({
    id: 'kitty', name: 'Kitty', icon: '🐱', quick: '🐾', group: 'Fun',
    base: 'linear-gradient(180deg, #1d1416 0%, #24181b 100%)',
    blobs: ['rgba(255, 170, 165, 0.32)', 'rgba(255, 211, 182, 0.24)', 'rgba(255, 139, 148, 0.28)'],
    pattern: ['🐱', '🐾', '🧶'], patternOpacity: 0.16,
    me: gradientMe('#ffd3b6', '#ffaaa5 50%', '#ff8b94'), meText: '#3a1214', meGlow: 'rgba(255, 139, 148, 0.4)',
    them: 'rgba(255, 220, 215, 0.10)', themBorder: 'rgba(255, 170, 165, 0.2)', accent: '#ffaaa5'
  }),
  theme({
    id: 'football', name: 'Football', icon: '⚽', quick: '⚽', group: 'Fun',
    base: 'repeating-linear-gradient(180deg, rgba(255,255,255,0.025) 0 48px, transparent 48px 96px), linear-gradient(180deg, #0b1d10 0%, #0f2715 100%)',
    blobs: ['rgba(34, 179, 87, 0.36)', 'rgba(95, 224, 138, 0.22)', 'rgba(19, 138, 68, 0.36)'],
    pattern: ['⚽', '🏆', '🥅'], patternOpacity: 0.16,
    me: gradientMe('#5fe08a', '#22b357 50%', '#138a44'), meGlow: 'rgba(34, 179, 87, 0.45)',
    them: 'rgba(200, 255, 215, 0.09)', themBorder: 'rgba(95, 224, 138, 0.18)', accent: '#5fe08a'
  }),
  theme({
    id: 'music', name: 'Music', icon: '🎵', quick: '🎵', group: 'Fun',
    base: 'linear-gradient(180deg, #0e0b16 0%, #120d1d 100%)',
    blobs: ['rgba(255, 0, 153, 0.28)', 'rgba(0, 178, 255, 0.26)', 'rgba(164, 71, 255, 0.30)'],
    pattern: ['🎧', '🎵', '🎸'], patternOpacity: 0.16,
    me: gradientMe('#ff4ecd', '#a447ff 50%', '#2f8cff'), meGlow: 'rgba(164, 71, 255, 0.5)',
    them: 'rgba(225, 210, 255, 0.09)', themBorder: 'rgba(164, 71, 255, 0.2)', accent: '#ff7ad9'
  }),
  theme({
    id: 'spooky', name: 'Spooky', icon: '🎃', quick: '👻', group: 'Fun',
    base: 'linear-gradient(180deg, #120c14 0%, #160e18 100%)',
    blobs: ['rgba(255, 117, 24, 0.32)', 'rgba(138, 63, 252, 0.30)', 'rgba(255, 154, 60, 0.18)'],
    pattern: ['🎃', '👻', '🦇'], patternOpacity: 0.16,
    me: gradientMe('#ff9a3c', '#ff6a1a 50%', '#8a3ffc'), meGlow: 'rgba(255, 106, 26, 0.45)',
    them: 'rgba(255, 220, 200, 0.09)', themBorder: 'rgba(255, 154, 60, 0.18)', accent: '#ff9a3c'
  }),
  theme({
    id: 'coffee', name: 'Coffee', icon: '☕', quick: '☕', group: 'Fun',
    base: 'linear-gradient(180deg, #17110d 0%, #1e1611 100%)',
    blobs: ['rgba(192, 139, 92, 0.30)', 'rgba(230, 194, 154, 0.20)', 'rgba(138, 90, 59, 0.32)'],
    pattern: ['☕', '🥐', '🤎'], patternOpacity: 0.16,
    me: gradientMe('#e6c29a', '#c08b5c 50%', '#8a5a3b'), meGlow: 'rgba(192, 139, 92, 0.4)',
    them: 'rgba(255, 230, 205, 0.09)', themBorder: 'rgba(230, 194, 154, 0.16)', accent: '#e6c29a'
  }),

  theme({
    id: 'neon', name: 'Cyber Neon', icon: '🌃', quick: '⚡', group: 'Vibes',
    base: 'linear-gradient(180deg, #05030d 0%, #090418 100%)',
    blobs: ['rgba(255, 0, 200, 0.32)', 'rgba(0, 240, 255, 0.26)', 'rgba(90, 40, 255, 0.30)'],
    pattern: 'grid', patternOpacity: 0.07,
    me: gradientMe('#ff2bd6', '#7a3cff 50%', '#00d5ff'), meGlow: 'rgba(255, 43, 214, 0.55)',
    them: 'rgba(0, 240, 255, 0.08)', themBorder: 'rgba(0, 240, 255, 0.32)', accent: '#00f0ff'
  }),
  theme({
    id: 'midnight', name: 'Midnight Gold', icon: '🌙', quick: '🌙', group: 'Vibes',
    base: 'linear-gradient(180deg, #060912 0%, #0a0f1f 100%)',
    blobs: ['rgba(30, 58, 138, 0.55)', 'rgba(15, 23, 42, 0.6)', 'rgba(212, 160, 23, 0.20)'],
    pattern: 'stars', patternOpacity: 0.14,
    me: gradientMe('#f9e08b', '#e0a43a 50%', '#b7791f'), meText: '#241500', meGlow: 'rgba(224, 164, 58, 0.45)',
    them: 'rgba(200, 215, 255, 0.08)', themBorder: 'rgba(249, 224, 139, 0.18)', accent: '#f2c94c'
  }),
  theme({
    id: 'lofi', name: 'Lo-fi', icon: '🎧', quick: '🎧', group: 'Vibes',
    base: 'linear-gradient(180deg, #19110d 0%, #1f1512 100%)',
    blobs: ['rgba(255, 158, 122, 0.30)', 'rgba(201, 123, 99, 0.30)', 'rgba(140, 100, 80, 0.32)'],
    pattern: 'dots', patternOpacity: 0.05,
    me: gradientMe('#ffd3a5', '#f49a7b 50%', '#d9707a'), meText: '#2b1208', meGlow: 'rgba(244, 154, 123, 0.4)',
    them: 'rgba(255, 225, 200, 0.09)', themBorder: 'rgba(255, 210, 180, 0.14)', accent: '#ffb38a'
  }),
  theme({
    id: 'citrus', name: 'Citrus Pop', icon: '🍋', quick: '🍋', group: 'Vibes',
    base: 'linear-gradient(180deg, #0c1006 0%, #11160a 100%)',
    blobs: ['rgba(212, 255, 61, 0.26)', 'rgba(255, 179, 0, 0.26)', 'rgba(52, 211, 153, 0.22)'],
    pattern: 'dots', patternOpacity: 0.06,
    me: gradientMe('#f0ff6a', '#a3e635 50%', '#22c55e'), meText: '#102000', meGlow: 'rgba(163, 230, 53, 0.4)',
    them: 'rgba(240, 255, 200, 0.09)', themBorder: 'rgba(220, 255, 140, 0.15)', accent: '#c6f432'
  }),
  theme({
    id: 'holo', name: 'Holographic', icon: '🫧', quick: '🫧', group: 'Vibes',
    base: 'linear-gradient(180deg, #0b0b12 0%, #10101a 100%)',
    blobs: ['rgba(255, 157, 226, 0.32)', 'rgba(157, 226, 255, 0.32)', 'rgba(195, 255, 157, 0.24)'],
    pattern: 'sparkles', patternOpacity: 0.08,
    me: 'linear-gradient(125deg, #ffa8e4 0%, #c9a7ff 33%, #9de2ff 66%, #c8ffa8 100%)', meText: '#1a1030', meGlow: 'rgba(200, 170, 255, 0.45)',
    them: 'rgba(230, 230, 255, 0.10)', themBorder: 'rgba(220, 220, 255, 0.18)', accent: '#b8a6ff'
  }),
  theme({
    id: 'party', name: 'Confetti', icon: '🎉', quick: '🎉', group: 'Vibes',
    base: 'linear-gradient(180deg, #110c17 0%, #160f1f 100%)',
    blobs: ['rgba(255, 210, 63, 0.24)', 'rgba(255, 107, 154, 0.30)', 'rgba(123, 92, 255, 0.32)'],
    pattern: 'confetti', patternOpacity: 0.22,
    me: gradientMe('#ffd23f', '#ff6b9a 50%', '#7b5cff'), meGlow: 'rgba(255, 107, 154, 0.45)',
    them: 'rgba(255, 240, 220, 0.09)', themBorder: 'rgba(255, 210, 63, 0.18)', accent: '#ffd23f'
  }),
  theme({
    id: 'mono', name: 'Noir', icon: '🖤', quick: '🖤', group: 'Vibes', still: true,
    base: 'linear-gradient(180deg, #0a0a0b 0%, #111113 100%)',
    blobs: ['rgba(255, 255, 255, 0.05)', 'rgba(255, 255, 255, 0.03)', 'rgba(255, 255, 255, 0.04)'],
    pattern: 'grid', patternOpacity: 0.035,
    me: '#f4f4f5', meText: '#111111', meGlow: 'rgba(255, 255, 255, 0.15)',
    them: '#1f1f22', themBorder: 'rgba(255, 255, 255, 0.06)', accent: '#e6e6e6'
  })
];

/** Every earlier theme id still exists, so stored themes keep working as they are. */
const normalizeId = (id) => id;

const THEMES_BY_ID = new Map(CHAT_THEMES.map(t => [t.id, t]));
const CACHE_PREFIX = 'chatTheme:conv:';

export function getChatTheme(id) {
  return THEMES_BY_ID.get(normalizeId(id)) || CHAT_THEMES[0];
}

function readCached(conversationId) {
  if (!conversationId) return 'default';
  try {
    const v = normalizeId(window.localStorage.getItem(CACHE_PREFIX + conversationId));
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
          const next = THEMES_BY_ID.has(normalizeId(themeId)) ? normalizeId(themeId) : 'default';
          writeCached(conversationId, next);
          setId(next);
        })
        .catch(() => { /* offline: keep the cached theme */ });
    }

    const off = socketService.addRoomListener(conversationId, {
      onChatTheme: (payload) => {
        if (!payload || (payload.conversationId && payload.conversationId !== conversationId)) return;
        const id = normalizeId(payload.themeId);
        const next = THEMES_BY_ID.has(id) ? id : 'default';
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
