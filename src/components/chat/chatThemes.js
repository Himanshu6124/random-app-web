import { useEffect, useState, useCallback } from 'react';

/**
 * Instagram-style chat themes. A theme only recolours the chat itself (feed background,
 * your bubbles, their bubbles, small accents); the app chrome stays as it is.
 *
 * Each theme becomes a set of CSS custom properties on the chat screen, read by
 * .chat-feed / .chat-bubble / .typing-bubble (see styles/chatTheme.css).
 * Gradient themes paint "my" bubbles with a gradient fixed to the viewport, so the bubble
 * colour shifts as it scrolls, like Instagram.
 */
export const CHAT_THEMES = [
  {
    id: 'default',
    name: 'Classic',
    vars: {}
  },
  {
    id: 'love',
    name: 'Love',
    vars: {
      '--ct-feed-bg': 'radial-gradient(120% 70% at 100% 0%, rgba(255, 64, 129, 0.16), transparent 60%), radial-gradient(90% 60% at 0% 100%, rgba(193, 53, 132, 0.18), transparent 60%), #170c14',
      '--ct-me-bg': 'linear-gradient(180deg, #ff6a95 0%, #e1306c 45%, #a8328f 100%)',
      '--ct-me-border': 'transparent',
      '--ct-me-text': '#ffffff',
      '--ct-them-bg': '#2d1a28',
      '--ct-them-border': 'rgba(255, 106, 149, 0.18)',
      '--ct-accent': '#ff6a95',
      '--ct-attach': 'fixed'
    }
  },
  {
    id: 'ocean',
    name: 'Ocean',
    vars: {
      '--ct-feed-bg': 'linear-gradient(180deg, #08182b 0%, #0c2236 100%)',
      '--ct-me-bg': 'linear-gradient(180deg, #3ad0e0 0%, #3b8de8 55%, #4a5fe0 100%)',
      '--ct-me-border': 'transparent',
      '--ct-me-text': '#ffffff',
      '--ct-them-bg': '#14293f',
      '--ct-them-border': 'rgba(58, 208, 224, 0.16)',
      '--ct-accent': '#5fd3ef',
      '--ct-attach': 'fixed'
    }
  },
  {
    id: 'sunset',
    name: 'Sunset',
    vars: {
      '--ct-feed-bg': 'radial-gradient(110% 60% at 50% 0%, rgba(255, 140, 66, 0.14), transparent 65%), #1a0f0d',
      '--ct-me-bg': 'linear-gradient(180deg, #ffb347 0%, #ff7a59 50%, #f2546f 100%)',
      '--ct-me-border': 'transparent',
      '--ct-me-text': '#ffffff',
      '--ct-them-bg': '#2e1b17',
      '--ct-them-border': 'rgba(255, 150, 90, 0.18)',
      '--ct-accent': '#ffa25a',
      '--ct-attach': 'fixed'
    }
  },
  {
    id: 'lavender',
    name: 'Lavender',
    vars: {
      '--ct-feed-bg': 'linear-gradient(180deg, #15111f 0%, #1c1630 100%)',
      '--ct-me-bg': 'linear-gradient(180deg, #c3a6ff 0%, #9b7bf0 50%, #7457d9 100%)',
      '--ct-me-border': 'transparent',
      '--ct-me-text': '#ffffff',
      '--ct-them-bg': '#251f38',
      '--ct-them-border': 'rgba(195, 166, 255, 0.18)',
      '--ct-accent': '#c3a6ff',
      '--ct-attach': 'fixed'
    }
  },
  {
    id: 'forest',
    name: 'Forest',
    vars: {
      '--ct-feed-bg': 'linear-gradient(180deg, #0c1a12 0%, #10231a 100%)',
      '--ct-me-bg': 'linear-gradient(180deg, #7bd88f 0%, #38a169 55%, #23795a 100%)',
      '--ct-me-border': 'transparent',
      '--ct-me-text': '#ffffff',
      '--ct-them-bg': '#17291f',
      '--ct-them-border': 'rgba(123, 216, 143, 0.16)',
      '--ct-accent': '#7bd88f',
      '--ct-attach': 'fixed'
    }
  },
  {
    id: 'galaxy',
    name: 'Galaxy',
    vars: {
      '--ct-feed-bg': 'radial-gradient(1px 1px at 20% 30%, rgba(255,255,255,0.55), transparent 60%), radial-gradient(1px 1px at 70% 15%, rgba(255,255,255,0.45), transparent 60%), radial-gradient(1.5px 1.5px at 85% 60%, rgba(255,255,255,0.4), transparent 60%), radial-gradient(1px 1px at 35% 80%, rgba(255,255,255,0.35), transparent 60%), radial-gradient(80% 60% at 80% 10%, rgba(142, 45, 226, 0.25), transparent 70%), radial-gradient(70% 50% at 10% 90%, rgba(74, 0, 224, 0.25), transparent 70%), #0b0718',
      '--ct-me-bg': 'linear-gradient(180deg, #b04cff 0%, #7a2ff0 50%, #4a1fd0 100%)',
      '--ct-me-border': 'transparent',
      '--ct-me-text': '#ffffff',
      '--ct-them-bg': '#1e1836',
      '--ct-them-border': 'rgba(176, 76, 255, 0.2)',
      '--ct-accent': '#c084fc',
      '--ct-attach': 'fixed'
    }
  },
  {
    id: 'aurora',
    name: 'Aurora',
    vars: {
      '--ct-feed-bg': 'radial-gradient(90% 55% at 0% 0%, rgba(0, 201, 167, 0.16), transparent 65%), radial-gradient(90% 55% at 100% 100%, rgba(132, 94, 194, 0.2), transparent 65%), #0d1318',
      '--ct-me-bg': 'linear-gradient(180deg, #00d2a8 0%, #3aa0c8 50%, #845ec2 100%)',
      '--ct-me-border': 'transparent',
      '--ct-me-text': '#ffffff',
      '--ct-them-bg': '#1a242c',
      '--ct-them-border': 'rgba(0, 210, 168, 0.16)',
      '--ct-accent': '#2fe0bd',
      '--ct-attach': 'fixed'
    }
  },
  {
    id: 'candy',
    name: 'Candy',
    vars: {
      '--ct-feed-bg': 'linear-gradient(180deg, #1c1018 0%, #22121e 100%)',
      '--ct-me-bg': 'linear-gradient(180deg, #ffa8c5 0%, #ff7eb3 50%, #ff5c8a 100%)',
      '--ct-me-border': 'transparent',
      '--ct-me-text': '#3a0718',
      '--ct-them-bg': '#2f1d2a',
      '--ct-them-border': 'rgba(255, 168, 197, 0.2)',
      '--ct-accent': '#ff9cc2',
      '--ct-attach': 'fixed'
    }
  },
  {
    id: 'mono',
    name: 'Mono',
    vars: {
      '--ct-feed-bg': '#0c0c0d',
      '--ct-me-bg': '#f2f2f2',
      '--ct-me-border': 'transparent',
      '--ct-me-text': '#111111',
      '--ct-them-bg': '#262628',
      '--ct-them-border': 'transparent',
      '--ct-accent': '#e6e6e6'
    }
  }
];

