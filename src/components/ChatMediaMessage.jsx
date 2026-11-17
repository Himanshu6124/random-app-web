import React, { useState } from 'react';
import { MediaViewer } from './chat/MediaViewer';

/**
 * Renders a media message (image or voice note) inside a chat bubble.
 * Images open in a zoomable full-screen viewer; voice notes render an audio player.
 * Falls back to a caption when the media itself cannot be shown.
 */
export function ChatMediaMessage({ msg }) {
  const [viewerOpen, setViewerOpen] = useState(false);

  const src = msg.objectUri || msg.localPreviewUrl;
  const type = msg.type || (msg.objectUri?.match(/audio|webm|m4a|mp3|ogg/i) ? 'AUDIO' : 'IMAGE');
  const caption = msg.text || msg.message || '';

  if (!src) {
    return <span className="chat-bubble__text">{caption || 'Media message'}</span>;
  }

  if (type === 'IMAGE') {
    return (
      <div className="chat-media chat-media--image">
        <img
          src={src}
          alt={caption || 'Shared image'}
          className="chat-media__img"
          onClick={(e) => { e.stopPropagation(); setViewerOpen(true); }}
          onError={(e) => {
            e.target.style.display = 'none';
            e.target.parentElement.dataset.mediaFailed = 'true';
          }}
        />
        {caption && caption !== '📷 Photo' && <span className="chat-media__caption">{caption}</span>}
        {viewerOpen && (
          <MediaViewer
            src={msg.objectUri || src}
            alt={caption || 'Shared image'}
            onClose={() => setViewerOpen(false)}
          />
        )}
      </div>
    );
  }

  if (type === 'AUDIO') {
    return (
      <div className="chat-media chat-media--audio">
        <audio controls src={src} preload="metadata" />
        {caption && caption !== '🎤 Voice note' && <span className="chat-media__caption">{caption}</span>}
      </div>
    );
  }

  return <span className="chat-bubble__text">{caption}</span>;
}
