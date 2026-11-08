import { Client, ReconnectionTimeMode } from '@stomp/stompjs';
import { authService } from './authService';

const DEV = Boolean(import.meta.env && import.meta.env.DEV);

/** Chat payload logging is noisy and privacy sensitive: dev builds only. */
const log = (...args) => {
  if (DEV) console.log(...args);
};

const PRESENCE_HEARTBEAT_MS = 20000;
const TYPING_REPEAT_MS = 2500;
const SEARCH_REFRESH_MS = 30000;
const ROOM_PREFIX = '/topic/conversations/';
const MATCH_QUEUE = '/user/queue/random-match';
const NOTIFICATIONS_QUEUE = '/user/queue/notifications';
const ERRORS_QUEUE = '/user/queue/errors';

/** Must match MessageLimits.MAX_MESSAGE_LENGTH on the server. */
export const MAX_MESSAGE_LENGTH = 4000;

/**
 * Extracts a friendly peer display name from various payload formats.
 */
export function extractPeerName(payload) {
  if (!payload) return 'Random Stranger';
  if (typeof payload === 'string' && payload.trim()) return payload.trim();

  const candidates = [
    payload.friendUserName,
    payload.friendName,
    payload.name,
    payload.userName,
    payload.user?.name,
    payload.friend?.name,
    payload.matchedUser?.name,
    payload.nickname,
    payload.partnerName,
    payload.strangerName,
    payload.peerName,
    payload.friendUsername,
    payload.username,
    payload.user?.username,
    payload.friend?.username,
    payload.matchedUser?.username
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }

  return 'Random Stranger';
}

/**
 * SocketService - Handles STOMP WebSocket communication with chat-backend.
 *
 * Clients only ever publish to /app/* and only ever subscribe to /user/queue/**
 * and /topic/conversations/{id}; the server rejects anything else.
 */
export class SocketService {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.authToken = '';
    this.activeUserId = '';
    this.callbacks = {};
    this.wsPath = '/ws-chat';

    // Desired subscriptions survive a drop, live handles do not. On reconnect the
    // whole desired registry is replayed, otherwise the client goes silently deaf.
    this.desiredSubscriptions = new Map(); // destination -> handler
    this.liveSubscriptions = new Map();    // destination -> StompSubscription

    // Several rooms can be open at once (random chat + an open DM thread)
    this.roomListeners = new Map();        // conversationId -> Set<listener>
    this.activeConversationId = null;

    // Matchmaking state
    this._pendingMatchmaking = null;
    this._lastHandledMatchConvId = null;
    this._isSearching = false;
    this._searchRefresh = null;

