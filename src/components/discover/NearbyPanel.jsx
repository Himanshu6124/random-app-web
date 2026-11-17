import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MapPin, MessageCircle, Sparkles } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { discoverService } from '../../services/discoverService';
import { DiscoverAvatar } from './DiscoverAvatar';
import { FriendshipButton } from './FriendshipButton';
import { NearbyMap } from './NearbyMap';
import { presenceLabel } from './discoverUtils';

const REFRESH_MS = 2 * 60 * 1000;
const PAGE_SIZE = 100;
const VIEW_DEBOUNCE_MS = 300;
const GENDERS = [
  { id: 'all', label: 'All' },
  { id: 'boy', label: 'Male' },
  { id: 'girl', label: 'Female' },
  { id: 'other', label: 'Other' },
];

function getDevicePosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('This browser cannot share a location.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(pos.coords),
      (err) => reject(new Error(err.code === 1
        ? 'Location permission was denied. Allow it in your browser settings.'
        : 'Could not get your location. Please try again.')),
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 }
    );
  });
}

const lastSeenMs = (p) => (p.isOnline ? Date.now() : new Date(p.lastOnline || p.locationUpdatedAt || 0).getTime());

/**
 * Nearby: All / Male / Female / Other filter, a big map, and a horizontal strip of the people on it
 * (online first, then most recently active, then closest). The first visit asks once to turn on
 * your own (rounded) location, since seeing others requires sharing yours; after that it stays on.
 */
