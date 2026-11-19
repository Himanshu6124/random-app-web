import React from 'react';

/**
 * Typing row at the bottom of the feed: only the three-dot bubble animates, no text.
 * It is always mounted and folds its height open / closed, so the messages above glide
 * instead of jumping when typing starts or stops.
 */
export function TypingIndicator({ show, name }) {
  return (
    <div
      className={`typing-row${show ? ' is-visible' : ''}`}
      role="status"
      aria-label={show && name ? `${name} is typing` : undefined}
      aria-hidden={!show}
    >
      <div className="typing-row__inner">
        <div className="typing-bubble" aria-hidden="true">
          <span className="typing-dot" />
          <span className="typing-dot" />
          <span className="typing-dot" />
        </div>
      </div>
    </div>
  );
}
