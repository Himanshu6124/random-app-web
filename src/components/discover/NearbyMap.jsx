import React, { useLayoutEffect, useRef, useState } from 'react';
import { Plus, Minus, LocateFixed, MessageCircle, Hand, ShieldCheck } from 'lucide-react';
import { DiscoverAvatar } from './DiscoverAvatar';
import { firstName, timeAgo } from './discoverUtils';

const KM_PER_DEG_LAT = 110.574;
const MARKER_PAD = 44;

/** Decorative street-map backdrop from the design (not real geography). */
function MapArt() {
  return (
    <svg className="nearby-map-art" viewBox="0 0 800 600" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width="800" height="600" fill="#0c1024" />
      <rect x="70" y="60" width="150" height="110" rx="14" fill="rgba(52,211,153,0.09)" />
      <rect x="560" y="390" width="190" height="130" rx="14" fill="rgba(52,211,153,0.09)" />
      <rect x="430" y="80" width="90" height="70" rx="10" fill="rgba(52,211,153,0.07)" />
      <path d="M-20 470 C 140 420, 230 520, 380 470 S 640 380, 820 430" stroke="rgba(34,211,238,0.16)" strokeWidth="30" fill="none" />
      <g stroke="#1b2244" strokeWidth="5" fill="none">
        <path d="M0 120 H800" /><path d="M0 250 H800" /><path d="M0 360 H800" /><path d="M0 540 H800" />
        <path d="M120 0 V600" /><path d="M260 0 V600" /><path d="M540 0 V600" /><path d="M680 0 V600" />
      </g>
      <g stroke="#232c55" strokeWidth="12" fill="none" strokeLinecap="round">
        <path d="M-10 600 L 820 -10" /><path d="M400 -10 V610" /><path d="M-10 300 H810" />
      </g>
      <g stroke="#151b38" strokeWidth="2.5" fill="none">
        <path d="M0 60 H800" /><path d="M0 190 H800" /><path d="M0 420 H800" />
        <path d="M60 0 V600" /><path d="M190 0 V600" /><path d="M330 0 V600" /><path d="M470 0 V600" /><path d="M610 0 V600" /><path d="M750 0 V600" />
      </g>
    </svg>
  );
}

/**
 * Places friends around "You" by their real bearing and distance (from the rounded positions
 * the server returns). The outer ring is the chosen radius, the inner ring half of it.
 */