export function NearbyPanel({ onOpenChat }) {
  const { jwtToken } = useAuth();
  const [me, setMe] = useState(null);
  const [view, setView] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [error, setError] = useState('');
  const [gender, setGender] = useState('all');
  const [selected, setSelected] = useState(null);
  const [statusOverrides, setStatusOverrides] = useState({});
  const [reloadTick, setReloadTick] = useState(0);
  const stripRef = useRef(null);

  const sharing = Boolean(me?.sharing);

  /** Pushes a fresh device position; sharing is always visible to everyone. */
  const refreshPosition = useCallback(async () => {
    const coords = await getDevicePosition();
    const mine = await discoverService.updateMyLocation(coords.latitude, coords.longitude, jwtToken, true);
    setMe(mine);
    setReloadTick(t => t + 1);
  }, [jwtToken]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mine = await discoverService.getMyLocation(jwtToken);
        if (cancelled) return;
        setMe(mine);
        if (mine?.sharing) await refreshPosition().catch(() => {});
      } catch (err) {
        if (!cancelled) setError(err.message || 'Could not load Nearby.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jwtToken]);

  useEffect(() => {
    if (!sharing) return undefined;
    const timer = setInterval(() => { refreshPosition().catch(() => setReloadTick(t => t + 1)); }, REFRESH_MS);
    return () => clearInterval(timer);
  }, [sharing, refreshPosition]);

  const viewQuery = useMemo(() => {
    if (!view) return null;
    const b = view.bounds;
    return { south: b.getSouth(), west: b.getWest(), north: b.getNorth(), east: b.getEast(), zoom: view.zoom };
  }, [view]);

  // Everyone in the current map view, re-read whenever the map settles or the filter changes.
  useEffect(() => {
    if (!sharing || !viewQuery || me?.latitude == null) {
      setData(null);
      return undefined;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await discoverService.getNearbyInView({ ...viewQuery, limit: PAGE_SIZE, gender }, jwtToken, controller.signal);
        setData(res);
        setError('');
      } catch (err) {
        if (err.name !== 'AbortError') setError(err.message || 'Could not load people nearby.');
      }
    }, VIEW_DEBOUNCE_MS);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [sharing, viewQuery, me?.latitude, me?.longitude, gender, reloadTick, jwtToken]);

  const setSharing = async (enabled) => {
    setToggling(true);
    setError('');
    try {
      if (enabled) {
        await refreshPosition();
      } else {
        setMe(await discoverService.setLocationSharing(false, jwtToken));
        setSelected(null);
      }
    } catch (err) {
      setError(err.message || 'Could not update location sharing.');
    } finally {
      setToggling(false);
    }
  };

  const withStatus = useCallback((p) => {
    const status = statusOverrides[p.id];
    return status ? { ...p, friendshipStatus: status, friend: status === 'ACCEPTED' } : p;
  }, [statusOverrides]);
  const onStatusChange = (id, status) => setStatusOverrides(s => ({ ...s, [id]: status }));

  const markers = useMemo(
    () => (data?.markers || []).map(m => (m.person ? { ...m, person: withStatus(m.person) } : m)),
    [data, withStatus]
  );
  // Online first, then most recently active, then closest.
  const people = useMemo(
    () => (data?.people || []).map(withStatus).sort((a, b) =>
      (Number(b.isOnline) - Number(a.isOnline))
      || (lastSeenMs(b) - lastSeenMs(a))
      || (a.distanceKm - b.distanceKm)),
    [data, withStatus]
  );
  const selectedNow = selected ? withStatus(selected) : null;

  // Keep the selected person's card in view when they are picked on the map.
  useEffect(() => {
    if (!selected) return;
    stripRef.current?.querySelector(`[data-person="${CSS.escape(selected.id)}"]`)
      ?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [selected]);

  const overlay = loading ? (
    <div className="dc-card" aria-live="polite"><span className="dc-spinner" aria-hidden="true" /><p>Loading the map…</p></div>
  ) : !sharing ? (
    <div className="dc-card">
      <MapPin size={22} color="var(--dc-cyan)" aria-hidden="true" />
      <h2>See who's around you</h2>
      <p>To see people nearby, you need to turn on your location too. Others only see your rough area (~1 km).</p>
      <button type="button" className="dc-btn dc-btn--primary dc-btn--sm" onClick={() => setSharing(true)} disabled={toggling}>
        <MapPin size={16} aria-hidden="true" />{toggling ? 'Getting location…' : 'Turn on my location'}
      </button>
    </div>
  ) : null;

  return (
    <div className="nearby-panel">
      <div className="nearby-toolbar">
        <div className="nearby-gender" role="tablist" aria-label="Show">
          {GENDERS.map(g => (
            <button
              key={g.id}
              type="button"
              role="tab"
              aria-selected={gender === g.id}
              className={gender === g.id ? 'is-active' : ''}
              onClick={() => { setGender(g.id); setSelected(null); }}
            >
              {g.label}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="dc-error" role="alert">{error}</div>}

      <NearbyMap
        me={me}
        markers={sharing ? markers : []}
        onViewChange={setView}
        onCenter={() => { setSelected(null); refreshPosition().catch(err => setError(err.message)); }}
        selected={selectedNow}
        onSelect={setSelected}
        onMessage={onOpenChat}
        onStatusChange={onStatusChange}
        onError={setError}
        updatedAt={me?.updatedAt}
        overlay={overlay}
      />

      {sharing && (
        <div className="nearby-strip" ref={stripRef} aria-label="People nearby">
          {data && people.length === 0 && (
            <div className="nearby-strip__empty">Nobody here right now. Zoom out to look farther.</div>
          )}
          {people.map(p => (
            <div
              key={p.id}
              data-person={p.id}
              className={`nearby-card${selected?.id === p.id ? ' is-selected' : ''}`}
              onClick={() => setSelected(p)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter') setSelected(p); }}
            >
              <DiscoverAvatar id={p.id} name={p.name} photoUrl={p.photoUrl} online={p.isOnline} size={48} />
              <span className="nearby-card__name">
                {p.name}
                {String(p.id).startsWith('bot-') && <span className="dc-ai-badge"><Sparkles size={10} aria-hidden="true" />AI</span>}
              </span>
              <span className="nearby-card__sub">{p.distanceKm} km · {p.isOnline ? 'Online' : presenceLabel(p).replace('Active ', '')}</span>
              <span onClick={(e) => e.stopPropagation()}>
                {String(p.id).startsWith('bot-') ? null : p.friend ? (
                  <button type="button" className="dc-btn dc-btn--soft dc-btn--sm" onClick={() => onOpenChat(p.id)}>
                    <MessageCircle size={14} aria-hidden="true" />Chat
                  </button>
                ) : (
                  <FriendshipButton
                    personId={p.id}
                    name={p.name}
                    status={p.friendshipStatus}
                    size="sm"
                    onStatusChange={(status) => onStatusChange(p.id, status)}
                    onMessage={() => onOpenChat(p.id)}
                    onError={setError}
                  />
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
