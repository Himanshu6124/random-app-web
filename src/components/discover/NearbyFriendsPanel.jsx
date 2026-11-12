import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Search, MessageCircle, EyeOff, MapPin } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { discoverService } from '../../services/discoverService';
import { DiscoverAvatar } from './DiscoverAvatar';
import { NearbyMap } from './NearbyMap';
import { presenceLabel } from './discoverUtils';

const RADII = [1, 2, 5, 10, 25];
const ZOOMS = [0.5, 1, 2, 4];
const REFRESH_MS = 2 * 60 * 1000;

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

/** Nearby friends: a privacy-first map of accepted friends who share an approximate location. */
export function NearbyFriendsPanel({ onOpenChat, focusSharingToggle }) {
  const { jwtToken } = useAuth();
  const [radiusKm, setRadiusKm] = useState(5);
  const [zoomIdx, setZoomIdx] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [waveState, setWaveState] = useState(null);
  const toggleRef = useRef(null);

  const sharing = Boolean(data?.me?.sharing);

  const loadNearby = useCallback(async (radius = radiusKm) => {
    try {
      const res = await discoverService.getNearbyFriends(radius, jwtToken);
      setData(res);
      setError('');
    } catch (err) {
      setError(err.message || 'Could not load nearby friends.');
    } finally {
      setLoading(false);
    }
  }, [jwtToken, radiusKm]);

  /** Pushes a fresh device position (only ever while sharing is on), then reloads. */
  const refreshPosition = useCallback(async () => {
    const coords = await getDevicePosition();
    await discoverService.updateMyLocation(coords.latitude, coords.longitude, jwtToken);
    await loadNearby();
  }, [jwtToken, loadNearby]);

  // First load: read state; if already sharing, refresh the position silently.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mine = await discoverService.getMyLocation(jwtToken);
        if (cancelled) return;
        if (mine?.sharing) {
          await refreshPosition().catch(() => loadNearby());
        } else {
          await loadNearby();
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Could not load nearby friends.');
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jwtToken]);

  useEffect(() => {
    if (!sharing) return undefined;
    const timer = setInterval(() => { refreshPosition().catch(() => loadNearby()); }, REFRESH_MS);
    return () => clearInterval(timer);
  }, [sharing, refreshPosition, loadNearby]);

  useEffect(() => {
    if (focusSharingToggle) toggleRef.current?.focus();
  }, [focusSharingToggle]);

  const setSharing = async (enabled) => {
    setToggling(true);
    setError('');
    try {
      if (enabled) {
        await refreshPosition();
      } else {
        await discoverService.setLocationSharing(false, jwtToken);
        setSelectedId(null);
        await loadNearby();
      }
    } catch (err) {
      setError(err.message || 'Could not update location sharing.');
    } finally {
      setToggling(false);
    }
  };

  const changeRadius = (value) => {
    setRadiusKm(value);
    setZoomIdx(1);
    loadNearby(value);
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

  const friends = useMemo(() => data?.friends || [], [data]);
  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return friends;
    return friends.filter(n => n.friend.name?.toLowerCase().includes(q) || n.friend.username?.toLowerCase().includes(q));
  }, [friends, filter]);

  const overlay = loading ? (
    <div className="dc-card" aria-live="polite"><span className="dc-spinner" aria-hidden="true" /><p>Loading the map…</p></div>
  ) : !sharing ? (
    <div className="dc-card">
      <MapPin size={22} color="var(--dc-cyan)" aria-hidden="true" />
      <h2>Share your area to see friends</h2>
      <p>
        Nearby is mutual: friends who share appear here once you share too. They only ever see a
        position rounded to about 1 km, and strangers never see it. Turn it off any time and your
        position is deleted.
      </p>
      <button type="button" className="dc-btn dc-btn--primary dc-btn--sm" onClick={() => setSharing(true)} disabled={toggling}>
        <MapPin size={16} aria-hidden="true" />Share my location
      </button>
    </div>
  ) : null;

  const nearbyCount = friends.length;

  return (
    <>
      <div className="dc-page-head">
        <div className="dc-page-title">
          <h1>Nearby friends</h1>
          <p>Friends who share their location with you. Positions are rounded to protect privacy.</p>
        </div>
        <div className="nearby-head-controls" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
          <label className="dc-switch">
            <input
              ref={toggleRef}
              type="checkbox"
              role="switch"
              className="dc-sr-only"
              checked={sharing}
              disabled={toggling || loading}
              onChange={(e) => setSharing(e.target.checked)}
            />
            <span className="dc-switch-track" aria-hidden="true" />
            Share my location
          </label>
          <label>
            <span className="dc-sr-only">Search radius</span>
            <select className="dc-select" value={radiusKm} onChange={(e) => changeRadius(Number(e.target.value))}>
              {RADII.map(r => <option key={r} value={r}>Within {r} km</option>)}
            </select>
          </label>
        </div>
      </div>

      {error && <div className="dc-error" role="alert">{error}</div>}

      <div className="nearby-body">
        <NearbyMap
          me={data?.me}
          friends={sharing ? visible : []}
          radiusKm={data?.radiusKm || radiusKm}
          zoom={ZOOMS[zoomIdx]}
          canZoomIn={zoomIdx < ZOOMS.length - 1}
          canZoomOut={zoomIdx > 0}
          onZoomIn={() => setZoomIdx(i => Math.min(ZOOMS.length - 1, i + 1))}
          onZoomOut={() => setZoomIdx(i => Math.max(0, i - 1))}
          onCenter={() => { setZoomIdx(1); setSelectedId(null); refreshPosition().catch(err => setError(err.message)); }}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onMessage={onOpenChat}
          onWave={wave}
          waveState={waveState}
          updatedAt={data?.me?.updatedAt}
          overlay={overlay}
        />

        <section className="dc-card nearby-list" aria-labelledby="nearby-list-title">
          <div className="nearby-list-head">
            <h2 id="nearby-list-title">
              {sharing ? `${nearbyCount} ${nearbyCount === 1 ? 'friend' : 'friends'} nearby` : 'Friends nearby'}
            </h2>
            <span className="dc-muted" style={{ fontSize: 12 }}>Closest first</span>
          </div>

          <label className="dc-search dc-search--compact">
            <Search size={18} aria-hidden="true" />
            <span className="dc-sr-only">Filter nearby friends</span>
            <input type="search" placeholder="Filter friends" value={filter} onChange={(e) => setFilter(e.target.value)} disabled={!sharing} />
          </label>

          {!sharing ? (
            <div className="dc-empty">
              <EyeOff size={22} aria-hidden="true" />
              <span>Turn on location sharing to see who's around.</span>
            </div>
          ) : visible.length === 0 ? (
            <div className="dc-empty">
              <strong>{filter ? 'No match' : 'No friends in range'}</strong>
              <span>{filter ? 'No nearby friend matches that name.' : `Nobody is sharing within ${radiusKm} km right now. Try a wider radius.`}</span>
            </div>
          ) : (
            <ul className="dc-person-list" role="listbox" aria-label="Nearby friends">
              {visible.map(n => (
                <li
                  key={n.friend.id}
                  className="dc-person-row"
                  role="option"
                  aria-selected={selectedId === n.friend.id}
                  onClick={() => setSelectedId(n.friend.id)}
                >
                  <DiscoverAvatar id={n.friend.id} name={n.friend.name} photoUrl={n.friend.photoUrl} online={n.friend.isOnline} size={44} />
                  <div className="dc-person-text">
                    <span className="dc-person-name">{n.friend.name}</span>
                    <span className="dc-person-sub">{n.distanceKm} km away</span>
                  </div>
                  <span className={`nearby-presence${n.friend.isOnline ? ' nearby-presence--online' : ''}`}>
                    {presenceLabel(n.friend)}
                  </span>
                  <button
                    type="button"
                    className="dc-icon-btn"
                    aria-label={`Message ${n.friend.name}`}
                    onClick={(e) => { e.stopPropagation(); onOpenChat(n.friend.id); }}
                  >
                    <MessageCircle size={18} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {sharing && (data?.notSharingCount > 0 || data?.outOfRangeCount > 0) && (
            <p className="nearby-list-foot">
              <EyeOff size={14} aria-hidden="true" />
              {[
                data.notSharingCount > 0 && `${data.notSharingCount} ${data.notSharingCount === 1 ? 'friend isn’t' : 'friends aren’t'} sharing their location.`,
                data.outOfRangeCount > 0 && `${data.outOfRangeCount} farther than ${data.radiusKm} km.`
              ].filter(Boolean).join(' ')}
            </p>
          )}
        </section>
      </div>
    </>
  );
}
