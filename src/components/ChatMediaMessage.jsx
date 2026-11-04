import React, { useState } from 'react';

/**
 * Renders a media message (image or voice note) inside a chat bubble.
 * Images are constrained and click-to-view-full; voice notes render an audio player.
 * Falls back to a caption when the media itself cannot be shown.
 */
export function ChatMediaMessage({ msg }) {
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const src = msg.objectUri || msg.localPreviewUrl;
  const type = msg.type || (msg.objectUri?.match(/audio|webm|m4a|mp3|ogg/i) ? 'AUDIO' : 'IMAGE');
  const caption = msg.text || msg.message || '';

  if (!src) {
    return <span>{caption || 'Media message'}</span>;
  }

  if (type === 'IMAGE') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <img
          src={src}
          alt={caption || 'Shared image'}
          onClick={(e) => { e.stopPropagation(); setLightboxOpen(true); }}
          style={{
            maxWidth: '100%',
            maxHeight: '260px',
            borderRadius: '10px',
            cursor: 'zoom-in',
            display: 'block',
            objectFit: 'cover'
          }}
          onError={(e) => {
            e.target.style.display = 'none';
            e.target.parentElement.dataset.mediaFailed = 'true';
          }}
        />
        {caption && caption !== '📷 Photo' && <span>{caption}</span>}
        {lightboxOpen && (
          <div
            onClick={(e) => { e.stopPropagation(); setLightboxOpen(false); }}
            style={{
              position: 'fixed', inset: 0, zIndex: 2000,
              background: 'rgba(0, 0, 0, 0.88)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'zoom-out', padding: '24px'
            }}
            title="Click anywhere to close"
          >
            <img
              src={msg.objectUri || src}
              alt={caption || 'Shared image'}
              style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: '8px', objectFit: 'contain' }}
            />
          </div>
        )}
      </div>
    );
  }

  if (type === 'AUDIO') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '220px' }}>
        <audio controls src={src} style={{ width: '100%', height: '36px' }} preload="metadata" />
        {caption && caption !== '🎤 Voice note' && <span>{caption}</span>}
      </div>
    );
  }

  return <span>{caption}</span>;
}