export function NearbyMap({
  me, friends, radiusKm, zoom, onZoomIn, onZoomOut, onCenter, canZoomIn, canZoomOut,
  selectedId, onSelect, onMessage, onWave, waveState, updatedAt, overlay
}) {
  const boxRef = useRef(null);
  const [box, setBox] = useState({ w: 800, h: 620 });

  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return undefined;
    const measure = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const cx = box.w / 2;
  const cy = box.h / 2;
  const ringPx = Math.max(60, Math.min(box.w, box.h) / 2 - MARKER_PAD) * zoom;
  const pxPerKm = ringPx / radiusKm;

  const kmPerDegLng = me?.latitude != null ? 111.32 * Math.cos((me.latitude * Math.PI) / 180) : 111.32;

  // Rounded positions often coincide or crowd: nudge each marker until it has room for its
  // label, spiralling outwards from where it really is.
  const MIN_GAP = 64;
  const placed = [];
  friends.forEach(n => {
    let x = cx;
    let y = cy;
    if (me?.latitude != null) {
      x = cx + (n.longitude - me.longitude) * kmPerDegLng * pxPerKm;
      y = cy - (n.latitude - me.latitude) * KM_PER_DEG_LAT * pxPerKm;
    }
    const crowded = (px, py) => Math.hypot(px - cx, py - cy) < 56
      || placed.some(p => Math.abs(p.x - px) < MIN_GAP * 1.3 && Math.abs(p.y - py) < MIN_GAP * 0.85);
    let px = x;
    let py = y;
    for (let step = 1; crowded(px, py) && step < 40; step++) {
      const angle = step * 2.39996;
      const r = 18 + step * 6;
      px = x + Math.cos(angle) * r;
      py = y + Math.sin(angle) * r;
    }
    placed.push({
      ...n,
      x: Math.min(box.w - 30, Math.max(30, px)),
      y: Math.min(box.h - 40, Math.max(30, py))
    });
  });

  const selected = placed.find(p => p.friend.id === selectedId);
  const popoverBelow = selected && selected.y < 200;
  const popoverLeft = selected ? Math.min(box.w - 262, Math.max(12, selected.x - 125)) : 0;

  return (
    <div className="nearby-map" ref={boxRef}>
      <MapArt />

      {!overlay && (
        <>
          <span className="nearby-ring nearby-ring--outer" style={{ left: cx, top: cy, width: ringPx * 2, height: ringPx * 2 }} />
          <span className="nearby-ring nearby-ring--inner" style={{ left: cx, top: cy, width: ringPx, height: ringPx }} />
          {cy - ringPx > 8 && <span className="nearby-ring-label" style={{ left: cx, top: cy - ringPx - 4 }}>{radiusKm} km</span>}

          <div className="nearby-me" role="img" aria-label="Your approximate location" style={{ left: cx, top: cy }}>
            <span className="nearby-me-pulse" />
            <span className="nearby-me-dot" />
            <span className="nearby-me-label">You</span>
          </div>

          {placed.map(n => {
            const label = `${firstName(n.friend.name)} · ${n.distanceKm} km`;
            return (
              <button
                key={n.friend.id}
                type="button"
                className={`nearby-marker${n.friend.isOnline ? ' nearby-marker--online' : ''}`}
                style={{ left: n.x, top: n.y }}
                aria-label={label}
                aria-pressed={selectedId === n.friend.id}
                onClick={() => onSelect(selectedId === n.friend.id ? null : n.friend.id)}
              >
                <DiscoverAvatar id={n.friend.id} name={n.friend.name} photoUrl={n.friend.photoUrl} size={42} showPresence={false} />
                <span className="nearby-marker-label">{label}</span>
              </button>
            );
          })}

          {selected && (
            <div
              className="nearby-popover"
              style={popoverBelow
                ? { left: popoverLeft, top: selected.y + 50 }
                : { left: popoverLeft, top: selected.y - 34, transform: 'translateY(-100%)' }}
            >
              <div className="nearby-popover-head">
                <DiscoverAvatar id={selected.friend.id} name={selected.friend.name} photoUrl={selected.friend.photoUrl} online={selected.friend.isOnline} size={40} />
                <div>
                  <span className="nearby-popover-name">{selected.friend.name}</span>
                  <span className="nearby-popover-sub">
                    {selected.distanceKm} km · {selected.friend.isOnline ? 'Online' : `Shared ${timeAgo(selected.locationUpdatedAt) || 'earlier'}`}
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="dc-btn dc-btn--primary dc-btn--sm" onClick={() => onMessage(selected.friend.id)}>
                  <MessageCircle size={16} aria-hidden="true" />Message
                </button>
                <button
                  type="button"
                  className="dc-btn dc-btn--soft dc-btn--sm"
                  onClick={() => onWave(selected.friend.id)}
                  disabled={waveState?.id === selected.friend.id && waveState.status !== 'error'}
                >
                  <Hand size={16} aria-hidden="true" />
                  {waveState?.id === selected.friend.id && waveState.status === 'sent' ? 'Waved' : 'Wave'}
                </button>
              </div>
              {waveState?.id === selected.friend.id && waveState.status === 'error' && (
                <span className="nearby-popover-sub" role="alert">{waveState.message}</span>
              )}
            </div>
          )}
        </>
      )}

      <div className="nearby-map-controls">
        <button type="button" className="dc-icon-btn" aria-label="Zoom in" onClick={onZoomIn} disabled={!canZoomIn || !!overlay}>
          <Plus size={18} aria-hidden="true" />
        </button>
        <button type="button" className="dc-icon-btn" aria-label="Zoom out" onClick={onZoomOut} disabled={!canZoomOut || !!overlay}>
          <Minus size={18} aria-hidden="true" />
        </button>
        <button type="button" className="dc-icon-btn nearby-center-btn" aria-label="Center on me" onClick={onCenter} disabled={!!overlay}>
          <LocateFixed size={18} aria-hidden="true" />
        </button>
      </div>

      {!overlay && (
        <>
          <div className="nearby-map-footer">
            <ShieldCheck size={14} aria-hidden="true" />
            Approximate locations{updatedAt ? ` · updated ${timeAgo(updatedAt)}` : ''}
          </div>
          <div className="nearby-map-scale">Ring = {radiusKm} km · {zoom}×</div>
        </>
      )}

      {overlay && <div className="nearby-map-overlay">{overlay}</div>}
    </div>
  );
}
