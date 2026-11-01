import { Client } from '@stomp/stompjs';

/**
 * Extracts a friendly peer display name from various payload formats.
 */
export function extractPeerName(payload) {
  if (!payload) return 'Random Stranger';
  if (typeof payload === 'string' && payload.trim()) return payload.trim();

  const candidates = [
    payload.friendUserName,
    payload.friendName,
    payload.userName,
    payload.name,
    payload.nickname,
    payload.partnerName,
    payload.strangerName,
    payload.peerName,
    payload.username,
    payload.user?.name,
    payload.user?.username,
    payload.friend?.name,
    payload.friend?.username,
    payload.matchedUser?.name,
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
 */
export class SocketService {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.authToken = '';
    this.activeUserId = '';
    this.callbacks = {};

    // Active room subscription
    this.roomSubscription = null;
    this.activeConversationId = null;

    // Matchmaking state & subscriptions
    this.matchQueueSubscription = null;
    this.matchTopicSubscription = null;
    this._pendingMatchmaking = null;
    this._lastHandledMatchConvId = null;
    this._presenceHeartbeat = null;
  }

  /**
   * Initializes STOMP Client connection.
   */
  connect(url = '/ws-chat', token = '', userId = '', callbacks = {}) {
    this.authToken = token || '';
    this.activeUserId = userId || '';
    this.callbacks = callbacks;

    this.disconnect();

    if (!this.authToken) {
      console.warn('[SocketService] Cannot connect without auth token');
      return;
    }

    const envBackend = (import.meta.env.VITE_BACKEND_URL || '').replace(/\/+$/, '');
    let wsBase;
    if (envBackend) {
      wsBase = envBackend.replace(/^http/, 'ws');
    } else {
      const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
      const host = typeof window !== 'undefined' ? window.location.host : 'localhost:8080';
      wsBase = `${isHttps ? 'wss' : 'ws'}://${host}`;
    }

    const cleanPath = url.startsWith('/') ? url : `/${url}`;
    const wsUrl = `${wsBase}${cleanPath}?token=${encodeURIComponent(this.authToken)}`;

    console.log('[SocketService] Connecting to STOMP broker:', wsUrl.replace(/token=.*$/, 'token=***'));

    this.client = new Client({
      brokerURL: wsUrl,
      reconnectDelay: 5000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      debug: () => {},
      onConnect: (frame) => {
        this.isConnected = true;
        console.log('✅ [SocketService] Connected to STOMP broker');

        // Immediately advertise global online presence to server
        this.sendOnline(null, true);

        // Schedule periodic presence keepalive heartbeat every 20 seconds
        if (this._presenceHeartbeat) clearInterval(this._presenceHeartbeat);
        this._presenceHeartbeat = setInterval(() => {
          if (this.isConnected) {
            this.sendOnline(null, true);
          }
        }, 20000);

        // Execute queued matchmaking if requested prior to connection
        if (this._pendingMatchmaking) {
          const pending = this._pendingMatchmaking;
          this._pendingMatchmaking = null;
          this.startMatchmaking(pending);
        }

        if (this.callbacks.onConnect) {
          this.callbacks.onConnect(frame);
        }
      },
      onStompError: (frame) => {
        console.error('❌ [SocketService] STOMP error:', frame?.headers?.message || frame);
        if (this.callbacks.onError) {
          this.callbacks.onError(frame?.headers?.message || 'STOMP Protocol Error');
        }
      },
      onWebSocketClose: () => {
        this.isConnected = false;
        if (this._presenceHeartbeat) {
          clearInterval(this._presenceHeartbeat);
          this._presenceHeartbeat = null;
        }
        console.log('🔌 [SocketService] WebSocket connection closed');
        if (this.callbacks.onDisconnect) {
          this.callbacks.onDisconnect();
        }
      },
      onDisconnect: () => {
        this.isConnected = false;
        if (this._presenceHeartbeat) {
          clearInterval(this._presenceHeartbeat);
          this._presenceHeartbeat = null;
        }
        console.log('🔌 [SocketService] STOMP Client disconnected');
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

    try {
      this.sendOnline(null, false);
    } catch (e) {}

    this.unsubscribeRoom();
    this.cancelMatchmaking();
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

    this.isConnected = false;
    this.activeConversationId = null;
  }

  // ==========================================
  // Room Subscriptions & Events
  // ==========================================

  /**
   * Subscribes to conversation room topic: /topic/conversations/{conversationId}
   */
  subscribeRoom(conversationId) {
    if (!conversationId) return;
    if (this.activeConversationId === conversationId && this.roomSubscription) {
      return;
    }

    this.unsubscribeRoom();
    this.activeConversationId = conversationId;

    if (!this.client || !this.client.connected) {
      console.warn('[SocketService] Cannot subscribe to room: STOMP not connected');
      return;
    }

    const topic = `/topic/conversations/${conversationId}`;
    console.log(`[SocketService] Subscribing to room topic: ${topic}`);

    this.roomSubscription = this.client.subscribe(topic, (message) => {
      try {
        const event = JSON.parse(message.body);
        this._handleRoomEvent(event);
      } catch (e) {
        console.warn('[SocketService] Failed to parse room event body:', e, message.body);
      }
    });

    // Notify presence
    this.sendOnline(conversationId, true);
  }

  unsubscribeRoom() {
    if (this.roomSubscription) {
      try {
        if (this.activeConversationId) {
          this.sendOnline(this.activeConversationId, false);
        }
        this.roomSubscription.unsubscribe();
      } catch (e) {
        console.warn('[SocketService] Error unsubscribing from room:', e);
      }
      this.roomSubscription = null;
    }
    this.activeConversationId = null;
  }

  _handleRoomEvent(event) {
    if (!event || !event.type) {
      console.log('[SocketService] Received unknown room frame:', event);
      return;
    }

    const type = event.type;
    const payload = event.payload;

    console.log(`[SocketService] Room event [${type}]:`, payload);

    switch (type) {
      case 'MESSAGE': {
        const rawTime = payload.timeStamp || payload.timestamp || new Date().toISOString();
        const msg = {
          id: payload.id || 'msg_' + Date.now(),
          conversationId: payload.conversationId || this.activeConversationId,
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
        if (this.callbacks.onMessageReceived) {
          this.callbacks.onMessageReceived(msg);
        }
        break;
      }

      case 'TYPING': {
        const isTyping = Boolean(payload?.typing);
        const sender = payload?.senderId;
        if (sender && sender === this.activeUserId) {
          break;
        }
        if (this.callbacks.onTypingStatus) {
          this.callbacks.onTypingStatus(isTyping, payload);
        }
        break;
      }

      case 'ONLINE_STATUS': {
        const isOnline = Boolean(payload?.online);
        const sender = payload?.senderId;
        if (sender && sender === this.activeUserId) {
          break;
        }
        if (this.callbacks.onOnlineStatus) {
          this.callbacks.onOnlineStatus(isOnline, payload);
        }
        break;
      }

      case 'SEEN': {
        if (this.callbacks.onMessageSeen) {
          this.callbacks.onMessageSeen(payload);
        }
        break;
      }

      case 'DISCONNECTED_DTO': {
        const disconnectedUser = payload?.senderId || 'Stranger';
        if (this.callbacks.onPeerDisconnected) {
          this.callbacks.onPeerDisconnected(disconnectedUser);
        }
        break;
      }

      default:
        console.log('[SocketService] Unhandled room event type:', type, payload);
        break;
    }
  }

  // ==========================================
  // Random Chat Matchmaking
  // ==========================================

  /**
   * Starts random matchmaking queue search.
   */
  startMatchmaking(userProfile = {}) {
    this.cancelMatchmaking();
    this._lastHandledMatchConvId = null;

    if (!this.client || !this.client.connected) {
      console.log('[SocketService] STOMP not connected yet, queueing matchmaking');
      this._pendingMatchmaking = userProfile;
      return;
    }

    const userId = this.activeUserId || userProfile.id || userProfile.username;

    // 1. Subscribe to personal queue (/user/queue/random-match)
    console.log('[SocketService] Subscribing to /user/queue/random-match');
    this.matchQueueSubscription = this.client.subscribe('/user/queue/random-match', (frame) => {
      this._handleMatchmakingEvent(frame);
    });

    // 2. Also subscribe to /topic/users/{userId}/random-match fallback channel
    if (userId) {
      const userTopic = `/topic/users/${userId}/random-match`;
      console.log(`[SocketService] Subscribing to fallback match topic: ${userTopic}`);
      this.matchTopicSubscription = this.client.subscribe(userTopic, (frame) => {
        this._handleMatchmakingEvent(frame);
      });
    }

    // 3. Publish matchmaking search trigger to /app/chat.random
    console.log('[SocketService] Publishing match search to /app/chat.random');
    this.client.publish({
      destination: '/app/chat.random',
      body: JSON.stringify({})
    });
  }

  _handleMatchmakingEvent(frame) {
    try {
      const event = JSON.parse(frame.body);
      console.log('[SocketService] Matchmaking event received:', event);

      if (event.type === 'CONVERSATION_DTO' && event.payload) {
        const payload = event.payload;

        // Prevent duplicate callback when event arrives on both queue and topic
        if (this._lastHandledMatchConvId && this._lastHandledMatchConvId === payload.conversationId) {
          console.log('[SocketService] Ignoring duplicate match event for:', payload.conversationId);
          return;
        }
        this._lastHandledMatchConvId = payload.conversationId;

        // Unsubscribe from match queues immediately upon match
        this.cancelMatchmaking();

        const peerName = extractPeerName(payload);
        const matchInfo = {
          conversationId: payload.conversationId,
          id: payload.conversationId,
          friendUserName: peerName,
          friendUserId: payload.friendUserId || payload.username || 'peer',
          peerId: payload.friendUserId || payload.username || 'peer',
          name: peerName,
          photoUrl: payload.photoUrl || '',
          avatarBg: '#8b5cf6',
          status: 'Online'
        };

        if (this.callbacks.onMatchFound) {
          this.callbacks.onMatchFound(matchInfo);
        }
      }
    } catch (e) {
      console.warn('[SocketService] Failed to parse match event:', e, frame.body);
    }
  }

  cancelMatchmaking() {
    this._pendingMatchmaking = null;
    if (this.matchQueueSubscription) {
      try {
        this.matchQueueSubscription.unsubscribe();
      } catch (e) {}
      this.matchQueueSubscription = null;
    }
    if (this.matchTopicSubscription) {
      try {
        this.matchTopicSubscription.unsubscribe();
      } catch (e) {}
      this.matchTopicSubscription = null;
    }
  }

  // ==========================================
  // Client Action Emitters
  // ==========================================

  /**
   * Send chat message via STOMP in normal conversation: /app/chat.send
   */
  sendMessage(conversationId, text, type = 'TEXT', objectUri = null, referredMessageId = null) {
    if (!this.client || !this.client.connected || !conversationId) return;

    const payload = {
      conversationId: conversationId,
      message: text,
      type: type,
      objectUri: objectUri,
      referredMessageId: referredMessageId
    };

    console.log('[SocketService] Publishing message to /app/chat.send:', payload);
    this.client.publish({
      destination: '/app/chat.send',
      body: JSON.stringify(payload)
    });
  }

  /**
   * Send random chat message via STOMP: /app/chat.random.send
   */
  sendRandomChatMessage(conversationId, text, type = 'TEXT') {
    if (!this.client || !this.client.connected || !conversationId) return;

    const payload = {
      conversationId: conversationId,
      message: text,
      type: type
    };

    console.log('[SocketService] Publishing random message to /app/chat.random.send:', payload);
    this.client.publish({
      destination: '/app/chat.random.send',
      body: JSON.stringify(payload)
    });
  }

  /**
   * Send random chat seen receipt: /app/chat.random.seen
   */
  sendRandomChatSeen(conversationId, messageId) {
    if (!this.client || !this.client.connected || !conversationId || !messageId) return;

    this.client.publish({
      destination: '/app/chat.random.seen',
      body: JSON.stringify({
        conversationId: conversationId,
        messageId: messageId
      })
    });
  }

  /**
   * Send typing status in normal or random conversation
   */
  sendTyping(conversationId, isTyping) {
    if (!this.client || !this.client.connected || !conversationId) return;

    // 1. Direct topic broadcast (works in all rooms: random chat and persistent chat)
    try {
      this.client.publish({
        destination: `/topic/conversations/${conversationId}`,
        body: JSON.stringify({
          type: 'TYPING',
          payload: {
            conversationId: conversationId,
            senderId: this.activeUserId,
            typing: Boolean(isTyping)
          }
        })
      });
    } catch (e) {}

    // 2. Also send to /app/chat.typing (for DB tracking in persistent friend chats)
    try {
      this.client.publish({
        destination: '/app/chat.typing',
        body: JSON.stringify({
          conversationId: conversationId,
          typing: Boolean(isTyping)
        })
      });
    } catch (e) {}
  }

  /**
   * Send seen receipt in normal conversation: /app/chat.seen
   */
  sendSeen(conversationId, messageId) {
    if (!this.client || !this.client.connected || !conversationId || !messageId) return;

    this.client.publish({
      destination: '/app/chat.seen',
      body: JSON.stringify({
        conversationId: conversationId,
        messageId: messageId
      })
    });
  }

  /**
   * Send online status in room / globally: /app/chat.online
   */
  sendOnline(conversationId = null, isOnline = true) {
    if (!this.client || !this.client.connected) return;

    // 1. Broadcast to /app/chat.online (updates userPresenceService in backend)
    const payload = {
      conversationId: conversationId || null,
      online: Boolean(isOnline)
    };

    try {
      this.client.publish({
        destination: '/app/chat.online',
        body: JSON.stringify(payload)
      });
    } catch (e) {}

    // 2. If inside a conversation room, also broadcast directly to the room topic
    if (conversationId) {
      try {
        this.client.publish({
          destination: `/topic/conversations/${conversationId}`,
          body: JSON.stringify({
            type: 'ONLINE_STATUS',
            payload: {
              senderId: this.activeUserId,
              conversationId: conversationId,
              online: Boolean(isOnline)
            }
          })
        });
      } catch (e) {}
    }
  }

  /**
   * Notify partner of leaving / disconnect: /app/chat.disconnect
   */
  sendDisconnect(conversationId) {
    if (!this.client || !this.client.connected || !conversationId) return;

    this.client.publish({
      destination: '/app/chat.disconnect',
      body: JSON.stringify({
        conversationId: conversationId
      })
    });
  }

  // Alias helpers
  subscribeChatTopic(peerId, conversationId) {
    this.subscribeRoom(conversationId);
  }

  unsubscribeChatTopic() {
    this.unsubscribeRoom();
  }

  sendOnlineStatus(conversationId, isOnline = true) {
    this.sendOnline(conversationId, isOnline);
  }

  findMatch(userProfile) {
    this.startMatchmaking(userProfile);
  }

  skipPeer(peerId, conversationId) {
    this.sendDisconnect(conversationId);
    this.unsubscribeRoom();
  }
}

export const socketService = new SocketService();
