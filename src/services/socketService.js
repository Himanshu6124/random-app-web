import { io } from 'socket.io-client';

/**
 * Helper to extract peer name from any possible backend payload shape.
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
    payload.user?.userName,
    payload.friend?.name,
    payload.friend?.username,
    payload.friend?.userName,
    payload.matchedUser?.name,
    payload.matchedUser?.username,
    payload.matchedUser?.userName
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }

  return 'Random Stranger';
}

/**
 * SocketService - RandoMeet Android app STOMP spec (kmp-migration branch).
 *
 * Connection: ws://<host>/ws-chat?token={jwt}
 *
 * STOMP Subscriptions:
 *   Matching phase: /topic/room/random/{userId}
 *   Chat phase:     /topic/room/{peerId}/{conversationId}
 *
 * Outgoing STOMP Destinations:
 *   /app/chat.random       — initiate random match request
 *   /app/chat.random.send  — send random match chat message
 *   /app/chat.send         — send standard friend chat message
 *   /app/chat.online       — broadcast online status
 *   /app/chat.typing       — broadcast typing status
 *   /app/chat.random.seen  — send seen receipt for random match message
 *   /app/chat.disconnect   — send disconnect status on skip / leave chat
 *
 * Incoming Event Envelope:
 *   { "type": "...", "payload": { ... } }
 *   Types: CONVERSATION_DTO | MESSAGE | TYPING | ONLINE_STATUS | DISCONNECTED_DTO | SEEN
 */
export class SocketService {
  constructor() {
    this.ws = null;
    this.socketIo = null;
    this.isConnected = false;
    this.authToken = '';
    this.callbacks = {};
    this.activeConversationId = null;
    this.activePeerId = null;
    this.activeUserId = null;
    this._stompConnected = false;
    this._pendingActions = [];
    this._subscribedTopics = new Set();
  }

  connect(url = '/ws-chat', token = '', userId = '', callbacks = {}) {
    this.authToken = token || '';
    this.activeUserId = userId || '';
    this.callbacks = callbacks;

    this.disconnect();

    const wsPath = url.startsWith('ws://') || url.startsWith('wss://')
      ? url
      : `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws-chat`;

    const fullUrl = this.authToken
      ? (wsPath.includes('?') ? `${wsPath}&token=${this.authToken}` : `${wsPath}?token=${this.authToken}`)
      : wsPath;

    console.log('[SocketService] Connecting STOMP to:', wsPath);

    if (wsPath.startsWith('ws://') || wsPath.startsWith('wss://') || wsPath.startsWith('/')) {
      this._initWebSocket(fullUrl);
    } else {
      this._initSocketIo(wsPath);
    }
  }

  _initWebSocket(fullUrl) {
    try {
      this.ws = new WebSocket(fullUrl);

      this.ws.onopen = () => {
        this.isConnected = true;
        console.log('[SocketService] WebSocket opened, sending STOMP CONNECT');

        const headers = this.authToken
          ? `Authorization:Bearer ${this.authToken}\n`
          : '';
        const stompConnectFrame = `CONNECT\naccept-version:1.2,1.1,1.0\nheart-beat:10000,10000\n${headers}\n\0`;
        this.ws.send(stompConnectFrame);
      };

      this.ws.onmessage = (event) => {
        this._handleRawFrame(event.data);
      };

      this.ws.onerror = (err) => {
        console.warn('[SocketService] WebSocket error:', err);
        this.isConnected = false;
        this._stompConnected = false;
        if (this.callbacks.onError) this.callbacks.onError('WebSocket Connection Error');
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        this._stompConnected = false;
        console.log('[SocketService] WebSocket closed');
        if (this.callbacks.onDisconnect) this.callbacks.onDisconnect();
      };
    } catch (e) {
      console.warn('[SocketService] WebSocket init exception:', e);
      this.isConnected = false;
    }
  }

  _initSocketIo(url) {
    try {
      this.socketIo = io(url, {
        query: { token: this.authToken },
        transports: ['websocket', 'polling']
      });

      this.socketIo.on('connect', () => {
        this.isConnected = true;
        console.log('[SocketService] Socket.IO connected:', this.socketIo.id);
        if (this.callbacks.onConnect) this.callbacks.onConnect(this.socketIo.id);
      });

      this.socketIo.on('disconnect', () => {
        this.isConnected = false;
        if (this.callbacks.onDisconnect) this.callbacks.onDisconnect();
      });

      this.socketIo.on('message', (data) => this._handleRawFrame(data));
      this.socketIo.on('payload', (data) => this._handleRawFrame(data));
      this.socketIo.on('event', (data) => this._handleRawFrame(data));
    } catch (e) {
      console.warn('[SocketService] Socket.IO init exception:', e);
    }
  }

