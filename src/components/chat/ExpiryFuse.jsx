import React, { useMemo } from 'react';

/** Only short countdowns (the "after seen" grace period) get a visible fuse. */
const SHOW_BELOW_MS = 15000;

/**
 * A tiny ring on a bubble that drains while a disappearing message counts down its last seconds,
 * so the dissolve that follows does not come as a surprise.
 */
export function ExpiryFuse({ expiresAt }) {
  // Measured once per expiry: re-renders must not restart the ring.
  const remaining = useMemo(() => (expiresAt ? Date.parse(expiresAt) - Date.now() : 0), [expiresAt]);
  if (!expiresAt || remaining <= 0 || remaining > SHOW_BELOW_MS) return null;
  return (
    <span
      className="msg-fuse"
      style={{ '--fuse-ms': `${remaining}ms` }}
      role="img"
      aria-label="Disappears in a few seconds"
    >
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <circle className="msg-fuse__track" cx="10" cy="10" r="8" />
        <circle className="msg-fuse__ring" cx="10" cy="10" r="8" pathLength="100" />
      </svg>
    </span>
  );
}
