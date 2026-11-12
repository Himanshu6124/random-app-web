import React, { useState } from 'react';
import { User } from 'lucide-react';
import { avatarColor, initialsOf } from './discoverUtils';

/**
 * Round avatar used across Discover: the profile picture when there is one, otherwise
 * initials on a stable colour (as in the design). Guests get a dashed outline.
 */
export function DiscoverAvatar({ id, name, photoUrl, size = 48, online, guest = false, showPresence = true }) {
  const [broken, setBroken] = useState(false);
  const dot = Math.max(10, Math.round(size / 4));
  const showPhoto = photoUrl && !broken && !guest;

  return (
    <div className="dc-avatar" style={{ width: size, height: size }} aria-hidden="true">
      {guest ? (
        <div className="dc-avatar-face dc-avatar-face--guest">
          <User size={Math.round(size * 0.42)} />
        </div>
      ) : (
        <div
          className="dc-avatar-face"
          style={{ background: showPhoto ? '#312e81' : avatarColor(id || name || ''), fontSize: Math.round(size * 0.36) }}
        >
          {showPhoto ? <img src={photoUrl} alt="" onError={() => setBroken(true)} /> : initialsOf(name)}
        </div>
      )}
      {showPresence && !guest && (
        <span
          className={`dc-avatar-dot${online ? ' dc-avatar-dot--online' : ''}`}
          style={{ width: dot, height: dot }}
        />
      )}
    </div>
  );
}