const THEMES_BY_ID = new Map(CHAT_THEMES.map(t => [t.id, t]));
const STORAGE_PREFIX = 'chatTheme:';
const listeners = new Set();

function readTheme(key) {
  if (!key) return 'default';
  try {
    const v = window.localStorage.getItem(STORAGE_PREFIX + key);
    return v && THEMES_BY_ID.has(v) ? v : 'default';
  } catch {
    return 'default';
  }
}

export function getChatTheme(id) {
  return THEMES_BY_ID.get(id) || CHAT_THEMES[0];
}

/**
 * The theme chosen for one chat. `key` is 'random' for the random chat, and
 * 'dm:<conversationId>' for a friend DM, so every friend chat keeps its own theme.
 * Returns [theme, setThemeId].
 */
export function useChatTheme(key) {
  const [id, setId] = useState(() => readTheme(key));

  useEffect(() => {
    setId(readTheme(key));
    const onChange = (changedKey) => { if (changedKey === key) setId(readTheme(key)); };
    listeners.add(onChange);
    return () => listeners.delete(onChange);
  }, [key]);

  const setTheme = useCallback((nextId) => {
    if (!key) return;
    try {
      if (nextId === 'default') window.localStorage.removeItem(STORAGE_PREFIX + key);
      else window.localStorage.setItem(STORAGE_PREFIX + key, nextId);
    } catch { /* private mode: theme just won't persist */ }
    setId(nextId);
    listeners.forEach(fn => fn(key));
  }, [key]);

  return [getChatTheme(id), setTheme];
}
