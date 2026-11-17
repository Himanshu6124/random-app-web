/** Per-chat settings of a friend DM (currently: disappearing messages). */
import { BASE_URL, handleApiResponse, getAuthHeaders } from './authService';

/** Timers offered in the UI (seconds). 0 = off. Must match the server's allowed list. */
export const DISAPPEAR_OPTIONS = [
  { seconds: 0, label: 'Off', short: '' },
  { seconds: 3600, label: '1 hour', short: '1h' },
  { seconds: 6 * 3600, label: '6 hours', short: '6h' },
  { seconds: 12 * 3600, label: '12 hours', short: '12h' },
  { seconds: 24 * 3600, label: '24 hours', short: '24h' }
];

export const disappearLabel = (seconds) =>
  (DISAPPEAR_OPTIONS.find(o => o.seconds === seconds) || DISAPPEAR_OPTIONS[0]).label;

export const chatSettingsService = {
  async getDisappearing(conversationId, token) {
    const res = await fetch(`${BASE_URL}/conversations/${encodeURIComponent(conversationId)}/disappearing`, {
      headers: getAuthHeaders(token)
    });
    const data = await handleApiResponse(res);
    return Number(data?.seconds) || 0;
  },

  async setDisappearing(conversationId, seconds, token) {
    const res = await fetch(`${BASE_URL}/conversations/${encodeURIComponent(conversationId)}/disappearing`, {
      method: 'PUT',
      headers: getAuthHeaders(token),
      body: JSON.stringify({ conversationId, seconds })
    });
    const data = await handleApiResponse(res);
    return Number(data?.seconds) || 0;
  }
};
