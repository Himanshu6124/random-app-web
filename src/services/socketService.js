import { io } from 'socket.io-client';

/**
 * SocketService - Matches RandoMeet Android app STOMP spec.
 * Reference: SocketRepository.android.kt (package com.example.vibechat)
 *
 * Connection: ws://<host>/ws-chat?token={jwt}   (proxied via Vite to 192.168.1.7:8080)
 *
 * Event Envelope (incoming & outgoing):
 * { "type": "...", "payload": { ... } }
 *
 * Incoming types: CONVERSATION_DTO | MESSAGE | TYPING | ONLINE_STATUS | DISCONNECTED_DTO | SEEN
 * Outgoing destinations: /app/match.find | /app/chat.sendMessage | /app/chat.typing | /app/match.skip
 *
 * STOMP Subscriptions:
 *   /user/queue/messages  — personal queue for match events, messages, typing
 *   /topic/chat/{conversationId} — conversation topic (if used by server)
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
    // STOMP session state
    this._stompConnected = false;
    this._pendingActions = [];
  }

  connect(url = '/ws-chat', token = '', userId = '', callbacks = {}) {
    this.authToken = token || '';
    this.activeUserId = userId || '';
    this.callbacks = callbacks;

    this.disconnect();

    // Prefer proxied local WebSocket path; fall back to explicit URLs
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

        // Send STOMP CONNECT frame with auth header
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
   * Handle STOMP frames and JSON event envelopes.
   * Strictly follows SocketRepository.android.kt parseEvent() logic.
   *
   * Types:
   *   CONVERSATION_DTO -> onMatchFound(conversation)
   *   MESSAGE          -> onMessageReceived(message)
   *   TYPING           -> onTypingStatus(bool)
   *   ONLINE_STATUS    -> onOnlineStatus(bool)
   *   DISCONNECTED_DTO -> onPeerDisconnected(senderId)
   *   SEEN             -> onMessageSeen(payload)
   */
  _handleRawFrame(rawText) {
    if (typeof rawText !== 'string' && typeof rawText !== 'object') return;

    try {
      // STOMP CONNECTED frame — subscribe after connection ack
      if (typeof rawText === 'string') {
        if (rawText.startsWith('CONNECTED')) {
          this._stompConnected = true;
          console.log('[SocketService] STOMP CONNECTED — subscribing to queues');
          this._subscribeToQueues();
          if (this.callbacks.onConnect) this.callbacks.onConnect('stomp_session');
          // Flush any pending actions queued before CONNECTED
          this._pendingActions.forEach(fn => fn());
          this._pendingActions = [];
          return;
        }

        if (rawText.startsWith('MESSAGE')) {
          // Extract JSON body from STOMP MESSAGE frame
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

      // Direct JSON object or JSON string
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

      console.log(`[SocketService] Event: ${type}`, payload);

      switch (type) {
        case 'CONVERSATION_DTO': {
          const conversation = {
            id: payload.conversationId || payload.id || 'matched_' + Date.now(),
            peerId: payload.peerId || payload.userId || payload.id || 'peer',
            name: payload.userName || payload.name || payload.nickname || 'Random Stranger',
            photoUrl: payload.photoUrl || payload.userAvatar || payload.avatar || '',
            avatar: payload.userAvatar || payload.avatar || '⚡',
            avatarBg: payload.avatarBg || '#8b5cf6',
            gender: payload.gender || '',
            interests: payload.interests || [],
            bio: payload.bio || ''
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
            text: payload.message || payload.text || payload.content || '',
            timestamp: payload.timestamp
              ? new Date(payload.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
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
          const disconnectedUser = payload.senderId || 'Stranger';
          if (this.callbacks.onPeerDisconnected) this.callbacks.onPeerDisconnected(disconnectedUser);
          break;
        }

        case 'SEEN': {
          if (this.callbacks.onMessageSeen) this.callbacks.onMessageSeen(payload);
          break;
        }

        default:
          console.log('[SocketService] Unknown event type:', type, payload);
          break;
      }
    } catch (e) {
      console.warn('[SocketService] JSON parse error:', e, 'raw:', jsonStr);
    }
  }

  // ─── STOMP Subscription ─────────────────────────────────────────────────────

  _subscribeToQueues() {
    // Subscribe to personal user queue (match events, messages, typing)
    this._sendRawStompFrame(
      `SUBSCRIBE\nid:sub-personal\ndestination:/user/queue/messages\n\n\0`
    );
    // Also subscribe to user-specific topic
    if (this.activeUserId) {
      this._sendRawStompFrame(
        `SUBSCRIBE\nid:sub-user\ndestination:/topic/user/${this.activeUserId}\n\n\0`
      );
    }
  }

  // ─── CLIENT ACTIONS ─────────────────────────────────────────────────────────

  findMatch(userProfile, filters) {
    const payload = {
      type: 'MATCH_REQUEST',
      payload: {
        userId: userProfile.id,
        name: userProfile.name || userProfile.username,
        photoUrl: userProfile.photoUrl || '',
        gender: filters.gender !== 'All' ? filters.gender : (userProfile.gender || ''),
        interests: filters.interests?.length > 0 ? filters.interests : (userProfile.interests || [])
      }
    };
    this._sendToDestination('/app/match.find', payload);
  }

  sendMessage(text, peerId, senderId) {
    const payload = {
      type: 'MESSAGE',
      payload: {
        id: 'msg_' + Date.now(),
        senderId: senderId || this.activeUserId || 'user_me',
        receiverId: peerId || this.activePeerId,
        message: text,
        timestamp: new Date().toISOString()
      }
    };
    this._sendToDestination('/app/chat.sendMessage', payload);
  }

  sendTyping(isTyping, peerId, senderId) {
    const payload = {
      type: 'TYPING',
      payload: {
        typing: isTyping,
        senderId: senderId || this.activeUserId || 'user_me',
        receiverId: peerId || this.activePeerId
      }
    };
    this._sendToDestination('/app/chat.typing', payload);
  }

  skipPeer(peerId) {
    const payload = {
      type: 'DISCONNECTED_DTO',
      payload: {
        senderId: this.activeUserId || 'user_me',
        receiverId: peerId || this.activePeerId
      }
    };
    this._sendToDestination('/app/match.skip', payload);
    this.activeConversationId = null;
    this.activePeerId = null;
  }

  // ─── Internal Send Helpers ───────────────────────────────────────────────────

  _sendToDestination(destination, bodyObj) {
    const jsonBody = JSON.stringify(bodyObj);

    const action = () => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        const frame = `SEND\ndestination:${destination}\ncontent-type:application/json\ncontent-length:${jsonBody.length}\n\n${jsonBody}\0`;
        this.ws.send(frame);
      } else if (this.socketIo && this.socketIo.connected) {
        this.socketIo.emit('send', { destination, body: jsonBody });
      }
    };

    // Queue if STOMP not yet confirmed, execute immediately otherwise
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

  // ─── Disconnect ──────────────────────────────────────────────────────────────

  disconnect() {
    this._stompConnected = false;
    this._pendingActions = [];
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
