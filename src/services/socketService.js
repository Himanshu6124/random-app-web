import { io } from 'socket.io-client';

/**
 * SocketService - Strictly matches RandoMeet Android app spec:
 * Reference: SocketRepository.android.kt
 * Base URL: wss://randomchat.qz.io/ws-chat?token={token}
 * 
 * Event Envelope:
 * {
 *   "type": "CONVERSATION_DTO" | "MESSAGE" | "TYPING" | "ONLINE_STATUS" | "DISCONNECTED_DTO" | "SEEN",
 *   "payload": { ... }
 * }
 */

export class SocketService {
  constructor() {
    this.ws = null;
    this.socketIo = null;
    this.isConnected = false;
    this.serverUrl = 'wss://randomchat.qz.io/ws-chat';
    this.authToken = '';
    this.callbacks = {};
    this.activeConversationId = null;
    this.activePeerId = null;
  }

  connect(url = 'wss://randomchat.qz.io/ws-chat', token = '', callbacks = {}) {
    this.serverUrl = url || 'wss://randomchat.qz.io/ws-chat';
    this.authToken = token || 'demo_token_' + Date.now();
    this.callbacks = callbacks;

    this.disconnect();

    const fullUrl = this.serverUrl.includes('?') 
      ? `${this.serverUrl}&token=${this.authToken}` 
      : `${this.serverUrl}?token=${this.authToken}`;

    console.log('[STOMP/WS] Connecting to:', fullUrl);

    // Try Standard WebSocket / STOMP frame connection first
    if (this.serverUrl.startsWith('ws://') || this.serverUrl.startsWith('wss://')) {
      this.initWebSocket(fullUrl);
    } else {
      this.initSocketIo(this.serverUrl);
    }
  }

  initWebSocket(fullUrl) {
    try {
      this.ws = new WebSocket(fullUrl);

      this.ws.onopen = () => {
        this.isConnected = true;
        console.log('[STOMP/WS] WebSocket Connection Opened');
        
        // Send STOMP CONNECT frame
        const stompConnectFrame = `CONNECT\naccept-version:1.1,1.0\nheart-beat:10000,10000\n\n\0`;
        this.ws.send(stompConnectFrame);

        if (this.callbacks.onConnect) this.callbacks.onConnect('ws_session');
      };

      this.ws.onmessage = (event) => {
        this.handleRawFrame(event.data);
      };

      this.ws.onerror = (err) => {
        console.warn('[STOMP/WS] WebSocket Error:', err);
        this.isConnected = false;
        if (this.callbacks.onError) this.callbacks.onError('WebSocket Connection Error');
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        console.log('[STOMP/WS] WebSocket Closed');
        if (this.callbacks.onDisconnect) this.callbacks.onDisconnect();
      };

    } catch (e) {
      console.warn('[STOMP/WS] Connection init exception:', e);
      this.isConnected = false;
    }
  }

  initSocketIo(url) {
    try {
      this.socketIo = io(url, {
        query: { token: this.authToken },
        transports: ['websocket', 'polling']
      });

      this.socketIo.on('connect', () => {
        this.isConnected = true;
        console.log('[SocketIO] Connected:', this.socketIo.id);
        if (this.callbacks.onConnect) this.callbacks.onConnect(this.socketIo.id);
      });

      this.socketIo.on('disconnect', () => {
        this.isConnected = false;
        if (this.callbacks.onDisconnect) this.callbacks.onDisconnect();
      });

      // Handle raw incoming frame string/json matching SocketRepository.android.kt
      this.socketIo.on('message', (data) => this.handleRawFrame(data));
      this.socketIo.on('payload', (data) => this.handleRawFrame(data));
    } catch (e) {
      console.warn('[SocketIO] Init exception:', e);
    }
  }

