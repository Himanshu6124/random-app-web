import React, { useState } from 'react';
import { MediaViewer } from './MediaViewer';

/** WhatsApp's view-once mark: a "1" in a circle. `opened` draws the dashed, spent version. */
export function ViewOnceIcon({ size = 20, opened = false, filled = false, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <circle
        cx="12"
        cy="12"
        r="9.25"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeDasharray={opened ? '3.2 2.6' : undefined}
        strokeLinecap="round"
        fill={filled ? 'currentColor' : 'none'}
      />
      {!opened && (
        <path
          d="M10.3 9.2 12.6 7.6V16.4"
          stroke={filled ? 'var(--vo-fill-text, #111)' : 'currentColor'}
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}

/**
 * A view-once photo, like WhatsApp:
 * - receiver: "Photo" with the 1-icon; tap opens it full screen exactly once,
 * - after that both people keep the message, shown as "Opened" (the photo itself is gone),
 * - sender: "Photo" until the other person opens it, then "Opened".
 */
export function ViewOnceBubble({ msg, isMe, onOpened }) {
  const [open, setOpen] = useState(false);
  const opened = Boolean(msg.viewedAt);
  const caption = (msg.text || msg.message || '').trim();
  const showCaption = caption && caption !== '📷 Photo';

  if (opened || isMe) {
    return (
      <div className={`view-once view-once--static${opened ? ' is-opened' : ''}`}>
        <ViewOnceIcon opened={opened} />
        <span className="view-once__text">
          <strong>{opened ? 'Opened' : 'Photo'}</strong>
          {showCaption && !opened && <span className="view-once__caption">{caption}</span>}
        </span>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        className="view-once"
        onClick={(e) => { e.stopPropagation(); if (msg.objectUri) setOpen(true); }}
        aria-label="View once photo. Tap to open, it can only be opened once"
      >
        <ViewOnceIcon />
        <span className="view-once__text">
          <strong>Photo</strong>
          {showCaption && <span className="view-once__caption">{caption}</span>}
        </span>
      </button>
      {open && (
        // The viewer is portalled, but React events still bubble to this bubble's message row.
        <span onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
          <MediaViewer
            src={msg.objectUri}
            alt="View once photo"
            onClose={() => {
              setOpen(false);
              onOpened?.(msg);
            }}
          />
        </span>
      )}
    </>
  );
}
