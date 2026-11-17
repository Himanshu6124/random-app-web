/**
 * First-party product analytics: page/screen views, time on screen, button clicks and a few product
 * events (search, match, message...). Sent in small batches to POST /public/analytics/collect.
 *
 * Never sends message text, typed input or IP-level data. Cheap by design: clicks are counted
 * client-side, only the first message of a chat is an event, and batches go out every 10s at most. Any element (or its parent) marked
 * `data-track-ignore` is not captured; `data-track="Name"` overrides a click's label.
 */
// Same base as authService (not imported from it: authService imports this module).
const BASE_URL = (import.meta.env.VITE_BACKEND_URL || '').replace(/\/+$/, '');
const ENDPOINT = `${BASE_URL}/public/analytics/collect`;
const TOKEN_KEY = 'randomeet_jwt_token';
const VISITOR_KEY = 'rc_an_vid';
const SESSION_KEY = 'rc_an_sess';
const SESSION_IDLE_MS = 30 * 60 * 1000;
const FLUSH_MS = 10000;
const MAX_QUEUE = 30;

let started = false;
let queue = [];
let ctx = null;
let currentScreen = null;
let screenSince = 0;
let searchStartedAt = 0;
// Clicks are counted per (control, screen) and sent as ONE row per flush with value = count, so
// tapping Send 40 times in a chat costs one row, not 40.
let clickCounts = new Map();
// Message events only mark the first message of each chat (volume comes from the core tables).
const messagedChats = new Set();

function safeGet(store, key) {
  try { return store.getItem(key); } catch { return null; }
}
function safeSet(store, key, value) {
  try { store.setItem(key, value); } catch { /* private mode */ }
}

function randomId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID().replace(/-/g, '');
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

let memoryVisitor = null;
function visitorId() {
  let id = safeGet(localStorage, VISITOR_KEY);
  if (!id) {
    id = memoryVisitor || randomId();
    memoryVisitor = id;
    safeSet(localStorage, VISITOR_KEY, id);
  }
  return id;
}

/** A session ends after 30 minutes without any event (shared across tabs). */
let memorySession = null;
function sessionId() {
  const now = Date.now();
  let s = null;
  try { s = JSON.parse(safeGet(localStorage, SESSION_KEY) || 'null'); } catch { s = null; }
  s = s || memorySession;
  let isNew = false;
  if (!s || !s.id || now - s.last > SESSION_IDLE_MS) {
    s = { id: randomId(), last: now };
    isNew = true;
  }
  s.last = now;
  memorySession = s;
  safeSet(localStorage, SESSION_KEY, JSON.stringify(s));
  if (isNew || !ctx) ctx = buildContext(isNew);
  return s.id;
}

function buildContext(isNewSession) {
  const q = new URLSearchParams(window.location.search);
  let tz = null;
  try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { tz = null; }
  return {
    // The referrer only describes how a session began.
    ref: isNewSession ? (document.referrer || null) : null,
    utm_source: q.get('utm_source'),
    utm_medium: q.get('utm_medium'),
    utm_campaign: q.get('utm_campaign'),
    lang: navigator.language || null,
    tz,
    sw: window.screen?.width || null,
  };
}

function push(event) {
  if (!started) return;
  queue.push({ path: window.location.pathname, screen: currentScreen, ...event });
  if (queue.length >= MAX_QUEUE) flush();
}

function payload(events) {
  // The login token goes in the body: an Authorization header would make the server load the
  // user from the database for every batch.
  const t = safeGet(localStorage, TOKEN_KEY) || undefined;
  return JSON.stringify({ v: visitorId(), s: sessionId(), t, ctx, events });
}

async function send(events) {
  try {
    await fetch(ENDPOINT, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload(events), keepalive: true,
    });
  } catch { /* offline: drop */ }
}

function drainClicks() {
  if (!clickCounts.size) return;
  for (const c of clickCounts.values()) {
    queue.push({ type: 'click', name: 'click', path: c.path, screen: c.screen, label: c.label, props: c.props, value: c.n });
  }
  clickCounts = new Map();
}

export function flush({ beacon = false } = {}) {
  drainClicks();
  if (!queue.length) return;
  const events = queue.splice(0, 50);
  if (beacon && navigator.sendBeacon) {
    // text/plain keeps sendBeacon free of a CORS preflight; the server parses it as JSON.
    navigator.sendBeacon(ENDPOINT, new Blob([payload(events)], { type: 'text/plain' }));
  } else {
    send(events);
  }
  if (queue.length) flush({ beacon });
}

/** Product event, e.g. track('match_found', { topics: 2 }, waitMs). */
export function track(name, props, value) {
  push({ type: 'event', name, props: props || undefined, value: typeof value === 'number' ? value : undefined });
}

