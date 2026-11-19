import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { MediaViewer } from './MediaViewer';

/**
 * A view-once photo. The receiver sees a tap-to-open card; the photo opens once and the message
 * is removed for both people when the viewer closes it. The sender only sees that it waits.
 */
export function ViewOnceBubble({ msg, isMe, onOpened }) {
  const [open, setOpen] = useState(false);
  const [opened, setOpened] = useState(false);

  if (isMe) {
    return (
      <div className="view-once view-once--sent" aria-label="View once photo, waiting to be opened">
        <Eye size={18} aria-hidden="true" />
        <span className="view-once__text">
          <strong>View once photo</strong>
          <span>Disappears after they open it</span>
        </span>
      </div>
    );
  }

  if (opened) {
    return (
      <div className="view-once view-once--done">
        <EyeOff size={18} aria-hidden="true" />
        <span className="view-once__text"><strong>Opened</strong></span>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        className="view-once"
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        aria-label="View once photo. Tap to open, it can only be opened once"
      >
        <Eye size={18} aria-hidden="true" />
        <span className="view-once__text">
          <strong>Photo</strong>
          <span>Tap to view once</span>
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
              setOpened(true);
              onOpened?.(msg);
            }}
          />
        </span>
      )}
    </>
  );
}