  /**
   * Handle STOMP frames and JSON event envelopes matching Android SocketRepository.kt logic.
   */
  _handleRawFrame(rawText) {
    if (typeof rawText !== 'string' && typeof rawText !== 'object') return;

    try {
      if (typeof rawText === 'string') {
        if (rawText.startsWith('CONNECTED')) {
          this._stompConnected = true;
          console.log('[SocketService] STOMP CONNECTED frame received');
          if (this.callbacks.onConnect) this.callbacks.onConnect('stomp_session');
          this._pendingActions.forEach(fn => fn());
          this._pendingActions = [];
          return;
        }

        if (rawText.startsWith('MESSAGE')) {
          const bodyStart = rawText.indexOf('\n\n');
          if (bodyStart === -1) return;
          let body = rawText.substring(bodyStart + 2).replace(/\0$/, '');
          this._parseEventJson(body);
          return;
        }

        if (rawText.startsWith('ERROR')) {
          console.warn('[SocketService] STOMP ERROR frame:', rawText);
          if (this.callbacks.onError) this.callbacks.onError(rawText);
          return;
        }
      }

      const jsonString = typeof rawText === 'string' ? rawText : JSON.stringify(rawText);
      if (jsonString.includes('{')) {
        const start = jsonString.indexOf('{');
        const end = jsonString.lastIndexOf('}');
        if (start !== -1 && end !== -1) {
          this._parseEventJson(jsonString.substring(start, end + 1));
        }
      }
    } catch (e) {
      console.warn('[SocketService] Frame parse error:', e);
    }
  }

