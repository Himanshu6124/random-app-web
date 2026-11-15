import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Search, MessageCircle, EyeOff, MapPin, Users } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { discoverService } from '../../services/discoverService';
import { DiscoverAvatar } from './DiscoverAvatar';
import { FriendshipButton } from './FriendshipButton';
import { NearbyMap } from './NearbyMap';
import { presenceLabel } from './discoverUtils';

const REFRESH_MS = 2 * 60 * 1000;
const PAGE_SIZE = 50;
const VIEW_DEBOUNCE_MS = 300;

function getDevicePosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('This browser cannot share a location.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(pos.coords),
      (err) => reject(new Error(err.code === 1
        ? 'Location permission was denied. Allow it in your browser settings to share.'
        : 'Could not get your location. Please try again.')),
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 }
    );
  });
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/**
 * Nearby: a map of everyone around you (friends, plus people who share with everyone).
 * It opens on a ~12 km area around you; the list always follows what the map shows, so
 * zooming out brings in more people. Crowded spots are grouped into numbered clusters.
 */
export function NearbyPanel({ onOpenChat, focusSharingToggle }) {
  const { jwtToken } = useAuth();
  const [me, setMe] = useState(null);
  const [view, setView] = useState(null);
  const [data, setData] = useState(null);
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchingView, setFetchingView] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');
  const [selected, setSelected] = useState(null);
  const [waveState, setWaveState] = useState(null);
  const [statusOverrides, setStatusOverrides] = useState({});
  const [reloadTick, setReloadTick] = useState(0);
  const toggleRef = useRef(null);

  const sharing = Boolean(me?.sharing);
  const everyone = Boolean(me?.visibleToEveryone);

  /** Pushes a fresh device position (only while sharing), optionally changing who sees it. */
  const refreshPosition = useCallback(async (visibleToEveryone) => {
    const coords = await getDevicePosition();
    const mine = await discoverService.updateMyLocation(coords.latitude, coords.longitude, jwtToken, visibleToEveryone);
    setMe(mine);
    setReloadTick(t => t + 1);
  }, [jwtToken]);

  // First load: read state; if already sharing, refresh the position silently.
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

  useEffect(() => {
    if (focusSharingToggle) toggleRef.current?.focus();
  }, [focusSharingToggle]);

  const viewQuery = useMemo(() => {
    if (!view) return null;
    const b = view.bounds;
    return { south: b.getSouth(), west: b.getWest(), north: b.getNorth(), east: b.getEast(), zoom: view.zoom };
  }, [view]);

  // Everyone in the current map view, re-read whenever the map settles.
  useEffect(() => {
    if (!sharing || !viewQuery || me?.latitude == null) {
      setData(null);
      setPeople([]);
      return undefined;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setFetchingView(true);
      try {
        const res = await discoverService.getNearbyInView({ ...viewQuery, limit: PAGE_SIZE }, jwtToken, controller.signal);
        setData(res);
        setPeople(res.people);
        setError('');
      } catch (err) {
        if (err.name !== 'AbortError') setError(err.message || 'Could not load people nearby.');
      } finally {
        if (!controller.signal.aborted) setFetchingView(false);
      }
    }, VIEW_DEBOUNCE_MS);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [sharing, viewQuery, me?.latitude, me?.longitude, me?.visibleToEveryone, reloadTick, jwtToken]);

  const loadMore = async () => {
    if (!viewQuery) return;
    setLoadingMore(true);
    try {
      const res = await discoverService.getNearbyInView({ ...viewQuery, offset: people.length, limit: PAGE_SIZE }, jwtToken);
      setPeople(prev => [...prev, ...res.people.filter(p => !prev.some(q => q.id === p.id))]);
      setData(d => ({ ...d, hasMore: res.hasMore }));
    } catch (err) {
      setError(err.message || 'Could not load more people.');
    } finally {
      setLoadingMore(false);
    }
  };

  const setSharing = async (enabled, visibleToEveryone) => {
    setToggling(true);
    setError('');
    try {
      if (enabled) {
        await refreshPosition(visibleToEveryone);
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

  const setVisibility = async (visibleToEveryone) => {
    setToggling(true);
    setError('');
    try {
      setMe(await discoverService.setLocationSharing(true, jwtToken, visibleToEveryone));
      setSelected(null);
    } catch (err) {
      setError(err.message || 'Could not update who can see you.');
    } finally {
      setToggling(false);
    }
  };

  const wave = async (friendId) => {
    setWaveState({ id: friendId, status: 'sending' });
    try {
      await discoverService.waveAtFriend(friendId, jwtToken);
      setWaveState({ id: friendId, status: 'sent' });
    } catch (err) {
      setWaveState({ id: friendId, status: 'error', message: err.message || 'Could not wave.' });
    }
  };

  // Friend requests sent from here update the row, marker and popover without a refetch.
  const withStatus = useCallback((p) => {
    const status = statusOverrides[p.id];
    return status ? { ...p, friendshipStatus: status, friend: status === 'ACCEPTED' } : p;
  }, [statusOverrides]);
  const onStatusChange = (id, status) => setStatusOverrides(s => ({ ...s, [id]: status }));

  const markers = useMemo(
    () => (data?.markers || []).map(m => (m.person ? { ...m, person: withStatus(m.person) } : m)),
    [data, withStatus]
  );
  const listed = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const all = people.map(withStatus);
    if (!q) return all;
    return all.filter(p => p.name?.toLowerCase().includes(q) || p.username?.toLowerCase().includes(q));
  }, [people, filter, withStatus]);
  const selectedNow = selected ? withStatus(selected) : null;

  const total = data?.total ?? 0;
  const friendCount = data?.friendCount ?? 0;

  const overlay = loading ? (
    <div className="dc-card" aria-live="polite"><span className="dc-spinner" aria-hidden="true" /><p>Loading the map…</p></div>
  ) : !sharing ? (
    <div className="dc-card">
      <MapPin size={22} color="var(--dc-cyan)" aria-hidden="true" />
      <h2>See who's around you</h2>
      <p>
        Share your area to see people within about 12 km, and zoom out to look farther. Others only
        ever see a position rounded to about 1 km, never your exact spot. Turn it off any time and
        your position is deleted.
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
        <button type="button" className="dc-btn dc-btn--primary dc-btn--sm" onClick={() => setSharing(true, true)} disabled={toggling}>
          <MapPin size={16} aria-hidden="true" />Share with everyone
        </button>
        <button type="button" className="dc-btn dc-btn--soft dc-btn--sm" onClick={() => setSharing(true, false)} disabled={toggling}>
          <Users size={16} aria-hidden="true" />Friends only
        </button>
      </div>
    </div>
  ) : null;

  const emptyText = filter
    ? 'Nobody on the map matches that name.'
    : everyone
      ? 'Nobody is sharing in this area right now. Zoom out to look farther.'
      : 'No friends in this area. You share with friends only, so strangers are hidden. Zoom out, or share with everyone to see people nearby.';

  return (
    <>
      <div className="dc-page-head">
        <div className="dc-page-title">
          <h1>Nearby</h1>
          <p>People around you on the map. Positions are rounded to about 1 km to protect privacy.</p>
        </div>
        <div className="nearby-head-controls" style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center' }}>
          <label className="dc-switch">
            <input
              ref={toggleRef}
              type="checkbox"
              role="switch"
              className="dc-sr-only"
              checked={sharing}
              disabled={toggling || loading}
              onChange={(e) => setSharing(e.target.checked, e.target.checked ? true : undefined)}
            />
            <span className="dc-switch-track" aria-hidden="true" />
            Share my location
          </label>
          {sharing && (
            <label className="dc-switch">
              <input
                type="checkbox"
                role="switch"
                className="dc-sr-only"
                checked={everyone}
                disabled={toggling}
                onChange={(e) => setVisibility(e.target.checked)}
              />
              <span className="dc-switch-track" aria-hidden="true" />
              Visible to everyone
            </label>
          )}
        </div>
      </div>

      {error && <div className="dc-error" role="alert">{error}</div>}

      <div className="nearby-body">
        <NearbyMap
          me={me}
          markers={sharing ? markers : []}
          onViewChange={setView}
          onCenter={() => { setSelected(null); refreshPosition().catch(err => setError(err.message)); }}
          selected={selectedNow}
          onSelect={setSelected}
          onMessage={onOpenChat}
          onWave={wave}
          waveState={waveState}
          onStatusChange={onStatusChange}
          onError={setError}
          updatedAt={me?.updatedAt}
          overlay={overlay}
        />

        <section className="dc-card nearby-list" aria-labelledby="nearby-list-title" aria-busy={fetchingView}>
          <div className="nearby-list-head">
            <h2 id="nearby-list-title">
              {sharing ? `${plural(total, 'person', 'people')} in this area` : 'People nearby'}
            </h2>
            {sharing && friendCount > 0 && (
              <span className="nearby-friend-tag nearby-friend-tag--inline">{plural(friendCount, 'friend', 'friends')}</span>
            )}
          </div>
          {sharing && <span className="dc-muted" style={{ fontSize: 12, marginTop: -6 }}>Friends first, then closest · zoom the map to change the area</span>}

          <label className="dc-search dc-search--compact">
            <Search size={18} aria-hidden="true" />
            <span className="dc-sr-only">Filter people on the map</span>
            <input type="search" placeholder="Filter by name" value={filter} onChange={(e) => setFilter(e.target.value)} disabled={!sharing} />
          </label>

          {!sharing ? (
            <div className="dc-empty">
              <EyeOff size={22} aria-hidden="true" />
              <span>Turn on location sharing to see who's around.</span>
            </div>
          ) : listed.length === 0 ? (
            <div className="dc-empty">
              <strong>{filter ? 'No match' : fetchingView && !data ? 'Looking around…' : 'Nobody here yet'}</strong>
              {!(fetchingView && !data) && <span>{emptyText}</span>}
            </div>
          ) : (
            <ul className="dc-person-list" role="listbox" aria-label="People on the map">
              {listed.map(p => (
                <li
                  key={p.id}
                  className="dc-person-row"
                  role="option"
                  aria-selected={selected?.id === p.id}
                  onClick={() => setSelected(p)}
                >
                  <DiscoverAvatar id={p.id} name={p.name} photoUrl={p.photoUrl} online={p.isOnline} size={44} />
                  <div className="dc-person-text">
                    <span className="dc-person-name">
                      {p.name}
                      {p.friend && <span className="nearby-friend-tag nearby-friend-tag--inline">Friend</span>}
                    </span>
                    <span className="dc-person-sub">{p.distanceKm} km away · {presenceLabel(p)}</span>
                  </div>
                  {p.friend ? (
                    <button
                      type="button"
                      className="dc-icon-btn"
                      aria-label={`Message ${p.name}`}
                      onClick={(e) => { e.stopPropagation(); onOpenChat(p.id); }}
                    >
                      <MessageCircle size={18} aria-hidden="true" />
                    </button>
                  ) : (
                    <span onClick={(e) => e.stopPropagation()}>
                      <FriendshipButton
                        personId={p.id}
                        name={p.name}
                        status={p.friendshipStatus}
                        size="sm"
                        onStatusChange={(status) => onStatusChange(p.id, status)}
                        onMessage={() => onOpenChat(p.id)}
                        onError={setError}
                      />
                    </span>
                  )}
                </li>
              ))}
              {data?.hasMore && !filter && (
                <li style={{ listStyle: 'none', padding: '10px 0', textAlign: 'center' }}>
                  <button type="button" className="dc-btn dc-btn--soft dc-btn--sm" onClick={loadMore} disabled={loadingMore}>
                    {loadingMore ? 'Loading…' : `Show more (${total - people.length} left)`}
                  </button>
                </li>
              )}
            </ul>
          )}

          {sharing && data && (data.truncated || !everyone) && (
            <p className="nearby-list-foot">
              <EyeOff size={14} aria-hidden="true" />
              {[
                !everyone && 'You share with friends only, so only friends are shown.',
                data.truncated && 'This area is very busy; zoom in to see everyone.'
              ].filter(Boolean).join(' ')}
            </p>
          )}
        </section>
      </div>
    </>
  );
}
