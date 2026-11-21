import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MapPin, MessageCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { isBotBlocked, useBotRelationsVersion } from '../../services/botPeers';
import { discoverService } from '../../services/discoverService';
import { DiscoverAvatar } from './DiscoverAvatar';
import { FriendshipButton } from './FriendshipButton';
import { NearbyMap } from './NearbyMap';
import { presenceLabel } from './discoverUtils';
import { useProfileCard } from '../ProfileCard';

const REFRESH_MS = 2 * 60 * 1000;
const PAGE_SIZE = 100;
/** People list under the map: loaded a page at a time as the strip scrolls. */
const LIST_PAGE_SIZE = 30;
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

/**
 * Nearby: All / Male / Female / Other filter, a big map, and a horizontal strip of everyone
 * sharing a location (not only those in view), paged as it scrolls: online first, then recently
 * active, each group nearest first. Tapping one flies the map to them. When nobody is in the first
 * view, the map zooms out to the nearest person. The first visit asks once to turn on
 * your own (rounded) location, since seeing others requires sharing yours; after that it stays on.
 */
export function NearbyPanel({ onOpenChat }) {
  const { jwtToken, user } = useAuth();
  const botRelationsVersion = useBotRelationsVersion();
  const { openProfile } = useProfileCard();
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
  const [list, setList] = useState({ items: [], hasMore: false, total: 0, nearest: null, loaded: false });
  const [listLoading, setListLoading] = useState(false);
  const [focusTarget, setFocusTarget] = useState(null);
  const stripRef = useRef(null);
  const listReqRef = useRef(0);
  const autoZoomedRef = useRef(false);

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

  // The people list: everyone visible anywhere, a page at a time.
  const loadList = useCallback(async (reset) => {
    if (!sharing || me?.latitude == null) return;
    const reqId = ++listReqRef.current;
    setListLoading(true);
    try {
      const offset = reset ? 0 : list.items.length;
      const res = await discoverService.getNearbyPeople({ offset, limit: LIST_PAGE_SIZE, gender }, jwtToken);
      if (reqId !== listReqRef.current) return;
      setList(prev => {
        const base = reset ? [] : prev.items;
        const seen = new Set(base.map(p => p.id));
        return {
          items: [...base, ...res.people.filter(p => !seen.has(p.id))],
          hasMore: Boolean(res.hasMore),
          total: res.total ?? 0,
          nearest: res.nearestLatitude != null ? { latitude: res.nearestLatitude, longitude: res.nearestLongitude } : null,
          loaded: true
        };
      });
    } catch (err) {
      if (reqId === listReqRef.current) setError(err.message || 'Could not load people nearby.');
    } finally {
      if (reqId === listReqRef.current) setListLoading(false);
    }
  }, [sharing, me?.latitude, list.items.length, gender, jwtToken]);

  // Fresh first page whenever sharing, position or filter changes.
  useEffect(() => {
    if (!sharing || me?.latitude == null) {
      setList({ items: [], hasMore: false, total: 0, nearest: null, loaded: false });
      return;
    }
    loadList(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sharing, me?.latitude, me?.longitude, gender, jwtToken]);

  useEffect(() => { autoZoomedRef.current = false; }, [gender]);

  // Nobody in the first view: zoom out just far enough to show the nearest person (once per filter).
  useEffect(() => {
    if (autoZoomedRef.current || !data || !list.loaded) return;
    autoZoomedRef.current = true;
    if ((data.markers || []).length === 0 && list.nearest) {
      setFocusTarget({ ...list.nearest, withMe: true, key: Date.now() });
    }
  }, [data, list.loaded, list.nearest]);

  const onStripScroll = (e) => {
    const el = e.currentTarget;
    if (list.hasMore && !listLoading && el.scrollLeft + el.clientWidth > el.scrollWidth - 320) loadList(false);
  };

  const pickFromList = (p) => {
    setSelected(p);
    setFocusTarget({ latitude: p.latitude, longitude: p.longitude, key: Date.now() });
  };

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

  // The server hides people you blocked from Nearby; bots blocked on this device are hidden here.
  const markers = useMemo(
    () => (data?.markers || [])
      .filter(m => !(m.person && isBotBlocked(user?.id, m.person.id)))
      .map(m => (m.person ? { ...m, person: withStatus(m.person) } : m)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, withStatus, user?.id, botRelationsVersion]
  );
  // Already ordered by the server: online, then recently active, each group nearest first.
  const people = useMemo(
    () => list.items.filter(p => !isBotBlocked(user?.id, p.id)).map(withStatus),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [list.items, withStatus, user?.id, botRelationsVersion]
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
        onViewProfile={(p) => openProfile(p)}
        focusTarget={focusTarget}
        updatedAt={me?.updatedAt}
        overlay={overlay}
      />

      {sharing && (
        <div className="nearby-strip" ref={stripRef} aria-label="People nearby" onScroll={onStripScroll}>
          {list.loaded && people.length === 0 && (
            <div className="nearby-strip__empty">Nobody is sharing their location yet. Check back soon.</div>
          )}
          {people.map(p => (
            <div
              key={p.id}
              data-person={p.id}
              className={`nearby-card${selected?.id === p.id ? ' is-selected' : ''}`}
              onClick={() => pickFromList(p)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter') pickFromList(p); }}
            >
              <DiscoverAvatar id={p.id} name={p.name} photoUrl={p.photoUrl} online={p.isOnline} size={48} />
              <span className="nearby-card__name">
                {p.name}
              </span>
              <span className="nearby-card__sub">{formatKm(p.distanceKm)} · {p.isOnline ? 'Online' : presenceLabel(p).replace('Active ', '')}</span>
              <span onClick={(e) => e.stopPropagation()}>
                {p.friend ? (
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
          {listLoading && list.items.length > 0 && (
            <div className="nearby-card nearby-card--loading" aria-live="polite">
              <span className="dc-spinner" aria-hidden="true" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** "800 m", "4.2 km", "1,240 km": short and readable for near and far people alike. */
function formatKm(km) {
  if (km == null) return '';
  if (km < 1) return '<1 km';
  if (km >= 100) return `${Math.round(km).toLocaleString()} km`;
  return `${km} km`;
}