    this._presenceHeartbeat = null;
    this._typingState = new Map();         // conversationId -> { active, lastSent }
    this._authExpired = false;
    this._firstConnect = true;
    this._networkListenersBound = false;
    this._onWindowOnline = null;
    this._onWindowOffline = null;
  }

  // ==========================================
  // Connection lifecycle
  // ==========================================

  /**
   * Initializes STOMP Client connection.
   */
  connect(url = '/ws-chat', token = '', userId = '', callbacks = {}) {
    this.disconnect();

    this.authToken = token || '';
    this.activeUserId = userId || '';
    this.callbacks = callbacks;
    this.wsPath = url.startsWith('/') ? url : `/${url}`;
    this._authExpired = false;
    this._firstConnect = true;

    if (!this.authToken) {
      console.warn('[SocketService] Cannot connect without auth token');
      return;
    }

    this._bindNetworkListeners();

    this.client = new Client({
      brokerURL: this._buildBrokerUrl(this.authToken),
      // Exponential backoff with jitter: a fixed timer makes every client in the
      // fleet retry in lockstep after an outage.
      reconnectDelay: 2000,
      reconnectTimeMode: ReconnectionTimeMode.EXPONENTIAL,
      maxReconnectDelay: 60000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      debug: () => {},
      beforeConnect: async () => {
        // Always connect with the token that is current *now*, not the one captured
        // when the client was built (it may have been refreshed by a guest upgrade).
        const token = authService.getToken() || this.authToken;
        if (!token || this._isTokenExpired(token)) {
          this._handleAuthFailure();
          return;
        }
        this.authToken = token;
        this.client.brokerURL = this._buildBrokerUrl(token);

        if (!this._firstConnect) {
          const jitter = Math.floor(Math.random() * 1500);
          if (jitter > 0) {
            await new Promise(resolve => setTimeout(resolve, jitter));
          }
        }
      },
      onConnect: (frame) => {
        this.isConnected = true;
        this._firstConnect = false;
        this._authExpired = false;
        log('✅ [SocketService] Connected to STOMP broker');

        // Handles from the previous session are dead objects: re-SUBSCRIBE everything.
        this.liveSubscriptions.clear();
        if (this.activeUserId) {
          this.subscribeUserNotifications(this.activeUserId);
          this.subscribeUserErrors();
        }
        this._replayDesiredSubscriptions();

        // Advertise global presence, then presence in every room we hold open
        this.sendOnline(null, true);
        for (const conversationId of this._roomIds()) {
          this.sendOnline(conversationId, true);
        }

        if (this._presenceHeartbeat) clearInterval(this._presenceHeartbeat);
        this._presenceHeartbeat = setInterval(() => {
          if (this.isConnected) {
            this.sendOnline(null, true);
          }
        }, PRESENCE_HEARTBEAT_MS);

        // Resume (or start) a search that is still owned by the UI
        if (this._pendingMatchmaking || this._isSearching) {
          const pending = this._pendingMatchmaking;
          this._pendingMatchmaking = null;
          this.startMatchmaking(pending || {});
        }

        if (this.callbacks.onConnect) {
          this.callbacks.onConnect(frame);
        }
      },
      onStompError: (frame) => {
        console.error('❌ [SocketService] STOMP error:', frame?.headers?.message || 'protocol error');
        if (this.callbacks.onError) {
          this.callbacks.onError(frame?.headers?.message || 'STOMP Protocol Error');
        }
      },
      onWebSocketClose: (evt) => {
        this._markDisconnected();
        log('🔌 [SocketService] WebSocket connection closed');
        // 1008 / 4401 means the handshake was rejected: retrying forever is pointless.
        if (evt && (evt.code === 1008 || evt.code === 4401)) {
          this._handleAuthFailure();
        }
        if (this.callbacks.onDisconnect) {
          this.callbacks.onDisconnect();
        }
      },
      onDisconnect: () => {
        this._markDisconnected();
        log('🔌 [SocketService] STOMP Client disconnected');
        if (this.callbacks.onDisconnect) {
          this.callbacks.onDisconnect();
        }
      }
    });

    this.client.activate();
  }

  disconnect() {
    if (this._presenceHeartbeat) {
      clearInterval(this._presenceHeartbeat);
      this._presenceHeartbeat = null;
    }

    // Rooms are left by the server's own disconnect cleanup once the socket drops,
    // so we only drop the waiting matchmaking ticket and our presence here.
    this.cancelMatchmaking({ notifyServer: true });
    this.sendOnline(null, false);

    this.desiredSubscriptions.clear();
    this.liveSubscriptions.clear();
    this.roomListeners.clear();
    this._typingState.clear();
    this._pendingMatchmaking = null;
    this._lastHandledMatchConvId = null;

    if (this.client) {
      try {
        this.client.deactivate();
      } catch (e) {
        console.warn('[SocketService] Error deactivating STOMP client:', e);
      }
      this.client = null;
    }

    this._unbindNetworkListeners();
    this.isConnected = false;
    this.activeConversationId = null;
  }

  /**
   * Updates the auth token on an active connection without dropping the WebSocket.
   * Also updates brokerURL so reconnects use the refreshed token.
   */
  updateToken(token) {
    if (!token) return;
    this.authToken = token;
    if (this.client) {
      this.client.brokerURL = this._buildBrokerUrl(token);
    }
  }

  _buildBrokerUrl(token) {
    const envBackend = (import.meta.env.VITE_BACKEND_URL || '').replace(/\/+$/, '');
    let wsBase;
    if (envBackend) {
      wsBase = envBackend.replace(/^http/, 'ws');
    } else {
      const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
      const host = typeof window !== 'undefined' ? window.location.host : 'localhost:8080';
      wsBase = `${isHttps ? 'wss' : 'ws'}://${host}`;
    }
    return `${wsBase}${this.wsPath}?token=${encodeURIComponent(token)}`;
  }

  /** Reads `exp` out of the JWT without verifying it (the server still does that). */
  _isTokenExpired(token) {
    try {
      const part = String(token).split('.')[1];
      if (!part) return false;
      const payload = JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/')));
      return typeof payload.exp === 'number' && payload.exp * 1000 <= Date.now();
    } catch (e) {
      return false;
    }
  }

  /** Stops the reconnect loop and asks the app to route the user back to login. */
  _handleAuthFailure() {
    if (this._authExpired) return;
    this._authExpired = true;
    console.warn('[SocketService] Session expired or rejected, stopping reconnects');
    try {
      this.client?.deactivate();
    } catch (e) {}
    if (this.callbacks.onAuthExpired) {
      this.callbacks.onAuthExpired();
    }
  }

  _markDisconnected() {
    this.isConnected = false;
    if (this._presenceHeartbeat) {
      clearInterval(this._presenceHeartbeat);
      this._presenceHeartbeat = null;
    }
    // Keep the desired registry, throw away the dead handles.
    this.liveSubscriptions.clear();
    this._typingState.clear();
  }

  _bindNetworkListeners() {
    if (this._networkListenersBound || typeof window === 'undefined') return;

    this._onWindowOffline = () => {
      if (!this.isConnected) return;
      log('[SocketService] Browser went offline');
      this._markDisconnected();
      if (this.callbacks.onDisconnect) {
        this.callbacks.onDisconnect();
      }
    };

    this._onWindowOnline = () => {
      if (!this.client || this.client.connected || this._authExpired) return;
      log('[SocketService] Browser back online, retrying immediately');
      try {
        const result = this.client.deactivate();
        if (result && typeof result.then === 'function') {
          result
            .then(() => {
              if (this.client && !this._authExpired) this.client.activate();
            })
            .catch(() => {});
        } else if (this.client) {
          this.client.activate();
        }
      } catch (e) {}
    };

    window.addEventListener('offline', this._onWindowOffline);
    window.addEventListener('online', this._onWindowOnline);
    this._networkListenersBound = true;
  }

  _unbindNetworkListeners() {
    if (!this._networkListenersBound || typeof window === 'undefined') return;
    window.removeEventListener('offline', this._onWindowOffline);
    window.removeEventListener('online', this._onWindowOnline);
    this._networkListenersBound = false;
  }

  // ==========================================
  // Subscription registry
  // ==========================================

  _addSubscription(destination, handler) {
    this.desiredSubscriptions.set(destination, handler);
    if (!this.client || !this.client.connected) return;
    if (this.liveSubscriptions.has(destination)) return;

    try {
      log(`[SocketService] Subscribing to ${destination}`);
      this.liveSubscriptions.set(destination, this.client.subscribe(destination, handler));
    } catch (e) {
      console.warn('[SocketService] Failed to subscribe to', destination, e);
    }
  }

  _removeSubscription(destination) {
    this.desiredSubscriptions.delete(destination);
    const live = this.liveSubscriptions.get(destination);
    if (live) {
      try { live.unsubscribe(); } catch (e) {}
      this.liveSubscriptions.delete(destination);
    }
  }

  _replayDesiredSubscriptions() {
    for (const [destination, handler] of this.desiredSubscriptions) {
      if (this.liveSubscriptions.has(destination)) continue;
      try {
        log(`[SocketService] Re-subscribing to ${destination}`);
        this.liveSubscriptions.set(destination, this.client.subscribe(destination, handler));
      } catch (e) {
        console.warn('[SocketService] Failed to re-subscribe to', destination, e);
      }
    }
  }

  _roomIds() {
    const ids = [];
    for (const destination of this.desiredSubscriptions.keys()) {
      if (destination.startsWith(ROOM_PREFIX)) {
        ids.push(destination.slice(ROOM_PREFIX.length));
      }
    }
    return ids;
  }

  // ==========================================
  // Notifications Subscriptions
  // ==========================================

  subscribeUserNotifications(userId) {
    if (!userId) return;

    this._addSubscription(NOTIFICATIONS_QUEUE, (frame) => {
      try {
        const event = JSON.parse(frame.body);
        log('[SocketService] Notification event:', event.type);
        if (event.type === 'FRIEND_REQUEST_RECEIVED') {
          this.callbacks.onFriendRequestReceived?.(event.payload);
        } else if (event.type === 'FRIEND_REQUEST_ACCEPTED') {
          this.callbacks.onFriendRequestAccepted?.(event.payload);
        } else if (event.type === 'FRIEND_REQUEST_CANCELLED') {
          this.callbacks.onFriendRequestCancelled?.(event.payload);
        } else if (event.type === 'MESSAGE') {
          this.callbacks.onDirectMessageReceived?.(event.payload);
        }
      } catch (e) {
        console.warn('[SocketService] Failed to parse notification frame:', e);
      }
    });
  }

  unsubscribeUserNotifications() {
    this._removeSubscription(NOTIFICATIONS_QUEUE);
  }

  /**
   * Private error queue. The server refuses a message (over-length, or a failed save)
   * by sending ERROR here instead of dropping it silently; without this subscription the
   * sender's text just vanishes with no feedback at all.
   */
  subscribeUserErrors() {
    this._addSubscription(ERRORS_QUEUE, (frame) => {
      try {
        const event = JSON.parse(frame.body);
        if (event.type !== 'ERROR') return;
        const payload = event.payload || {};
        console.warn('[SocketService] Server refused a message:', payload.reason);
        this.callbacks.onChatError?.(payload);
      } catch (e) {
        console.warn('[SocketService] Failed to parse error frame:', e);
      }
    });
  }

  unsubscribeUserErrors() {
    this._removeSubscription(ERRORS_QUEUE);
  }

  // ==========================================
  // Room Subscriptions & Events
  // ==========================================

  /**
   * Subscribes to a conversation room topic: /topic/conversations/{conversationId}.
   * Several rooms may be subscribed at the same time.
   */
  subscribeRoom(conversationId) {
    if (!conversationId) return;

    this.activeConversationId = conversationId;
    const destination = `${ROOM_PREFIX}${conversationId}`;

    this._addSubscription(destination, (message) => {
      try {
        const event = JSON.parse(message.body);
        this._handleRoomEvent(event, conversationId);
      } catch (e) {
        console.warn('[SocketService] Failed to parse room event body:', e);
      }
    });

    // Notify presence
    this.sendOnline(conversationId, true);
  }

  /** Unsubscribes exactly one room, leaving every other open room alone. */
  unsubscribeRoom(conversationId) {
    if (!conversationId) return;

    this.sendOnline(conversationId, false);
    this._removeSubscription(`${ROOM_PREFIX}${conversationId}`);
    this._typingState.delete(conversationId);
    if (this.activeConversationId === conversationId) {
      this.activeConversationId = null;
    }
  }

  unsubscribeAllRooms() {
    for (const conversationId of this._roomIds()) {
      this.unsubscribeRoom(conversationId);
    }
  }

  /**
   * Registers per-conversation listeners so a view can follow one room without
   * clobbering the global callbacks. Returns an unregister function.
   */
  addRoomListener(conversationId, listener) {
    if (!conversationId || !listener) return () => {};

    let listeners = this.roomListeners.get(conversationId);
    if (!listeners) {
      listeners = new Set();
      this.roomListeners.set(conversationId, listeners);
    }
    listeners.add(listener);

    return () => {
      const current = this.roomListeners.get(conversationId);
      if (!current) return;
      current.delete(listener);
      if (current.size === 0) this.roomListeners.delete(conversationId);
    };
  }

  _emitRoom(conversationId, name, ...args) {
    const listeners = this.roomListeners.get(conversationId);
    if (!listeners) return;
    for (const listener of listeners) {
      try {
        listener[name]?.(...args);
      } catch (e) {
        console.warn('[SocketService] Room listener threw:', e);
      }
    }
  }

  _handleRoomEvent(event, conversationId) {
    if (!event || !event.type) {
      log('[SocketService] Received unknown room frame');
      return;
    }

    const type = event.type;
    const payload = { ...(event.payload || {}), conversationId: event.payload?.conversationId || conversationId };

    log(`[SocketService] Room event [${type}] in ${conversationId}`);

    switch (type) {
      case 'MESSAGE': {
        const rawTime = payload.timeStamp || payload.timestamp || new Date().toISOString();
        const msg = {
          id: payload.id || 'msg_' + Date.now(),
          conversationId: payload.conversationId,
          senderId: payload.senderId,
          receiverId: payload.receiverId,
          text: payload.message || payload.text || '',
          message: payload.message || payload.text || '',
          objectUri: payload.objectUri || null,
          referredMessageId: payload.referredMessageId || null,
          status: payload.status || 'SENT',
          type: payload.type || 'TEXT',
          timestamp: rawTime,
          time: new Date(rawTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        this.callbacks.onMessageReceived?.(msg);
        this._emitRoom(conversationId, 'onMessage', msg);
        break;
      }

      case 'TYPING': {
        if (payload.senderId && payload.senderId === this.activeUserId) break;
        const isTyping = Boolean(payload.typing);
        this.callbacks.onTypingStatus?.(isTyping, payload);
        this._emitRoom(conversationId, 'onTyping', isTyping, payload);
        break;
      }

      case 'ONLINE_STATUS': {
        if (payload.senderId && payload.senderId === this.activeUserId) break;
        const isOnline = Boolean(payload.online);
        this.callbacks.onOnlineStatus?.(isOnline, payload);
        this._emitRoom(conversationId, 'onOnlineStatus', isOnline, payload);
        break;
      }

      case 'SEEN': {
        this.callbacks.onMessageSeen?.(payload);
        this._emitRoom(conversationId, 'onSeen', payload);
        break;
      }

      case 'DISCONNECTED_DTO': {
        if (payload.senderId && payload.senderId === this.activeUserId) break;
        this.callbacks.onPeerDisconnected?.(payload.senderId || '', conversationId);
        this._emitRoom(conversationId, 'onPeerDisconnected', payload.senderId || '');
        break;
      }

      case 'PEER_UPDATED': {
        this.callbacks.onPeerUpdated?.(payload);
        this._emitRoom(conversationId, 'onPeerUpdated', payload);
        break;
      }

      default:
        log('[SocketService] Unhandled room event type:', type);
        break;
    }
  }

  // ==========================================
  // Random Chat Matchmaking
  // ==========================================

  /** True while a search ticket is owned by this client. */
  get isSearching() {
    return this._isSearching;
  }

  /**
   * Starts (or resumes) the random matchmaking search.
   */
  startMatchmaking(userProfile = {}) {
    this._isSearching = true;
    this._lastHandledMatchConvId = null;

    if (!this.client || !this.client.connected) {
      log('[SocketService] STOMP not connected yet, queueing matchmaking');
      this._pendingMatchmaking = userProfile || {};
      return;
    }

    this._pendingMatchmaking = null;
    this._addSubscription(MATCH_QUEUE, (frame) => this._handleMatchmakingEvent(frame));
    this._publishSearch();

    // Refresh the ticket periodically so a long wait cannot strand the user.
    if (this._searchRefresh) clearInterval(this._searchRefresh);
    this._searchRefresh = setInterval(() => {
      if (this._isSearching && this.isConnected) {
        this._publishSearch();
      }
    }, SEARCH_REFRESH_MS);
  }

  _publishSearch() {
    log('[SocketService] Publishing match search to /app/chat.random');
    this._publish('/app/chat.random', {});
  }

  _handleMatchmakingEvent(frame) {
    try {
      const event = JSON.parse(frame.body);
      log('[SocketService] Matchmaking event received:', event.type);

      if (event.type === 'CONVERSATION_DTO' && event.payload) {
        const payload = event.payload;

        if (this._lastHandledMatchConvId && this._lastHandledMatchConvId === payload.conversationId) {
          return;
        }
        this._lastHandledMatchConvId = payload.conversationId;

        // We have a match, the ticket is spent
        this.cancelMatchmaking();

        const peerName = extractPeerName(payload);
        // friendUserId is the peer's STABLE ID. friendUsername/name are display only and must
        // never be used to decide who a message or event came from.
        const peerId = payload.friendUserId || '';
        const matchInfo = {
          conversationId: payload.conversationId,
          id: payload.conversationId,
          friendUserName: peerName,
          friendUserId: peerId,
          peerId,
          username: payload.friendUsername || '',
          name: peerName,
          photoUrl: payload.photoUrl || '',
          avatarBg: '#8b5cf6',
          status: 'Online'
        };

        this.callbacks.onMatchFound?.(matchInfo);
      } else if (event.type === 'MATCH_CANCELLED' || event.type === 'MATCH_EXPIRED') {
        // The server discarded our ticket: leave the searching state instead of
        // spinning the radar forever.
        this.cancelMatchmaking();
        this.callbacks.onMatchCancelled?.(event.payload);
      }
    } catch (e) {
      console.warn('[SocketService] Failed to parse match event:', e);
    }
  }

  /**
   * Stops searching. `notifyServer` publishes /app/chat.random.cancel so the
   * server drops the waiting ticket instead of matching the next searcher to a ghost.
   */
  cancelMatchmaking({ notifyServer = false } = {}) {
    const wasSearching = this._isSearching || Boolean(this._pendingMatchmaking);
    this._isSearching = false;
    this._pendingMatchmaking = null;

    if (this._searchRefresh) {
      clearInterval(this._searchRefresh);
      this._searchRefresh = null;
    }

    if (notifyServer && wasSearching) {
      this._publish('/app/chat.random.cancel', {});
    }

    this._removeSubscription(MATCH_QUEUE);
  }

  // ==========================================
  // Client Action Emitters
  // ==========================================

  /** Publishes to an /app destination. Returns false when nothing was sent. */
  _publish(destination, body) {
    if (!this.client || !this.client.connected) return false;
    try {
      this.client.publish({ destination, body: JSON.stringify(body) });
      return true;
    } catch (e) {
      console.warn('[SocketService] Failed to publish to', destination, e);
      return false;
    }
  }

  /**
   * Send chat message via STOMP in normal conversation: /app/chat.send
   */
  sendMessage(conversationId, text, type = 'TEXT', objectUri = null, referredMessageId = null) {
    if (!conversationId) return false;
    return this._publish('/app/chat.send', {
      conversationId,
      message: text,
      type,
      objectUri,
      referredMessageId
    });
  }

  /**
   * Send random chat message via STOMP: /app/chat.random.send
   */
  sendRandomChatMessage(conversationId, text, type = 'TEXT', objectUri = null) {
    if (!conversationId) return false;
    return this._publish('/app/chat.random.send', {
      conversationId,
      message: text,
      type,
      objectUri
    });
  }

  /**
   * Send typing status. Edge triggered: once on start, then at most every few
   * seconds while typing continues, and once on stop.
   */
  sendTyping(conversationId, isTyping) {
    if (!conversationId) return false;

    const state = this._typingState.get(conversationId) || { active: false, lastSent: 0 };
    const now = Date.now();

    if (isTyping) {
      if (state.active && now - state.lastSent < TYPING_REPEAT_MS) return false;
    } else if (!state.active) {
      return false;
    }

    state.active = Boolean(isTyping);
    state.lastSent = now;
    this._typingState.set(conversationId, state);

    return this._publish('/app/chat.typing', {
      conversationId,
      typing: Boolean(isTyping)
    });
  }

  /**
   * Send seen receipt in normal conversation: /app/chat.seen
   */
  sendSeen(conversationId, messageId) {
    if (!conversationId || !messageId) return false;
    return this._publish('/app/chat.seen', { conversationId, messageId });
  }

  /**
   * Send seen receipt in random conversation: /app/chat.random.seen
   */
  sendRandomChatSeen(conversationId, messageId) {
    if (!conversationId || !messageId) return false;
    return this._publish('/app/chat.random.seen', { conversationId, messageId });
  }

  /**
   * Send online status in room / globally: /app/chat.online
   */
  sendOnline(conversationId = null, isOnline = true) {
    return this._publish('/app/chat.online', {
      conversationId: conversationId || null,
      online: Boolean(isOnline)
    });
  }

  /**
   * Broadcast peer updated event after a real profile change: /app/chat.peer.update
   */
  sendPeerUpdated(conversationId, peerData) {
    if (!conversationId) return false;
    return this._publish('/app/chat.peer.update', {
      conversationId,
      previousUsername: peerData.previousUsername || '',
      username: peerData.username,
      name: peerData.name,
      photoUrl: peerData.photoUrl || ''
    });
  }

  /**
   * Notify partner of leaving / disconnect: /app/chat.disconnect
   */
  sendDisconnect(conversationId) {
    if (!conversationId) return false;
    return this._publish('/app/chat.disconnect', { conversationId });
  }
}

export const socketService = new SocketService();