function closeScreen() {
  if (currentScreen && screenSince) {
    const ms = Date.now() - screenSince;
    if (ms > 300) push({ type: 'screen_time', name: 'screen_time', value: ms });
  }
  screenSince = 0;
}

/** Call when the visible screen / tab changes ("login", "match", "friends"...). */
export function setScreen(screen) {
  if (!started || !screen || screen === currentScreen) return;
  closeScreen();
  currentScreen = screen;
  screenSince = document.visibilityState === 'visible' ? Date.now() : 0;
  push({ type: 'pageview', name: 'pageview' });
}

const CLICKABLE = 'button, a, [role="button"], [role="tab"], [role="menuitem"], [data-track], input[type="checkbox"], input[type="radio"], select';

function labelOf(el) {
  const explicit = el.getAttribute('data-track');
  if (explicit) return explicit;
  const aria = el.getAttribute('aria-label') || el.getAttribute('title');
  if (aria) return aria;
  if (el.tagName === 'INPUT') return `${el.type}:${el.name || el.id || 'input'}`;
  if (el.tagName === 'SELECT') return `select:${el.name || el.id || 'select'}`;
  const text = (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
  if (text) return text.slice(0, 60);
  const img = el.querySelector('img[alt], svg[aria-label]');
  if (img) return img.getAttribute('alt') || img.getAttribute('aria-label');
  if (el.id) return `#${el.id}`;
  const cls = typeof el.className === 'string' ? el.className.split(' ').find(Boolean) : null;
  return cls ? `.${cls}` : el.tagName.toLowerCase();
}

function onClick(e) {
  const el = e.target?.closest?.(CLICKABLE);
  if (!el || el.closest('[data-track-ignore]')) return;
  const props = { tag: el.tagName.toLowerCase() };
  if (el.tagName === 'A' && el.href) {
    try {
      const u = new URL(el.href);
      props.dest = u.host === window.location.host ? u.pathname : u.host;
    } catch { /* ignore */ }
  }
  if (!started) return;
  const label = labelOf(el);
  const key = `${currentScreen}|${label}`;
  const c = clickCounts.get(key);
  if (c) c.n += 1;
  else clickCounts.set(key, { label, screen: currentScreen, path: window.location.pathname, props, n: 1 });
}

function onVisibility() {
  if (document.visibilityState === 'hidden') {
    closeScreen();
    flush({ beacon: true });
  } else if (currentScreen) {
    screenSince = Date.now();
  }
}

export function initAnalytics() {
  if (started || typeof window === 'undefined') return;
  started = true;
  sessionId();
  document.addEventListener('click', onClick, { capture: true, passive: true });
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', () => { closeScreen(); flush({ beacon: true }); });
  setInterval(() => flush(), FLUSH_MS);
}

// ---- product hooks used by the socket / auth services ----

const PUBLISH_EVENTS = {
  '/app/chat.random.cancel': 'match_cancel',
  '/app/chat.random.send': 'random_message_sent',
  '/app/chat.send': 'dm_sent',
  '/app/chat.game.spin': 'game_spin',
  '/app/chat.game.choose': 'game_choose',
  '/app/chat.game.ask': 'game_ask',
  '/app/chat.disconnect': 'chat_leave',
};

/** Maps a STOMP publish to a product event. Only the destination and message type are recorded. */
export function trackPublish(destination, body) {
  if (destination === '/app/chat.random') {
    // The search ticket is re-published every few seconds; only the first one is a new search.
    if (!searchStartedAt) {
      searchStartedAt = Date.now();
      track('match_search', {
        topics: Array.isArray(body?.topics) ? body.topics.length : 0,
        gender: body?.gender || 'any',
      });
    }
    return;
  }
  const name = PUBLISH_EVENTS[destination];
  if (!name) return;
  if (name === 'random_message_sent' || name === 'dm_sent') {
    const chat = body?.conversationId;
    if (!chat || messagedChats.has(chat)) return;
    if (messagedChats.size > 500) messagedChats.clear();
    messagedChats.add(chat);
  }
  if (name === 'match_cancel') searchStartedAt = 0;
  const props = body?.type && body.type !== 'TEXT' ? { kind: String(body.type).toLowerCase() } : undefined;
  track(name, props);
}

export function trackMatchFound(match) {
  const wait = searchStartedAt ? Date.now() - searchStartedAt : undefined;
  searchStartedAt = 0;
  track('match_found', {
    shared: Array.isArray(match?.sharedTopics) ? match.sharedTopics.length : 0,
    peer_guest: Boolean(match?.peerGuest),
  }, wait);
}

export function resetSearch() {
  searchStartedAt = 0;
}

export const analytics = { initAnalytics, track, setScreen, flush, trackPublish, trackMatchFound, resetSearch };
export default analytics;
// Exposed for debugging in the console: window.__rcAnalytics.flush()
if (typeof window !== 'undefined') window.__rcAnalytics = analytics;
