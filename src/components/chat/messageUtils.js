/** Pure helpers for chat replies & reactions (shared by the random chat and friend DMs). */

/** The reactions offered in the picker. Any single emoji is accepted by the server. */
export const REACTION_EMOJIS = ['❤️', '😂', '😮', '😢', '🔥', '👍'];

/**
 * Applies a REACTION event ({ senderId: reactor, messageId, emoji }) to one message.
 * The author's reaction lives in reactEmojiSender, the other person's in reactEmojiReceiver.
 */
export function applyReaction(msg, reaction) {
  if (!msg || !reaction || msg.id !== reaction.messageId) return msg;
  const emoji = reaction.emoji || null;
  return reaction.senderId === msg.senderId
    ? { ...msg, reactEmojiSender: emoji }
    : { ...msg, reactEmojiReceiver: emoji };
}

/** The current user's reaction on a message, or null. */
export function myReactionOn(msg, myId) {
  if (!msg) return null;
  return (msg.senderId === myId ? msg.reactEmojiSender : msg.reactEmojiReceiver) || null;
}

/** One-line preview of a message for reply quotes. */
export function previewText(msg) {
  if (!msg) return 'Original message is no longer available';
  if (msg.type === 'IMAGE') return '📷 Photo';
  if (msg.type === 'AUDIO') return '🎤 Voice note';
  if (msg.type === 'VIDEO') return '🎬 Video';
  const text = (msg.text || msg.message || '').trim();
  return text.length > 140 ? text.slice(0, 140) + '…' : text;
}

/** Messages that can be replied to / reacted on: real, delivered chat messages only. */
export function isInteractive(msg) {
  if (!msg || !msg.id) return false;
  if (msg.senderId === 'system' || msg.senderId === 'game') return false;
  if (msg.status === 'FAILED' || msg.status === 'SENDING') return false;
  return !String(msg.id).startsWith('pending_') && !String(msg.id).startsWith('failed_');
}

/** Scrolls to a message bubble and flashes it, for tapping a reply quote. */
export function jumpToMessage(messageId) {
  if (!messageId) return;
  const el = document.getElementById(`msg-${messageId}`);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.classList.remove('msg-flash');
  // Force a reflow so the animation restarts on repeated taps
  void el.offsetWidth;
  el.classList.add('msg-flash');
}