  _parseEventJson(jsonStr) {
    try {
      const json = typeof jsonStr === 'object' ? jsonStr : JSON.parse(jsonStr);
      const type = json.type;
      const payload = json.payload || json;

      if (!type) return;

      console.log(`[SocketService] Event received: ${type}`, payload);

      switch (type) {
        case 'CONVERSATION_DTO': {
          const peerName = extractPeerName(payload);
          const conversation = {
            id: payload.conversationId || payload.id || 'matched_' + Date.now(),
            peerId: payload.peerId || payload.friendUserId || payload.userId || payload.id || 'peer',
            name: peerName,
            friendUserName: peerName,
            userName: peerName,
            photoUrl: payload.friendPhotoUrl || payload.photoUrl || payload.userAvatar || payload.avatar || payload.user?.photoUrl || '',
            avatar: payload.userAvatar || payload.avatar || '⚡',
            avatarBg: payload.avatarBg || '#8b5cf6',
            gender: payload.gender || payload.friendGender || '',
            interests: payload.interests || payload.friendInterests || [],
            bio: payload.bio || payload.friendBio || ''
          };
          this.activeConversationId = conversation.id;
          this.activePeerId = conversation.peerId;
          if (this.callbacks.onMatchFound) this.callbacks.onMatchFound(conversation);
          break;
        }

        case 'MESSAGE': {
          const message = {
            id: payload.id || 'msg_' + Date.now(),
            senderId: payload.senderId || 'stranger',
            receiverId: payload.receiverId || '',
            conversationId: payload.conversationId || this.activeConversationId || '',
            text: payload.message || payload.text || payload.content || '',
            timestamp: payload.timeStamp || payload.timestamp
              ? new Date(payload.timeStamp || payload.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          };
          if (this.callbacks.onMessageReceived) this.callbacks.onMessageReceived(message);
          break;
        }

        case 'TYPING': {
          const isTyping = Boolean(payload.typing || payload.isTyping);
          if (this.callbacks.onTypingStatus) this.callbacks.onTypingStatus(isTyping);
          break;
        }

        case 'ONLINE_STATUS': {
          if (this.callbacks.onOnlineStatus) this.callbacks.onOnlineStatus(Boolean(payload.online));
          break;
        }

        case 'DISCONNECTED_DTO': {
          const disconnectedUser = extractPeerName(payload) !== 'Random Stranger'
            ? extractPeerName(payload)
            : (payload.senderId || payload.disconnectedUser || 'Stranger');
          if (this.callbacks.onPeerDisconnected) this.callbacks.onPeerDisconnected(disconnectedUser);
          break;
        }

        case 'SEEN': {
          if (this.callbacks.onMessageSeen) this.callbacks.onMessageSeen(payload);
          break;
        }

        default:
          console.log('[SocketService] Unhandled event type:', type, payload);
          break;
      }
    } catch (e) {
      console.warn('[SocketService] JSON parse error:', e, 'raw:', jsonStr);
    }
  }

  // ─── STOMP SUBSCRIPTIONS (Matching & Chat Topics) ──────────────────────────

  subscribeTopic(topic, subId) {
    if (this._subscribedTopics.has(subId)) return;
    this._subscribedTopics.add(subId);
    this._sendRawStompFrame(
      `SUBSCRIBE\nid:${subId}\ndestination:${topic}\n\n\0`
    );
    console.log(`[SocketService] Subscribed STOMP topic: ${topic} (id: ${subId})`);
  }

  unsubscribeTopic(subId) {
    if (!this._subscribedTopics.has(subId)) return;
    this._subscribedTopics.delete(subId);
    this._sendRawStompFrame(
      `UNSUBSCRIBE\nid:${subId}\n\n\0`
    );
    console.log(`[SocketService] Unsubscribed STOMP topic (id: ${subId})`);
  }

  subscribeMatchingTopic(userId) {
    const topic = `/topic/room/random/${userId || this.activeUserId}`;
    this.subscribeTopic(topic, 'sub-matching');
  }

  subscribeChatTopic(peerId, conversationId) {
    this.activePeerId = peerId;
    this.activeConversationId = conversationId;
    const topic = `/topic/room/${peerId}/${conversationId}`;
    this.subscribeTopic(topic, `sub-chat-${conversationId}`);
  }

  unsubscribeChatTopic() {
    if (this.activeConversationId) {
      this.unsubscribeTopic(`sub-chat-${this.activeConversationId}`);
    }
    this.unsubscribeTopic('sub-matching');
  }

  // ─── CLIENT ACTION EMITS (STOMP DESTINATIONS) ───────────────────────────────

  findMatch(userProfile, filters) {
    const userId = userProfile.id || this.activeUserId;
    this.subscribeMatchingTopic(userId);

    const payload = {
      type: 'MATCH_REQUEST',
      payload: {
        userId: userId,
        name: userProfile.name || userProfile.username,
        photoUrl: userProfile.photoUrl || '',
        gender: filters.gender !== 'All' ? filters.gender : (userProfile.gender || ''),
        interests: filters.interests?.length > 0 ? filters.interests : (userProfile.interests || [])
      }
    };
    this._sendToDestination('/app/chat.random', payload);
  }

  sendOnlineStatus(conversationId, isOnline = true) {
    const payload = {
      senderId: this.activeUserId || 'user_me',
      conversationId: conversationId || this.activeConversationId,
      online: isOnline
    };
    this._sendToDestination('/app/chat.online', payload);
  }

  sendRandomChatMessage(text, peerId, conversationId, senderId) {
    const payload = {
      id: 'msg_' + Date.now(),
      message: text,
      senderId: senderId || this.activeUserId || 'user_me',
      conversationId: conversationId || this.activeConversationId,
      timeStamp: new Date().toISOString(),
      status: 'SENT'
    };
    this._sendToDestination('/app/chat.random.send', payload);
  }

  sendMessage(text, peerId, senderId) {
    const payload = {
      id: 'msg_' + Date.now(),
      message: text,
      senderId: senderId || this.activeUserId || 'user_me',
      conversationId: this.activeConversationId,
      timeStamp: new Date().toISOString(),
      status: 'SENT'
    };
    this._sendToDestination('/app/chat.send', payload);
  }

  sendTyping(isTyping, peerId, conversationId, senderId) {
    const payload = {
      senderId: senderId || this.activeUserId || 'user_me',
      conversationId: conversationId || this.activeConversationId,
      typing: Boolean(isTyping)
    };
    this._sendToDestination('/app/chat.typing', payload);
  }

  sendSeen(messageId, conversationId) {
    const payload = {
      seenAt: new Date().toISOString(),
      conversationId: conversationId || this.activeConversationId,
      messageId: messageId
    };
    this._sendToDestination('/app/chat.random.seen', payload);
  }

  skipPeer(peerId, conversationId) {
    const payload = {
      senderId: this.activeUserId || 'user_me',
      conversationId: conversationId || this.activeConversationId
    };
    this._sendToDestination('/app/chat.disconnect', payload);
    this.unsubscribeChatTopic();
    this.activeConversationId = null;
    this.activePeerId = null;
  }

  _sendToDestination(destination, bodyObj) {
    const jsonBody = typeof bodyObj === 'string' ? bodyObj : JSON.stringify(bodyObj);

    const action = () => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        const frame = `SEND\ndestination:${destination}\ncontent-type:application/json\ncontent-length:${jsonBody.length}\n\n${jsonBody}\0`;
        this.ws.send(frame);
      } else if (this.socketIo && this.socketIo.connected) {
        this.socketIo.emit('send', { destination, body: jsonBody });
      }
    };

    if (this.ws && !this._stompConnected) {
      this._pendingActions.push(action);
    } else {
      action();
    }
  }

  _sendRawStompFrame(frame) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(frame);
    }
  }

  disconnect() {
    this._stompConnected = false;
    this._pendingActions = [];
    this._subscribedTopics.clear();
    if (this.ws) {
      try {
        if (this.ws.readyState === WebSocket.OPEN) {
          this.ws.send('DISCONNECT\n\n\0');
        }
        this.ws.close();
      } catch (e) {}
      this.ws = null;
    }
    if (this.socketIo) {
      try { this.socketIo.disconnect(); } catch (e) {}
      this.socketIo = null;
    }
    this.isConnected = false;
    this.activeConversationId = null;
    this.activePeerId = null;
  }
}

export const socketService = new SocketService();
