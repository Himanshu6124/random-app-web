import React from 'react';
import { HelpCircle, Wine, Heart, Flame, Star, Smile, Hand } from 'lucide-react';

const QUICK_EMOJIS = [
  { Icon: Heart, emoji: '❤️' },
  { Icon: Flame, emoji: '🔥' },
  { Icon: Star, emoji: '✨' },
  { Icon: Smile, emoji: '😂' },
  { Icon: Hand, emoji: '👋' }
];

/**
 * The strip above the message bar, shared by the random chat and friend DMs:
 * Icebreaker + Truth & Dare on the left, quick emojis (horizontally scrollable) on the right.
 */
export function ChatQuickBar({ onIcebreaker, onSpin, onEmoji, disabled = false, spinDisabled = disabled, spinId }) {
  return (
    <div className="chat-subbar" style={{
      padding: '10px 20px',
      borderTop: '1px solid var(--border-color)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      background: 'rgba(26, 16, 25, 0.5)',
      position: 'relative',
      zIndex: 20
    }}>
      <div className="chat-subbar-actions">
        <button
          type="button"
          onClick={onIcebreaker}
          disabled={disabled}
          className="btn-secondary chat-subbar-pill"
        >
          <HelpCircle size={15} color="var(--text-secondary)" aria-hidden="true" />
          <span className="label-long">Icebreaker</span>
          <span className="label-short">Icebreaker</span>
        </button>

        <button
          id={spinId}
          type="button"
          onClick={onSpin}
          disabled={spinDisabled}
          className="btn-secondary chat-subbar-pill chat-game-btn"
          aria-label="Play Truth & Dare"
        >
          <Wine size={15} aria-hidden="true" />
          <span className="label-long">Truth &amp; Dare</span>
          <span className="label-short chat-game-label-short">Truth &amp; Dare</span>
        </button>
      </div>

      <div className="chat-subbar-reactions" style={{ display: 'flex', gap: '6px' }}>
        {QUICK_EMOJIS.map(({ Icon, emoji }) => (
          <button
            key={emoji}
            type="button"
            onClick={(e) => onEmoji(e, emoji)}
            disabled={disabled}
            className="reaction-chip"
            aria-label={`Send ${emoji}`}
          >
            <Icon size={16} />
          </button>
        ))}
      </div>
    </div>
  );
}
