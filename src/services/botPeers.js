import { useCallback, useSyncExternalStore } from 'react';

/**
 * Server-side bot chat partners are shown exactly like people everywhere in the app. Their ids
 * are "bot-<persona>" in Discover and "bot-<persona>-<8 hex>" inside a live random chat.
 *
 * Every relationship action on a bot (add friend, cancel, block, block & report, unblock) is
 * handled on this device only and never sent to the server. The outcome is kept per viewer and
 * reads back on every screen like the same action on a person would: "Requested", "Blocked".
 */

const PREFIX = 'bot-';
const CHAT_SUFFIX = /-[0-9a-f]{8}$/;
const STORAGE_KEY = 'rc.localBotRelations';

export const isBotUserId = (id) => typeof id === 'string' && id.startsWith(PREFIX);

/** "bot-mia-3f9c2a1b" -> "bot-mia", so an action taken in a chat also shows in Discover. */
const profileIdOf = (id) => {
  const stripped = id.replace(CHAT_SUFFIX, '');
  return stripped.length > PREFIX.length ? stripped : id;
};

// { [viewerId]: { [botProfileId]: 'PENDING_SENT' | 'BLOCKED' } }
let relations = read();
let version = 0;
const listeners = new Set();

function read() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function write() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(relations));
  } catch {
    // Storage unavailable (private mode): the state still holds for this session.
  }
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function localStatus(viewerId, botId) {
  if (!viewerId || !isBotUserId(botId)) return null;
  return relations[viewerId]?.[profileIdOf(botId)] || null;
}

/** Sets this viewer's relation to a bot: 'PENDING_SENT', 'BLOCKED', or null to clear it. */
export function setBotRelation(viewerId, botId, status) {
  if (!viewerId || !isBotUserId(botId)) return;
  const id = profileIdOf(botId);
  const mine = { ...(relations[viewerId] || {}) };
  if ((mine[id] || null) === (status || null)) return;
  if (status) mine[id] = status;
  else delete mine[id];
  relations = { ...relations, [viewerId]: mine };
  version += 1;
  write();
  listeners.forEach(l => l());
}

export const isBotBlocked = (viewerId, botId) => localStatus(viewerId, botId) === 'BLOCKED';

/** The friendship status to show: the server's for people, this device's for a bot. */
export function resolveFriendStatus(viewerId, personId, serverStatus) {
  if (!isBotUserId(personId)) return serverStatus;
  return localStatus(viewerId, personId) || 'NONE';
}

/** React binding of resolveFriendStatus: re-renders when a bot relation changes. */
export function useResolvedFriendStatus(viewerId, personId, serverStatus) {
  const snapshot = useCallback(
    () => resolveFriendStatus(viewerId, personId, serverStatus),
    [viewerId, personId, serverStatus]
  );
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

/** Changes whenever any bot relation changes: a dependency for lists that hide blocked bots. */
export function useBotRelationsVersion() {
  return useSyncExternalStore(subscribe, () => version, () => version);
}
