/**
 * Topics picked on the Match screen before searching. Mirrors the backend enum
 * `MatchTopic` (randomChatabs/.../model/MatchTopic.java): the `id` values are the wire format
 * and must stay in sync. Unknown ids are ignored by the server.
 */
export const MATCH_TOPICS = [
  { id: 'late_night', emoji: '🌙', label: 'Late-night talks' },
  { id: 'memes', emoji: '😂', label: 'Memes' },
  { id: 'music', emoji: '🎧', label: 'Music' },
  { id: 'gaming', emoji: '🎮', label: 'Gaming' },
  { id: 'anime', emoji: '🍥', label: 'Anime' },
  { id: 'movies', emoji: '🍿', label: 'Movies & shows' },
  { id: 'deep_convos', emoji: '🧠', label: 'Deep convos' },
  { id: 'travel', emoji: '✈️', label: 'Travel' },
  { id: 'sports', emoji: '⚽', label: 'Sports' },
  { id: 'study', emoji: '📚', label: 'Study buddy' },
  { id: 'fitness', emoji: '💪', label: 'Fitness' },
  { id: 'art', emoji: '🎨', label: 'Art' }
];

/** Most topics one search may carry (the server keeps at most this many). */
export const MAX_MATCH_TOPICS = 3;

/** How long the server holds out for a shared topic before matching anyone (matchmaking.interest-window-ms). */
export const TOPIC_WINDOW_SECONDS = 1;

const BY_ID = new Map(MATCH_TOPICS.map(t => [t.id, t]));
const STORAGE_KEY = 'rc.matchTopics';

export function topicById(id) {
  return BY_ID.get(id) || null;
}

/** Keeps only known ids, de-duplicated, capped. */
export function cleanTopicIds(ids) {
  if (!Array.isArray(ids)) return [];
  const out = [];
  for (const id of ids) {
    if (BY_ID.has(id) && !out.includes(id)) out.push(id);
    if (out.length >= MAX_MATCH_TOPICS) break;
  }
  return out;
}

/** "🎧 Music · 😂 Memes" */
export function formatTopics(ids) {
  return cleanTopicIds(ids)
    .map(id => { const t = BY_ID.get(id); return `${t.emoji} ${t.label}`; })
    .join(' · ');
}

/** The last picks on this device (a convenience only; never required). */
export function loadSavedTopics() {
  try {
    return cleanTopicIds(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'));
  } catch {
    return [];
  }
}

export function saveTopics(ids) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cleanTopicIds(ids)));
  } catch {
    // Storage blocked (private mode etc.): picks just won't be remembered.
  }
}
