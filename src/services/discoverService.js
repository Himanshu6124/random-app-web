/**
 * REST client for the Discover tab: Find friends, Nearby friends and Match history.
 * Every endpoint is registered-users only (guests get 403).
 */
import { BASE_URL, handleApiResponse, getAuthHeaders } from './authService';

const qs = (params) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  });
  const text = search.toString();
  return text ? `?${text}` : '';
};

const request = async (path, { method = 'GET', body, token, signal } = {}) => {
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: getAuthHeaders(token),
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal
  });
  return handleApiResponse(response);
};

/** Jackson writes boolean `isX` fields as `x`; accept both spellings. */
const flag = (obj, name) => Boolean(obj?.[name] ?? obj?.[`is${name[0].toUpperCase()}${name.slice(1)}`]);

const normalizeFriend = (f = {}) => ({
  ...f,
  name: f.name || f.username,
  isOnline: flag(f, 'online')
});

export const discoverService = {
  // ---------- Find friends ----------

  /** GET /users/search?q= → Page<UserSearchResultDto> */
  async searchPeople(query, { page = 0, size = 20, token, signal } = {}) {
    const data = await request(`/users/search${qs({ q: query, page, size })}`, { token, signal });
    return {
      results: (data?.content || []).map(u => ({ ...normalizeFriend(u), friendshipStatus: u.friendshipStatus || 'NONE' })),
      total: data?.totalElements ?? 0,
      last: data?.last ?? true
    };
  },

  // ---------- Nearby friends ----------

  getMyLocation(token) {
    return request('/location/me', { token });
  },

  /** Sends the device position; the server rounds it (~1 km) and turns sharing on. */
  updateMyLocation(latitude, longitude, token) {
    return request('/location/me', { method: 'PUT', body: { latitude, longitude }, token });
  },

  /** Turning sharing off deletes the stored position server-side. */
  setLocationSharing(enabled, token) {
    return request('/location/sharing', { method: 'PUT', body: { enabled }, token });
  },

  async getNearbyFriends(radiusKm, token) {
    const data = await request(`/location/friends/nearby${qs({ radiusKm })}`, { token });
    return {
      ...data,
      friends: (data?.friends || []).map(n => ({ ...n, friend: normalizeFriend(n.friend) }))
    };
  },

  waveAtFriend(friendId, token) {
    return request(`/location/friends/${encodeURIComponent(friendId)}/wave`, { method: 'POST', token });
  },

  // ---------- Match history ----------

  /** filter: all | friends | pending | ended | reported */
  async getMatchHistory({ filter = 'all', q = '', page = 0, size = 20, token } = {}) {
    const data = await request(`/matches/history${qs({ filter, q, page, size })}`, { token });
    return {
      items: (data?.content || []).map(normalizeHistoryItem),
      total: data?.totalElements ?? 0,
      last: data?.last ?? true
    };
  },

  getMatchHistoryStats(token) {
    return request('/matches/history/stats', { token });
  },

  clearMatchHistory(token) {
    return request('/matches/history', { method: 'DELETE', token });
  },

  removeMatchHistoryEntry(id, token) {
    return request(`/matches/history/${encodeURIComponent(id)}`, { method: 'DELETE', token });
  },

  async reportMatch(id, token) {
    return normalizeHistoryItem(await request(`/matches/history/${encodeURIComponent(id)}/report`, { method: 'POST', token }));
  },

  async blockMatch(id, token) {
    return normalizeHistoryItem(await request(`/matches/history/${encodeURIComponent(id)}/block`, { method: 'POST', token }));
  }
};

function normalizeHistoryItem(item = {}) {
  return {
    ...item,
    peerName: item.peerName || item.peerUsername || 'Unknown',
    peerGuest: flag(item, 'peerGuest'),
    peerOnline: flag(item, 'peerOnline'),
    reported: flag(item, 'reported')
  };
}
