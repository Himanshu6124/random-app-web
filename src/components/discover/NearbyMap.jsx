import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Plus, Minus, LocateFixed, MessageCircle, ShieldCheck } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { DiscoverAvatar } from './DiscoverAvatar';
import { FriendshipButton } from './FriendshipButton';
import { firstName, timeAgo, initialsOf, avatarColor } from './discoverUtils';

/** First view: about this many metres around you (a 10-15 km area). */
export const DEFAULT_RADIUS_M = 12000;
const MIN_ZOOM = 3;
const MAX_ZOOM = 18;
/** Zooming into a cluster whose members share one rounded spot never splits it; stop here. */
const SAME_SPOT_ZOOM = 15;

const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, ch => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[ch]));

const compactCount = (n) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n));

function personIcon(p, isSelected) {
  const initials = escapeHtml(initialsOf(p.name || ''));
  const bg = avatarColor(p.id || p.name || '');
  const face = p.photoUrl
    ? `<img src="${escapeHtml(p.photoUrl)}" alt="" style="width:100%;height:100%;border-radius:50%;object-fit:cover;" onerror="this.remove()"/>`
    : '';
  const classes = [
    'nearby-marker',
    p.isOnline && 'nearby-marker--online',
    p.friend && 'nearby-marker--friend',
    isSelected && 'is-selected'
  ].filter(Boolean).join(' ');
  const label = `${escapeHtml(firstName(p.name))} · ${p.distanceKm} km`;

  return L.divIcon({
    className: 'leaflet-friend-marker',
    html: `
      <div class="${classes}" aria-pressed="${isSelected}">
        <div class="dc-avatar" style="width:42px;height:42px;">
          <div class="dc-avatar-face" style="background:${bg};">${initials}${face}</div>
        </div>
        ${p.friend ? '<span class="nearby-friend-tag">Friend</span>' : ''}
        <span class="nearby-marker-label">${label}</span>
      </div>`,
    iconSize: [44, 60],
    iconAnchor: [22, 21],
  });
}