  /**
   * Strictly parses event JSON as implemented in SocketRepository.android.kt parseEvent():
   * 
   * "CONVERSATION_DTO"  -> SocketEvent.ChatCardEvent
   * "MESSAGE"           -> SocketEvent.MessageEvent
   * "TYPING"            -> SocketEvent.TypingEvent
   * "ONLINE_STATUS"     -> SocketEvent.OnlineEvent
   * "DISCONNECTED_DTO"  -> SocketEvent.DisconnectEvent
   * "SEEN"              -> SocketEvent.MessageSeenEvent
   */
  handleRawFrame(rawText) {
    try {
      // Extract JSON if inside STOMP frame body
      let jsonString = rawText;
      if (typeof rawText === 'string' && rawText.includes('{')) {
        const jsonStart = rawText.indexOf('{');
        const jsonEnd = rawText.lastIndexOf('}');
        if (jsonStart !== -1 && jsonEnd !== -1) {
          jsonString = rawText.substring(jsonStart, jsonEnd + 1);
        }
      }

      const json = typeof jsonString === 'object' ? jsonString : JSON.parse(jsonString);
      const type = json.type;
      const payload = json.payload || json;

      if (!type) return;

      console.log(`[STOMP/AppSpec] Received Event: ${type}`, payload);

      switch (type) {
        case 'CONVERSATION_DTO': {
          // Payload: Conversation
          const conversation = {
            id: payload.conversationId || payload.peerId || 'matched_peer',
            peerId: payload.peerId || payload.userId || 'peer_123',
            name: payload.userName || payload.name || payload.nickname || 'Random Stranger',
            avatar: payload.userAvatar || payload.avatar || '⚡',
            avatarBg: payload.avatarBg || '#8b5cf6',
            gender: payload.gender || 'Unknown',
            interests: payload.interests || [],
            bio: payload.bio || 'Matched on RandoMeet Mobile Network'
          };
          this.activeConversationId = conversation.id;
          this.activePeerId = conversation.peerId;
          if (this.callbacks.onMatchFound) this.callbacks.onMatchFound(conversation);
          break;
        }

        case 'MESSAGE': {
          // Payload: Message { id, senderId, receiverId, message, timestamp }
          const message = {
            id: payload.id || 'msg_' + Date.now(),
            senderId: payload.senderId || 'stranger',
            receiverId: payload.receiverId || '',
            text: payload.message || payload.text || payload.content || '',
            timestamp: payload.timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          };
          if (this.callbacks.onMessageReceived) this.callbacks.onMessageReceived(message);
          break;
        }

        case 'TYPING': {
          // Payload: TypingStatus { typing: boolean, senderId: string }
          const isTyping = Boolean(payload.typing || payload.isTyping);
          if (this.callbacks.onTypingStatus) this.callbacks.onTypingStatus(isTyping);
          break;
        }

        case 'ONLINE_STATUS': {
          // Payload: OnlineStatus { online: boolean, userId: string }
          if (this.callbacks.onOnlineStatus) this.callbacks.onOnlineStatus(Boolean(payload.online));
          break;
        }

        case 'DISCONNECTED_DTO': {
          // Payload: DisconnectStatus { senderId: string }
          const disconnectedUser = payload.senderId || 'Stranger';
          if (this.callbacks.onPeerDisconnected) this.callbacks.onPeerDisconnected(disconnectedUser);
          break;
        }

        case 'SEEN': {
          // Payload: SeenStatus { messageId: string, seen: boolean }
          if (this.callbacks.onMessageSeen) this.callbacks.onMessageSeen(payload);
          break;
        }

        default:
          console.log('[STOMP/AppSpec] Unknown event type:', type);
          break;
      }
    } catch (e) {
      console.warn('[STOMP/AppSpec] Parse frame error:', e);
    }
  }

  // --- CLIENT ACTIONS ACCORDING TO STOMP DESTINATIONS ---

  findMatch(userProfile, filters) {
    const payload = {
      type: 'MATCH_REQUEST',
      payload: {
        userId: userProfile.id,
        name: userProfile.name,
        avatar: userProfile.avatar,
        gender: filters.gender || userProfile.gender,
        interests: filters.interests || userProfile.interests
      }
    };
    this.sendStompFrame('/app/match.find', payload);
  }

  sendMessage(text, peerId) {
    const payload = {
      type: 'MESSAGE',
      payload: {
        id: 'msg_' + Date.now(),
        senderId: 'user_me',
        receiverId: peerId || this.activePeerId,
        message: text,
        timestamp: new Date().toISOString()
      }
    };
    this.sendStompFrame('/app/chat.sendMessage', payload);
  }

  sendTyping(isTyping, peerId) {
    const payload = {
      type: 'TYPING',
      payload: {
        typing: isTyping,
        senderId: 'user_me',
        receiverId: peerId || this.activePeerId
      }
    };
    this.sendStompFrame('/app/chat.typing', payload);
  }

  skipPeer(peerId) {
    const payload = {
      type: 'DISCONNECTED_DTO',
      payload: {
        senderId: 'user_me',
        receiverId: peerId || this.activePeerId
      }
    };
    this.sendStompFrame('/app/match.skip', payload);
    this.activeConversationId = null;
    this.activePeerId = null;
  }

  sendStompFrame(destination, bodyObj) {
    const jsonBody = JSON.stringify(bodyObj);

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const stompFrame = `SEND\ndestination:${destination}\ncontent-type:application/json\n\n${jsonBody}\0`;
      this.ws.send(stompFrame);
    } else if (this.socketIo && this.socketIo.connected) {
      this.socketIo.emit('send', { destination, body: jsonBody });
    }
  }

  disconnect() {
    if (this.ws) {
      try { this.ws.close(); } catch(e) {}
      this.ws = null;
    }
    if (this.socketIo) {
      try { this.socketIo.disconnect(); } catch(e) {}
      this.socketIo = null;
    }
    this.isConnected = false;
    this.activeConversationId = null;
    this.activePeerId = null;
  }
}

export const socketService = new SocketService();
