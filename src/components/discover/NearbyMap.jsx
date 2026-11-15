import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Plus, Minus, LocateFixed, MessageCircle, Hand, ShieldCheck } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { DiscoverAvatar } from './DiscoverAvatar';
import { firstName, timeAgo, initialsOf, avatarColor } from './discoverUtils';

function getZoomForRadius(km) {
  if (km <= 1) return 15;
  if (km <= 2) return 14;
  if (km <= 5) return 13;
  if (km <= 10) return 12;
  if (km <= 25) return 10;
  return 9;
}

export function NearbyMap({
  me,
  friends = [],
  radiusKm = 5,
  zoom: _zoom,
  onZoomIn,
  onZoomOut,
  onCenter,
  canZoomIn,
  canZoomOut,
  selectedId,
  onSelect,
  onMessage,
  onWave,
  waveState,
  updatedAt,
  overlay,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layersRef = useRef({
    circles: L.layerGroup(),
    me: L.layerGroup(),
    friends: L.layerGroup(),
  });
  const [popoverPos, setPopoverPos] = useState(null);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return undefined;

    const initialLat = me?.latitude ?? 20.5937;
    const initialLng = me?.longitude ?? 78.9629;
    const initialZoom = me?.latitude != null ? getZoomForRadius(radiusKm) : 4;

    const map = L.map(containerRef.current, {
      center: [initialLat, initialLng],
      zoom: initialZoom,
      zoomControl: false,
      attributionControl: true,
    });

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

    layersRef.current.circles.addTo(map);
    layersRef.current.me.addTo(map);
    layersRef.current.friends.addTo(map);

    map.on('click', (e) => {
      const target = e.originalEvent?.target;
      if (!target || !target.closest('.nearby-marker')) {
        onSelect?.(null);
      }
    });

    mapRef.current = map;

    // Handle container resizing
    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update "You" and radius circles
  useEffect(() => {
    const { circles, me: meLayer } = layersRef.current;
    circles.clearLayers();
    meLayer.clearLayers();

    if (me?.latitude == null || me?.longitude == null) return;

    // Outer & inner radius circles
    const outerCircle = L.circle([me.latitude, me.longitude], {
      radius: radiusKm * 1000,
      color: '#f07289',
      weight: 1.5,
      opacity: 0.5,
      dashArray: '6, 8',
      fillColor: '#f07289',
      fillOpacity: 0.06,
      interactive: false,
    });

    const innerCircle = L.circle([me.latitude, me.longitude], {
      radius: (radiusKm * 1000) / 2,
      color: '#f07289',
      weight: 1.2,
      opacity: 0.35,
      dashArray: '4, 6',
      fillColor: '#f07289',
      fillOpacity: 0.03,
      interactive: false,
    });

    circles.addLayer(outerCircle);
    circles.addLayer(innerCircle);

    // Pulse dot for "You"
    const meIcon = L.divIcon({
      className: 'leaflet-nearby-me-marker',
      html: `
        <div class="nearby-me" style="position:relative; width:0; height:0;">
          <span class="nearby-me-pulse"></span>
          <span class="nearby-me-dot"></span>
          <span class="nearby-me-label">You</span>
        </div>
      `,
      iconSize: [0, 0],
      iconAnchor: [0, 0],
    });

    const meMarker = L.marker([me.latitude, me.longitude], {
      icon: meIcon,
      interactive: false,
      zIndexOffset: 100,
    });

    meLayer.addLayer(meMarker);
  }, [me?.latitude, me?.longitude, radiusKm]);

  // Adjust center and zoom when position or radius changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || me?.latitude == null || me?.longitude == null) return;
    map.setView([me.latitude, me.longitude], getZoomForRadius(radiusKm), { animate: true });
  }, [radiusKm, me?.latitude, me?.longitude]);

  // Render friend markers
  useEffect(() => {
    const { friends: friendsLayer } = layersRef.current;
    friendsLayer.clearLayers();

    friends.forEach((n) => {
      if (n.latitude == null || n.longitude == null) return;

      const isOnline = Boolean(n.friend?.isOnline);
      const isOnlineClass = isOnline ? 'nearby-marker--online' : '';
      const isSelected = n.friend?.id === selectedId;
      const isSelectedClass = isSelected ? 'is-selected' : '';
      const label = `${firstName(n.friend?.name)} · ${n.distanceKm} km`;
      const initials = initialsOf(n.friend?.name || '');
      const bg = avatarColor(n.friend?.id || n.friend?.name || '');
      const photo = n.friend?.photoUrl;

      const faceHtml = photo
        ? `<img src="${photo}" alt="" style="width:100%;height:100%;border-radius:50%;object-fit:cover;" onerror="this.style.display='none';this.parentElement.textContent='${initials}'"/>`
        : initials;

      const html = `
        <div class="nearby-marker ${isOnlineClass} ${isSelectedClass}" style="position:relative;left:0;top:0;transform:none;" data-id="${n.friend?.id}">
          <div class="dc-avatar" style="width:42px;height:42px;">
            <div class="dc-avatar-face" style="background:${bg};font-size:15px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:600;">
              ${faceHtml}
            </div>
          </div>
          <span class="nearby-marker-label">${label}</span>
        </div>
      `;

      const icon = L.divIcon({
        className: 'leaflet-friend-marker',
        html,
        iconSize: [44, 60],
        iconAnchor: [22, 21],
      });

      const marker = L.marker([n.latitude, n.longitude], {
        icon,
        zIndexOffset: isSelected ? 500 : 200,
      });

      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        onSelect?.(selectedId === n.friend?.id ? null : n.friend?.id);
      });

      friendsLayer.addLayer(marker);
    });
  }, [friends, selectedId, onSelect]);

  // Track popover position above selected friend
  const selected = friends.find((f) => f.friend?.id === selectedId);

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
    map.on('move', updatePopover);
    map.on('zoom', updatePopover);

    return () => {
      map.off('move', updatePopover);
      map.off('zoom', updatePopover);
    };
  }, [updatePopover]);

  // Smoothly center on selected friend when selected
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selected || selected.latitude == null || selected.longitude == null) return;
    map.panTo([selected.latitude, selected.longitude], { animate: true });
  }, [selectedId, selected]);

  const handleCenter = () => {
    const map = mapRef.current;
    if (map && me?.latitude != null && me?.longitude != null) {
      map.setView([me.latitude, me.longitude], getZoomForRadius(radiusKm), { animate: true });
    }
    onCenter?.();
  };

  const handleZoomIn = () => {
    mapRef.current?.zoomIn();
    onZoomIn?.();
  };

  const handleZoomOut = () => {
    mapRef.current?.zoomOut();
    onZoomOut?.();
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
            <DiscoverAvatar
              id={selected.friend.id}
              name={selected.friend.name}
              photoUrl={selected.friend.photoUrl}
              online={selected.friend.isOnline}
              size={40}
            />
            <div>
              <span className="nearby-popover-name">{selected.friend.name}</span>
              <span className="nearby-popover-sub">
                {selected.distanceKm} km ·{' '}
                {selected.friend.isOnline
                  ? 'Online'
                  : `Shared ${timeAgo(selected.locationUpdatedAt) || 'earlier'}`}
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="dc-btn dc-btn--primary dc-btn--sm"
              onClick={() => onMessage(selected.friend.id)}
            >
              <MessageCircle size={16} aria-hidden="true" />
              Message
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
            <span className="nearby-popover-sub" role="alert">
              {waveState.message}
            </span>
          )}
        </div>
      )}

      <div className="nearby-map-controls">
        <button
          type="button"
          className="dc-icon-btn"
          aria-label="Zoom in"
          onClick={handleZoomIn}
          disabled={!canZoomIn || !!overlay}
        >
          <Plus size={18} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="dc-icon-btn"
          aria-label="Zoom out"
          onClick={handleZoomOut}
          disabled={!canZoomOut || !!overlay}
        >
          <Minus size={18} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="dc-icon-btn nearby-center-btn"
          aria-label="Center on me"
          onClick={handleCenter}
          disabled={!!overlay}
        >
          <LocateFixed size={18} aria-hidden="true" />
        </button>
      </div>

      {!overlay && (
        <>
          <div className="nearby-map-footer">
            <ShieldCheck size={14} aria-hidden="true" />
            Approximate locations{updatedAt ? ` · updated ${timeAgo(updatedAt)}` : ''}
          </div>
          <div className="nearby-map-scale">Radius = {radiusKm} km</div>
        </>
      )}

      {overlay && <div className="nearby-map-overlay">{overlay}</div>}
    </div>
  );
}
