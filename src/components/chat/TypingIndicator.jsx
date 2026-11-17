import React, { useEffect, useState } from 'react';

/**
 * "… is typing" row at the bottom of the feed. It is always mounted and folds its height
 * open / closed, so the messages above glide instead of jumping when typing starts or stops.
 */
export function TypingIndicator({ show, name }) {
  // Keep the last name while folding away, so the text doesn't blank mid-animation.
  const [label, setLabel] = useState(name);
  useEffect(() => { if (show) setLabel(name); }, [show, name]);

  return (
    <div className={`typing-row${show ? ' is-visible' : ''}`} aria-live="polite" aria-hidden={!show}>
      <div className="typing-row__inner">
        <div className="typing-bubble" aria-hidden="true">
          <span className="typing-dot" />
          <span className="typing-dot" />
          <span className="typing-dot" />
        </div>
        <span className="typing-row__label">{show ? `${label} is typing…` : ''}</span>
      </div>
    </div>
  );
}