function clusterIcon(count) {
  // Grows with the order of magnitude so 3 and 300 read differently at a glance.
  const size = Math.round(Math.min(72, 38 + Math.log10(count) * 14));
  return L.divIcon({
    className: 'leaflet-friend-marker',
    html: `
      <div class="nearby-cluster" style="width:${size}px;height:${size}px;" title="${count} people around here">
        <span>${compactCount(count)}</span>
      </div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

export function NearbyMap({
  me,
  markers = [],
  onCenter,
  onViewChange,
  selected,
  onSelect,
  onMessage,
  onStatusChange,
  onError,
  updatedAt,
  overlay,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layersRef = useRef({ me: L.layerGroup(), people: L.layerGroup() });
  const [popoverPos, setPopoverPos] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(MIN_ZOOM);
  const centeredRef = useRef(false);
  const onViewChangeRef = useRef(onViewChange);
  onViewChangeRef.current = onViewChange;
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  const showAroundMe = useCallback((animate) => {
    const map = mapRef.current;
    if (!map || me?.latitude == null || me?.longitude == null) return;
    map.fitBounds(L.latLng(me.latitude, me.longitude).toBounds(DEFAULT_RADIUS_M * 2), { animate });
  }, [me?.latitude, me?.longitude]);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return undefined;

    const map = L.map(containerRef.current, {
      center: [20.5937, 78.9629],
      zoom: 4,
      zoomControl: false,
      attributionControl: true,
      minZoom: MIN_ZOOM,
      maxZoom: MAX_ZOOM,
      scrollWheelZoom: true,
      doubleClickZoom: true,
      touchZoom: true,
    });

    L.control.scale({ position: 'bottomright', imperial: false }).addTo(map);

    const cartoKey = import.meta.env.VITE_CARTO_API_KEY;
    const tileUrl = cartoKey
      ? `https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png?key=${cartoKey}`
      : 'https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png';

    L.tileLayer(tileUrl, {
      subdomains: 'abcd',
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>',
    }).addTo(map);

    layersRef.current.me.addTo(map);
    layersRef.current.people.addTo(map);

    map.on('click', (e) => {
      const target = e.originalEvent?.target;
      if (!target || !target.closest('.nearby-marker, .nearby-cluster')) onSelectRef.current?.(null);
    });

    const emitView = () => {
      setZoomLevel(map.getZoom());
      onViewChangeRef.current?.({ bounds: map.getBounds(), zoom: map.getZoom() });
    };
    map.on('zoomend moveend', emitView);

    mapRef.current = map;
    emitView();

    const resizeObserver = new ResizeObserver(() => map.invalidateSize());
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // "You" marker
  useEffect(() => {
    const { me: meLayer } = layersRef.current;
    meLayer.clearLayers();
    if (me?.latitude == null || me?.longitude == null) return;

    const meIcon = L.divIcon({
      className: 'leaflet-nearby-me-marker',
      html: `
        <div class="nearby-me" style="position:relative; width:0; height:0;">
          <span class="nearby-me-pulse"></span>
          <span class="nearby-me-dot"></span>
          <span class="nearby-me-label">You</span>
        </div>`,
      iconSize: [0, 0],
      iconAnchor: [0, 0],
    });
    meLayer.addLayer(L.marker([me.latitude, me.longitude], { icon: meIcon, interactive: false, zIndexOffset: 100 }));
  }, [me?.latitude, me?.longitude]);

  // First time a position is known: show the ~12 km area around you. Afterwards the user owns pan/zoom.
  useEffect(() => {
    if (!mapRef.current || centeredRef.current || me?.latitude == null || me?.longitude == null) return;
    centeredRef.current = true;
    showAroundMe(false);
  }, [me?.latitude, me?.longitude, showAroundMe]);

  // People and clusters
  useEffect(() => {
    const { people: layer } = layersRef.current;
    layer.clearLayers();

    markers.forEach((m) => {
      if (m.kind === 'CLUSTER') {
        const marker = L.marker([m.latitude, m.longitude], { icon: clusterIcon(m.count), zIndexOffset: 150 });
        marker.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          const map = mapRef.current;
          if (!map) return;
          onSelectRef.current?.(null);
          const sameSpot = Math.abs(m.north - m.south) < 1e-6 && Math.abs(m.east - m.west) < 1e-6;
          if (sameSpot) {
            map.setView([m.latitude, m.longitude], Math.max(map.getZoom() + 2, SAME_SPOT_ZOOM), { animate: true });
          } else {
            map.flyToBounds([[m.south, m.west], [m.north, m.east]], { padding: [70, 70], maxZoom: MAX_ZOOM, duration: 0.6 });
          }
        });
        layer.addLayer(marker);
        return;
      }

      const p = m.person;
      if (!p) return;
      const isSelected = p.id === selected?.id;
      const marker = L.marker([m.latitude, m.longitude], {
        icon: personIcon(p, isSelected),
        zIndexOffset: isSelected ? 500 : p.friend ? 300 : 200,
      });
      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        onSelectRef.current?.(isSelected ? null : p);
      });
      layer.addLayer(marker);
    });
  }, [markers, selected?.id]);

  // Track popover position above the selected person
  const updatePopover = useCallback(() => {
    const map = mapRef.current;
    if (!map || !selected || selected.latitude == null || selected.longitude == null) {
      setPopoverPos(null);
      return;
    }
    const pt = map.latLngToContainerPoint([selected.latitude, selected.longitude]);
    setPopoverPos({ x: pt.x, y: pt.y });
  }, [selected]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return undefined;
    updatePopover();
    map.on('move zoom', updatePopover);
    return () => map.off('move zoom', updatePopover);
  }, [updatePopover]);

  // Bring the selected person into view
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selected || selected.latitude == null || selected.longitude == null) return;
    map.panTo([selected.latitude, selected.longitude], { animate: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  const handleCenter = () => {
    showAroundMe(true);
    onCenter?.();
  };

  const popoverBelow = popoverPos && popoverPos.y < 200;
  const popoverLeft = popoverPos ? Math.max(12, popoverPos.x - 125) : 0;

  return (
    <div className="nearby-map">
      <div ref={containerRef} className="nearby-map-leaflet" />

      {selected && popoverPos && (
        <div
          className="nearby-popover"
          style={
            popoverBelow
              ? { left: popoverLeft, top: popoverPos.y + 36 }
              : { left: popoverLeft, top: popoverPos.y - 34, transform: 'translateY(-100%)' }
          }
        >
          <div className="nearby-popover-head">
            <DiscoverAvatar id={selected.id} name={selected.name} photoUrl={selected.photoUrl} online={selected.isOnline} size={40} />
            <div>
              <span className="nearby-popover-name">
                {selected.name}
                {selected.friend && <span className="nearby-friend-tag nearby-friend-tag--inline">Friend</span>}
                {String(selected.id).startsWith('bot-') && <span className="dc-ai-badge">AI</span>}
              </span>
              <span className="nearby-popover-sub">
                {selected.distanceKm} km ·{' '}
                {selected.isOnline ? 'Online' : `Shared ${timeAgo(selected.locationUpdatedAt) || 'earlier'}`}
              </span>
            </div>
          </div>
          {String(selected.id).startsWith('bot-') ? null : selected.friend ? (
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="dc-btn dc-btn--primary dc-btn--sm" onClick={() => onMessage(selected.id)}>
                <MessageCircle size={16} aria-hidden="true" />
                Message
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8 }}>
              <FriendshipButton
                personId={selected.id}
                name={selected.name}
                status={selected.friendshipStatus}
                size="sm"
                onStatusChange={(status) => onStatusChange?.(selected.id, status)}
                onMessage={() => onMessage(selected.id)}
                onError={onError}
              />
            </div>
          )}
        </div>
      )}

      <div className="nearby-map-controls">
        <button
          type="button"
          className="dc-icon-btn"
          aria-label="Zoom in"
          onClick={() => mapRef.current?.zoomIn()}
          disabled={zoomLevel >= MAX_ZOOM || !!overlay}
        >
          <Plus size={18} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="dc-icon-btn"
          aria-label="Zoom out"
          onClick={() => mapRef.current?.zoomOut()}
          disabled={zoomLevel <= MIN_ZOOM || !!overlay}
        >
          <Minus size={18} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="dc-icon-btn nearby-center-btn"
          aria-label="Back to my area"
          onClick={handleCenter}
          disabled={!!overlay}
        >
          <LocateFixed size={18} aria-hidden="true" />
        </button>
      </div>

      {!overlay && (
        <div className="nearby-map-footer">
          <ShieldCheck size={14} aria-hidden="true" />
          Approximate locations (~1 km){updatedAt ? ` · updated ${timeAgo(updatedAt)}` : ''}
        </div>
      )}

      {overlay && <div className="nearby-map-overlay">{overlay}</div>}
    </div>
  );
}
