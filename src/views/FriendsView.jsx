import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket, ICEBREAKER_QUESTIONS } from '../context/SocketContext';
import { socketService, MAX_MESSAGE_LENGTH } from '../services/socketService';
import { authService } from '../services/authService';
import {
  Users,
  UserMinus,
  UserPlus,
  Send,
  MessageCircle,
  ArrowLeft,
  HelpCircle,
  Heart,
  Flame,
  Sparkles,
  Smile,
  Hand,
  MoreVertical,
  Loader2,
  Ban,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { DiscoverConfirmDialog } from '../components/discover/DiscoverConfirmDialog';
import { FriendRequestDialog } from '../components/FriendRequestDialog';
import { MediaComposer } from '../components/MediaComposer';
import { ChatMediaMessage } from '../components/ChatMediaMessage';

const MAX_CACHED_MESSAGES = 200;

export function FriendsView({ onStartMatch, initialFriendId, onInitialFriendHandled }) {
  const {
    user,
    isGuest,
    jwtToken,
    friends,
    removeFriend,
    blockUser,
    unblockUser,
    friendRequests,
    friendRequestsLoading,
    loadFriendRequests,
    acceptFriendRequest,
    rejectFriendRequest,
    loadFriendsFromApi,
    openUpgradeModal,
    markFriendMessagesSeen,
    setActiveDmFriendId
  } = useAuth();

  const { isLiveConnected } = useSocket();
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [mobileShowChat, setMobileShowChat] = useState(false);
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 768);
  const [showRequestDialog, setShowRequestDialog] = useState(false);
  const [isFriendTyping, setIsFriendTyping] = useState(false);
  const [floatingReactions, setFloatingReactions] = useState([]);
  const [dmInput, setDmInput] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const [fetchingMessages, setFetchingMessages] = useState(false);
  const [mediaError, setMediaError] = useState('');
  // { kind: 'remove' | 'block', friend } awaiting confirmation
  const [pendingAction, setPendingAction] = useState(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [showBlocked, setShowBlocked] = useState(false);
  const [unblockingId, setUnblockingId] = useState(null);
  const menuRef = useRef(null);
  const messagesEndRef = useRef(null);
  const typingTimerRef = useRef(null);

  // Resize listener for mobile/desktop layout
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Sync active DM friend with AuthContext to prevent unread increment while viewing
  useEffect(() => {
    const friendId = selectedFriend?.id || selectedFriend?.friendUserId;
    setActiveDmFriendId?.(friendId || null);
    if (friendId) {
      markFriendMessagesSeen?.(friendId);
    }
    return () => {
      setActiveDmFriendId?.(null);
    };
  }, [selectedFriend?.id, selectedFriend?.friendUserId, setActiveDmFriendId, markFriendMessagesSeen]);

  // Handle selecting a friend
  const handleSelectFriend = async (friend) => {
    if (!friend) return;
    console.log('[FriendsView] Friend selected:', friend);

    let activeFriend = { ...friend };
    const targetUserId = friend.id || friend.friendUserId;
    if (targetUserId) {
      markFriendMessagesSeen?.(targetUserId);
      setActiveDmFriendId?.(targetUserId);
    }

    // If conversationId is missing, create or open it via POST /conversations
    if (!activeFriend.conversationId && targetUserId) {
      try {
        const conv = await authService.createOrOpenConversation(targetUserId, jwtToken);
        if (conv?.id) {
          activeFriend.conversationId = conv.id;
        }
      } catch (err) {
        console.warn('Could not create/open conversation:', err);
      }
    }

    setSelectedFriend(activeFriend);
    setMobileShowChat(true);
    setIsFriendTyping(false);
    setShowMenu(false);
  };

  // Another view (Discover, a wave alert) asked to open a chat with this friend
  useEffect(() => {
    if (!initialFriendId) return;
    const target = friends.find(f => f.id === initialFriendId || f.friendUserId === initialFriendId);
    if (target) {
      handleSelectFriend(target);
      onInitialFriendHandled?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFriendId, friends]);

  // Auto-select first friend on desktop if none selected
  useEffect(() => {
    if (!selectedFriend && friends.length > 0 && !isMobile && !initialFriendId) {
      handleSelectFriend(friends[0]);
    }
  }, [friends, isMobile, selectedFriend, initialFriendId]);

  // Keep selectedFriend in sync with friends list changes (e.g. online presence)
  useEffect(() => {
    if (!selectedFriend) return;
    const targetUserId = selectedFriend.id || selectedFriend.friendUserId;
    const found = friends.find(f => (f.id === targetUserId || f.friendUserId === targetUserId));
    if (found && (found.isOnline !== selectedFriend.isOnline || found.photoUrl !== selectedFriend.photoUrl || found.name !== selectedFriend.name)) {
      setSelectedFriend(prev => ({ ...prev, ...found }));
    }
  }, [friends, selectedFriend]);

  // Load latest friends and pending requests from API on mount
  useEffect(() => {
    if (isGuest) return;
    loadFriendsFromApi();
    loadFriendRequests();
  }, [isGuest, loadFriendsFromApi, loadFriendRequests]);

  const loadBlockedUsers = async () => {
    const token = jwtToken || authService.getToken();
    if (!token) return;
    try {
      setBlockedUsers(await authService.getBlockedUsers(token));
    } catch (err) {
      console.warn('[FriendsView] Failed to load blocked users:', err);
    }
  };

  useEffect(() => {
    if (isGuest) return;
    loadBlockedUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGuest, jwtToken]);

  // Close the chat options menu on any click outside it
  useEffect(() => {
    if (!showMenu) return undefined;
    const onDown = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [showMenu]);

  const friendKey = (f) => f?.id || f?.friendUserId;
  const friendLabel = (f) => f?.name || f?.friendUserName || f?.username || 'this user';

  const askConfirm = (kind, friend) => {
    setShowMenu(false);
    setActionError('');
    setPendingAction({ kind, friend });
  };

  const clearSelectionIf = (targetId) => {
    if (selectedFriend && friendKey(selectedFriend) === targetId) {
      setSelectedFriend(null);
      setMobileShowChat(false);
    }
  };

  const handleConfirmAction = async () => {
    if (!pendingAction || actionBusy) return;
    const { kind, friend } = pendingAction;
    const targetId = friendKey(friend);
    setActionBusy(true);
    setActionError('');
    try {
      if (kind === 'block') {
        await blockUser(targetId);
        await loadBlockedUsers();
      } else {
        await removeFriend(targetId);
      }
      clearSelectionIf(targetId);
      setPendingAction(null);
    } catch (err) {
      setActionError(err?.message || 'Something went wrong. Please try again.');
    } finally {
      setActionBusy(false);
    }
  };

  const handleUnblock = async (blocked) => {
    if (unblockingId) return;
    setUnblockingId(blocked.id);
    try {
      await unblockUser(blocked.id);
      setBlockedUsers(prev => prev.filter(b => b.id !== blocked.id));
    } catch (err) {
      console.warn('[FriendsView] Failed to unblock user:', err);
    } finally {
      setUnblockingId(null);
    }
  };

  // In-memory / local storage message cache
  const [dmMessages, setDmMessages] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('randomeet_dms') || '{}');
    } catch {
      return {};
    }
  });

  useEffect(() => {
    try {
      // Only server-acknowledged messages belong in the long-lived cache, and the
      // history is capped so a quota error cannot take the whole app down.
      const persistable = {};
      Object.entries(dmMessages).forEach(([key, list]) => {
        const settled = (list || []).filter(m => m.status !== 'SENDING' && m.status !== 'FAILED');
        if (settled.length > 0) persistable[key] = settled.slice(-MAX_CACHED_MESSAGES);
      });
      localStorage.setItem('randomeet_dms', JSON.stringify(persistable));
    } catch (e) {
      console.warn('[FriendsView] Could not cache direct messages locally:', e);
    }
  }, [dmMessages]);

  // Subscribe to room and fetch messages when selectedFriend changes
  useEffect(() => {
    if (!selectedFriend?.conversationId) return;

    const conversationId = selectedFriend.conversationId;
    const friendId = selectedFriend.id || selectedFriend.friendUserId;
    const token = jwtToken || authService.getToken();

    // 1. Subscribe to this conversation only; a random chat may hold its own room
    socketService.subscribeRoom(conversationId);

    // 2. Fetch message history from GET /conversations/{id}/messages
    let isSubscribed = true;
    setFetchingMessages(true);

    authService.fetchConversationMessages(conversationId, token, 0, 40)
      .then(apiMessages => {
        if (!isSubscribed) return;
        if (Array.isArray(apiMessages) && apiMessages.length > 0) {
          const lastPeerMsg = [...apiMessages].reverse().find(m => m.senderId !== user?.id);
          if (lastPeerMsg?.id) {
            socketService.sendSeen(conversationId, lastPeerMsg.id);
          }

          setDmMessages(prev => {
            const existingLocal = prev[conversationId] || prev[friendId] || [];
            const mergedMap = new Map();
            apiMessages.forEach(m => mergedMap.set(m.id, m));
            existingLocal.forEach(m => {
              if (!mergedMap.has(m.id)) mergedMap.set(m.id, m);
            });
            const mergedList = Array.from(mergedMap.values());
            mergedList.sort((a, b) => {
              const tA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
              const tB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
              return tA - tB;
            });
            return {
              ...prev,
              [conversationId]: mergedList,
              [friendId]: mergedList
            };
          });
        }
      })
      .catch(err => {
        console.warn('[FriendsView] Failed to fetch conversation messages:', err);
      })
      .finally(() => {
        if (isSubscribed) setFetchingMessages(false);
      });

    return () => {
      isSubscribed = false;
      socketService.unsubscribeRoom(conversationId);
    };
  }, [selectedFriend?.conversationId, jwtToken]);

  // Follow this conversation through a scoped room listener; mutating the global
  // callbacks would steal the random chat's events.
  useEffect(() => {
    const conversationId = selectedFriend?.conversationId;
    if (!conversationId) return;

    const friendId = selectedFriend.id || selectedFriend.friendUserId;
    const myId = user?.id;

    return socketService.addRoomListener(conversationId, {
      onMessage: (msg) => {
        setDmMessages(prev => {
          const currentList = prev[conversationId] || [];
          if (msg.id && currentList.some(m => m.id === msg.id)) return prev;

          const rawTime = msg.timestamp || msg.timeStamp || new Date().toISOString();
          const isMe = msg.senderId === myId;

          const serverMsg = {
            id: msg.id || 'dm_' + Date.now(),
            sender: isMe ? 'me' : msg.senderId,
            senderId: msg.senderId,
            text: msg.text || msg.message || '',
            message: msg.message || msg.text || '',
            type: msg.type || (msg.objectUri ? 'IMAGE' : 'TEXT'),
            objectUri: msg.objectUri || null,
            status: msg.status || 'SENT',
            time: new Date(rawTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            timestamp: rawTime
          };

          // Reconcile the optimistic copy of our own message if there is one
          const pendingIdx = currentList.findIndex(
            m => m.status === 'SENDING' && (
              (m.id && msg.id && m.id === msg.id) ||
              (m.text === (msg.text || msg.message) && m.senderId === msg.senderId)
            )
          );

          if (pendingIdx !== -1) {
            const updated = [...currentList];
            updated[pendingIdx] = {
              ...currentList[pendingIdx],
              ...serverMsg,
              type: serverMsg.type || currentList[pendingIdx].type,
              objectUri: serverMsg.objectUri || currentList[pendingIdx].objectUri
            };
            return { ...prev, [conversationId]: updated };
          }

          return { ...prev, [conversationId]: [...currentList, serverMsg] };
        });

        if (msg.id && msg.senderId !== myId) {
          socketService.sendSeen(conversationId, msg.id);
        }
      },
      onSeen: (_payload) => {
        setDmMessages(prev => {
          const currentList = prev[conversationId] || [];
          const updated = currentList.map(m => {
            if (m.sender === 'me' || m.senderId === myId) {
              return { ...m, status: 'SEEN' };
            }
            return m;
          });
          return { ...prev, [conversationId]: updated };
        });
      },
      onTyping: (typing, payload) => {
        if (payload?.senderId === myId) return;
        setIsFriendTyping(Boolean(typing));
      },
      onOnlineStatus: (isOnline, payload) => {
        if (payload?.senderId !== friendId) return;
        setSelectedFriend(prev => prev ? { ...prev, isOnline: Boolean(isOnline), status: isOnline ? 'Online' : 'Offline' } : null);
      }
    });
  }, [selectedFriend, user?.id]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [dmMessages, selectedFriend, isFriendTyping]);

  const handleSendDm = (e) => {
    if (e) e.preventDefault();
    if (!dmInput.trim() || !selectedFriend || !isLiveConnected) return;

    const messageText = dmInput.trim();
    const conversationId = selectedFriend.conversationId;
    const friendId = selectedFriend.id || selectedFriend.friendUserId;
    const rawTime = new Date().toISOString();

    const newMsg = {
      id: 'pending_' + Date.now(),
      sender: 'me',
      senderId: user?.id || 'me',
      text: messageText,
      status: 'SENDING',
      time: new Date(rawTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      timestamp: rawTime
    };

    setDmMessages(prev => {
      const key = conversationId || friendId;
      const list = [...(prev[key] || []), newMsg];
      return {
        ...prev,
        [key]: list
      };
    });

    setDmInput('');

    if (!conversationId) return;

    socketService.sendTyping(conversationId, false);
    const sent = socketService.sendMessage(conversationId, messageText, 'TEXT');
    if (!sent) {
      setDmMessages(prev => {
        const list = (prev[conversationId] || []).map(m => m.id === newMsg.id ? { ...m, status: 'FAILED' } : m);
        return { ...prev, [conversationId]: list };
      });
    }
  };

  const handleInputChange = (e) => {
    setDmInput(e.target.value);
    if (!selectedFriend?.conversationId) return;

    const conversationId = selectedFriend.conversationId;

    if (e.target.value.trim().length > 0) {
      socketService.sendTyping(conversationId, true);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => {
        socketService.sendTyping(conversationId, false);
      }, 1500);
    } else {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      socketService.sendTyping(conversationId, false);
    }
  };

  /**
   * Sends an uploaded media message into a friend DM (B2). MediaComposer uploads to
   * Firebase Storage first and hands us the objectUri. Friend-DM media is persisted
   * history — the backend never cleans it up.
   */
  const handleSendMediaDm = ({ type, objectUri }) => {
    if (!selectedFriend?.conversationId || !objectUri) return;

    const conversationId = selectedFriend.conversationId;
    const caption = type === 'IMAGE' ? '📷 Photo' : '🎤 Voice note';
    const rawTime = new Date().toISOString();

    const newMsg = {
      id: 'pending_' + Date.now(),
      sender: 'me',
      senderId: user?.id || 'me',
      text: caption,
      type,
      objectUri,
      status: 'SENDING',
      time: new Date(rawTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      timestamp: rawTime
    };

    setDmMessages(prev => ({
      ...prev,
      [conversationId]: [...(prev[conversationId] || []), newMsg]
    }));

    const sent = socketService.sendMessage(conversationId, caption, type, objectUri);
    if (!sent) {
      setDmMessages(prev => {
        const list = (prev[conversationId] || []).map(m => m.id === newMsg.id ? { ...m, status: 'FAILED' } : m);
        return { ...prev, [conversationId]: list };
      });
    }
  };

  const handleIcebreakerClick = (e) => {
    e.preventDefault();
    if (!selectedFriend) return;
    const randomQ = ICEBREAKER_QUESTIONS[Math.floor(Math.random() * ICEBREAKER_QUESTIONS.length)];
    setDmInput(`🧊 Icebreaker: ${randomQ}`);
  };

  const handleReactionClick = (e, emoji) => {
    e.preventDefault();
    if (!selectedFriend) return;

    const reactionObj = {
      id: 'react_' + Date.now() + Math.random(),
      emoji,
      left: Math.random() * 60 + 20 + '%'
    };
    setFloatingReactions(prev => [...prev, reactionObj]);

    const conversationId = selectedFriend.conversationId;
    const friendId = selectedFriend.id || selectedFriend.friendUserId;
    const rawTime = new Date().toISOString();

    const newMsg = {
      id: 'pending_' + Date.now(),
      sender: 'me',
      senderId: user?.id || 'me',
      text: emoji,
      status: 'SENDING',
      time: new Date(rawTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      timestamp: rawTime
    };

    setDmMessages(prev => {
      const key = conversationId || friendId;
      return {
        ...prev,
        [key]: [...(prev[key] || []), newMsg]
      };
    });

    if (conversationId) {
      const sent = socketService.sendMessage(conversationId, emoji, 'TEXT');
      if (!sent) {
        setDmMessages(prev => {
          const list = (prev[conversationId] || []).map(m => m.id === newMsg.id ? { ...m, status: 'FAILED' } : m);
          return { ...prev, [conversationId]: list };
        });
      }
    }

    setTimeout(() => {
      setFloatingReactions(prev => prev.filter(r => r.id !== reactionObj.id));
    }, 1800);
  };

  const activeKey = selectedFriend ? (selectedFriend.conversationId || selectedFriend.id) : null;
  const currentMessages = activeKey ? (dmMessages[activeKey] || []) : [];

  if (isGuest) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        width: '100%',
        padding: '24px'
      }}>
        <div className="glass-panel animate-scale-up" style={{
          maxWidth: '480px',
          width: '100%',
          padding: '40px 32px',
          borderRadius: '24px',
          textAlign: 'center',
          backgroundColor: '#1C1C1E',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: '0 20px 40px rgba(0,0,0,0.6)'
        }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '20px',
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
            boxShadow: '0 8px 24px rgba(16, 185, 129, 0.35)'
          }}>
            <Users size={32} color="#ffffff" />
          </div>

          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#ffffff', marginBottom: '10px' }}>
            Friends & Direct Messages
          </h2>
          <p style={{ color: '#a1a1aa', fontSize: '0.95rem', lineHeight: 1.5, marginBottom: '24px' }}>
            Never lose touch with great people you meet! Create a free permanent account to save friends, send direct messages anytime, and see who's online.
          </p>

          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            marginBottom: '28px',
            textAlign: 'left',
            background: 'rgba(255, 255, 255, 0.04)',
            padding: '16px',
            borderRadius: '16px',
            border: '1px solid rgba(255, 255, 255, 0.08)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem', color: '#e4e4e7' }}>
              <span style={{ color: '#10b981', fontSize: '1.1rem' }}>✓</span> Save friends met in Random Chat
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem', color: '#e4e4e7' }}>
              <span style={{ color: '#10b981', fontSize: '1.1rem' }}>✓</span> 1-on-1 private direct messaging
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem', color: '#e4e4e7' }}>
              <span style={{ color: '#10b981', fontSize: '1.1rem' }}>✓</span> Real-time online status and typing alerts
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button
              type="button"
              id="guest-friends-upgrade-btn"
              onClick={() => openUpgradeModal('unlock Friends & Direct Messages')}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: '#ffffff',
                border: 'none',
                fontWeight: 700,
                fontSize: '1rem',
                cursor: 'pointer',
                boxShadow: '0 8px 20px rgba(16, 185, 129, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <Sparkles size={18} />
              Create Free Account
            </button>

            <button
              type="button"
              onClick={onStartMatch}
              className="btn-secondary"
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '12px',
                fontSize: '0.9rem',
                cursor: 'pointer'
              }}
            >
              Back to Random Match
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      flex: 1,
      height: '100%',
      gap: '16px',
      padding: '16px',
      position: 'relative'
    }}>
      {/* Sidebar: Friends List */}
      <div
        className="glass-panel friends-sidebar"
        style={{
          width: isMobile ? '100%' : '320px',
          display: (isMobile && mobileShowChat) ? 'none' : 'flex',
          flexDirection: 'column',
          padding: '20px',
          flexShrink: 0
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Users size={22} color="var(--primary-purple)" />
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Friends ({friends.length})</h2>
          </div>

          <button
            onClick={() => {
              loadFriendRequests();
              setShowRequestDialog(true);
            }}
            className="btn-cyan"
            style={{
              padding: '6px 12px',
              fontSize: '0.8rem',
              borderRadius: 'var(--radius-full)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer'
            }}
            title="Friend Requests"
          >
            <UserPlus size={15} />
            <span>Requests</span>
            {friendRequests.length > 0 && (
              <span style={{
                backgroundColor: '#FF3B30',
                color: 'white',
                fontSize: '0.7rem',
                fontWeight: 700,
                padding: '2px 6px',
                borderRadius: '10px',
                marginLeft: '2px'
              }}>
                {friendRequests.length}
              </span>
            )}
          </button>
        </div>

        {friends.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--text-muted)' }}>
            <p>No friends added yet!</p>
            <p style={{ fontSize: '0.8rem', marginTop: '8px' }}>Match with strangers and send them friend requests!</p>
            <button
              onClick={onStartMatch}
              className="btn-primary"
              style={{ marginTop: '16px', padding: '10px 20px', fontSize: '0.85rem' }}
            >
              Start Matching
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto' }}>
            {friends.map(friend => {
              const friendId = friend.id || friend.friendUserId;
              const isSelected = selectedFriend && (
                (selectedFriend.conversationId && selectedFriend.conversationId === friend.conversationId) ||
                (selectedFriend.id === friendId)
              );

              return (
                <div
                  key={friendId || friend.conversationId}
                  onClick={() => handleSelectFriend(friend)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px',
                    borderRadius: 'var(--radius-md)',
                    background: isSelected ? 'rgba(139, 92, 246, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                    border: isSelected ? '1px solid var(--primary-purple)' : '1px solid transparent',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', overflow: 'hidden' }}>
                    <div style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '50%',
                      backgroundColor: '#8b5cf6',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.3rem',
                      overflow: 'hidden',
                      flexShrink: 0
                    }}>
                      {friend.photoUrl ? (
                        <img src={friend.photoUrl} alt={friend.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.target.style.display = 'none'; }} />
                      ) : (
                        '👤'
                      )}
                    </div>
                    <div style={{ overflow: 'hidden', flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                        <span style={{ fontSize: '0.95rem', fontWeight: 600, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                          {friend.name || friend.friendUserName || friendId}
                        </span>
                        <span style={{
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          color: friend.isOnline ? 'var(--green-accent)' : 'var(--text-muted)',
                          flexShrink: 0
                        }}>
                          {friend.isOnline ? 'Online' : 'Offline'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginTop: '2px' }}>
                        <span style={{
                          fontSize: '0.75rem',
                          color: (friend.unseenCount || 0) > 0 ? '#ffffff' : 'var(--text-muted)',
                          fontWeight: (friend.unseenCount || 0) > 0 ? 600 : 400,
                          whiteSpace: 'nowrap',
                          textOverflow: 'ellipsis',
                          overflow: 'hidden'
                        }}>
                          {friend.lastMessage || 'Say hi!'}
                        </span>
                        {(friend.unseenCount || 0) > 0 && (
                          <span style={{
                            backgroundColor: '#ef4444',
                            color: '#ffffff',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            minWidth: '18px',
                            height: '18px',
                            borderRadius: '9px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '0 5px',
                            flexShrink: 0,
                            boxShadow: '0 2px 6px rgba(239, 68, 68, 0.4)'
                          }}>
                            {friend.unseenCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      askConfirm('remove', friend);
                    }}
                    aria-label={`Remove ${friendLabel(friend)} from friends`}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      padding: '6px'
                    }}
                    title="Remove Friend"
                  >
                    <UserMinus size={16} />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Blocked users (only ones *I* blocked; blocks placed by others are never shown) */}
        {blockedUsers.length > 0 && (
          <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
            <button
              type="button"
              onClick={() => setShowBlocked(prev => !prev)}
              aria-expanded={showBlocked}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'none',
                border: 'none',
                color: 'var(--text-secondary)',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                padding: '4px 0'
              }}
            >
              {showBlocked ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              <Ban size={15} />
              Blocked users ({blockedUsers.length})
            </button>

            {showBlocked && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px', maxHeight: '200px', overflowY: 'auto' }}>
                {blockedUsers.map(blocked => (
                  <div
                    key={blocked.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '8px',
                      padding: '8px 10px',
                      borderRadius: 'var(--radius-md)',
                      background: 'rgba(255, 255, 255, 0.04)'
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '0.88rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {blocked.name}
                      </div>
                      {blocked.username && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>@{blocked.username}</div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleUnblock(blocked)}
                      disabled={unblockingId === blocked.id}
                      aria-label={`Unblock ${blocked.name}`}
                      style={{
                        flexShrink: 0,
                        padding: '6px 12px',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        borderRadius: 'var(--radius-full)',
                        border: '1px solid var(--border-color)',
                        background: 'transparent',
                        color: 'var(--text-primary)',
                        cursor: 'pointer'
                      }}
                    >
                      {unblockingId === blocked.id ? 'Unblocking…' : 'Unblock'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Main Area: Direct Chat Screen */}
      <div className="glass-panel friends-chat-area" style={{
        flex: 1,
        display: (isMobile && !mobileShowChat) ? 'none' : 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative'
      }}>
        {/* Floating Animated Reactions */}
        {floatingReactions.map(r => (
          <div
            key={r.id}
            className="floating-reaction"
            style={{ left: r.left, bottom: '80px', zIndex: 100 }}
          >
            {r.emoji}
          </div>
        ))}

        {selectedFriend ? (
          <>
            {/* Top Bar Header */}
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'rgba(15, 17, 35, 0.4)',
              // Must be positioned, or zIndex is ignored and the options menu renders
              // underneath the messages log (which made "Remove Friend" unclickable).
              position: 'relative',
              zIndex: 20
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button
                  onClick={() => setMobileShowChat(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'white',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '4px'
                  }}
                  title="Back to Friends List"
                >
                  <ArrowLeft size={20} />
                </button>

                <div style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  backgroundColor: '#8b5cf6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.4rem',
                  overflow: 'hidden',
                  boxShadow: 'var(--shadow-glow)'
                }}>
                  {selectedFriend.photoUrl ? (
                    <img src={selectedFriend.photoUrl} alt={selectedFriend.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.target.style.display = 'none'; }} />
                  ) : (
                    '👤'
                  )}
                </div>

                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>{selectedFriend.name || selectedFriend.friendUserName || selectedFriend.username}</h3>
                  <span style={{
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    color: selectedFriend.isOnline ? 'var(--green-accent)' : 'var(--text-muted)'
                  }}>
                    {selectedFriend.isOnline ? 'Online' : 'Offline'}
                  </span>
                </div>
              </div>

              {/* Options Menu */}
              <div ref={menuRef} style={{ position: 'relative' }}>
                <button
                  onClick={() => setShowMenu(prev => !prev)}
                  aria-label="Chat options"
                  aria-haspopup="menu"
                  aria-expanded={showMenu}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: '6px'
                  }}
                >
                  <MoreVertical size={20} />
                </button>

                {showMenu && (
                  <div style={{
                    position: 'absolute',
                    right: 0,
                    top: '36px',
                    backgroundColor: '#1e1b4b',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                    padding: '6px 0',
                    width: '170px',
                    zIndex: 50
                  }}>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => askConfirm('remove', selectedFriend)}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '10px 16px',
                        background: 'none',
                        border: 'none',
                        color: '#ef4444',
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}
                    >
                      <UserMinus size={15} />
                      Remove Friend
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => askConfirm('block', selectedFriend)}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '10px 16px',
                        background: 'none',
                        border: 'none',
                        color: '#ef4444',
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}
                    >
                      <Ban size={15} />
                      Block
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Direct Messages Log */}
            <div style={{
              flex: 1,
              padding: '20px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              zIndex: 10
            }}>
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem', margin: '12px 0' }}>
                Direct conversation with <strong style={{ color: 'white' }}>{selectedFriend.name || selectedFriend.friendUserName || selectedFriend.username}</strong>
              </div>

              {fetchingMessages && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  color: 'var(--cyan-accent)',
                  fontSize: '0.82rem',
                  padding: '8px'
                }}>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Loading messages...</span>
                </div>
              )}

              {currentMessages.map(m => {
                const isMe = m.sender === 'me' || m.senderId === user?.id;
                return (
                  <div
                    key={m.id}
                    className="animate-fade-in"
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: isMe ? 'flex-end' : 'flex-start'
                    }}
                  >
                    <div style={{
                      maxWidth: '75%',
                      padding: '12px 18px',
                      borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                      background: isMe
                        ? 'linear-gradient(135deg, var(--cyan-accent) 0%, #0284c7 100%)'
                        : 'rgba(255, 255, 255, 0.08)',
                      border: isMe ? 'none' : '1px solid var(--border-color)',
                      color: 'white',
                      fontSize: '0.95rem',
                      lineHeight: '1.4',
                      overflowWrap: 'anywhere',
                      wordBreak: 'break-word',
                      opacity: m.status === 'FAILED' ? 0.7 : 1
                    }}>
                      {(m.type === 'IMAGE' || m.type === 'AUDIO' || m.objectUri) ? (
                        <ChatMediaMessage msg={m} />
                      ) : (
                        m.text
                      )}
                    </div>
                    <span style={{
                      fontSize: '0.7rem',
                      color: m.status === 'FAILED' ? '#f87171' : 'var(--text-muted)',
                      marginTop: '4px',
                      padding: '0 4px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      {m.status === 'FAILED' ? (
                        'Not delivered'
                      ) : m.status === 'SENDING' ? (
                        'Sending...'
                      ) : (
                        <>
                          <span>{m.time}</span>
                          {isMe && (
                            <>
                              <span>•</span>
                              {m.status === 'SEEN' ? (
                                <span style={{ color: 'var(--cyan-accent)', fontWeight: 600 }}>✓✓ Seen</span>
                              ) : (
                                <span>✓ Sent</span>
                              )}
                            </>
                          )}
                        </>
                      )}
                    </span>
                  </div>
                );
              })}

              {isFriendTyping && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  <span>{selectedFriend.name || selectedFriend.friendUserName || selectedFriend.username} is typing...</span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Quick Actions Sub-bar */}
            <div style={{
              padding: '8px 20px',
              borderTop: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'rgba(15, 17, 35, 0.5)',
              zIndex: 20
            }}>
              <button
                type="button"
                onClick={handleIcebreakerClick}
                className="btn-secondary"
                style={{
                  padding: '6px 14px',
                  fontSize: '0.8rem',
                  borderRadius: 'var(--radius-full)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <HelpCircle size={14} color="var(--cyan-accent)" />
                <span style={{ fontWeight: 600 }}>Ask Icebreaker</span>
              </button>

              <div style={{ display: 'flex', gap: '6px' }}>
                {[
                  { icon: <Heart size={15} color="#ec4899" />, emoji: '❤️' },
                  { icon: <Flame size={15} color="#f97316" />, emoji: '🔥' },
                  { icon: <Sparkles size={15} color="#eab308" />, emoji: '✨' },
                  { icon: <Smile size={15} color="#06b6d4" />, emoji: '😂' },
                  { icon: <Hand size={15} color="#a855f7" />, emoji: '👋' }
                ].map(item => (
                  <button
                    key={item.emoji}
                    type="button"
                    onClick={(e) => handleReactionClick(e, item.emoji)}
                    style={{
                      background: 'rgba(255, 255, 255, 0.08)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      padding: '6px 10px',
                      borderRadius: 'var(--radius-full)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    {item.icon}
                  </button>
                ))}
              </div>
            </div>

            {/* Connection is down — say so instead of queueing messages silently */}
            {mediaError && (
              <div id="dm-media-error" style={{
                padding: '8px 20px',
                background: 'rgba(239, 68, 68, 0.12)',
                borderTop: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#fca5a5',
                fontSize: '0.8rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                zIndex: 20
              }}>
                <span>⚠️ {mediaError}</span>
                <button
                  type="button"
                  onClick={() => setMediaError('')}
                  style={{ background: 'none', border: 'none', color: '#fca5a5', cursor: 'pointer', fontWeight: 700 }}
                >
                  ✕
                </button>
              </div>
            )}
            {!isLiveConnected && (
              <div style={{
                padding: '10px 20px',
                background: 'rgba(234, 179, 8, 0.12)',
                borderTop: '1px solid rgba(234, 179, 8, 0.35)',
                color: '#fde68a',
                fontSize: '0.85rem',
                zIndex: 20
              }}>
                Reconnecting… messages cannot be delivered right now.
              </div>
            )}

            {/* DM Text Input Form */}
            <form onSubmit={handleSendDm} style={{
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              background: 'rgba(9, 10, 21, 0.8)',
              zIndex: 20
            }}>
              <MediaComposer
                conversationId={selectedFriend?.conversationId}
                disabled={!isLiveConnected}
                onSend={handleSendMediaDm}
                onError={setMediaError}
              />
              <input
                type="text"
                value={dmInput}
                onChange={handleInputChange}
                onBlur={() => {
                  if (selectedFriend?.conversationId) {
                    socketService.sendTyping(selectedFriend.conversationId, false);
                  }
                }}
                disabled={!isLiveConnected}
                maxLength={MAX_MESSAGE_LENGTH}
                placeholder={isLiveConnected
                  ? `Message ${selectedFriend.name || selectedFriend.friendUserName || selectedFriend.username}...`
                  : 'Reconnecting…'}
                style={{
                  flex: 1,
                  padding: '14px 20px',
                  borderRadius: 'var(--radius-full)',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-color)',
                  color: 'white',
                  fontSize: '0.95rem',
                  outline: 'none',
                  opacity: isLiveConnected ? 1 : 0.6
                }}
              />
              <button
                type="submit"
                className="btn-cyan"
                disabled={!isLiveConnected}
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '50%',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: isLiveConnected ? 'pointer' : 'not-allowed'
                }}
              >
                <Send size={18} />
              </button>
            </form>
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--text-muted)' }}>
            <MessageCircle size={48} color="var(--primary-purple)" style={{ marginBottom: '16px' }} />
            <p style={{ fontSize: '1rem', fontWeight: 600 }}>Select a friend to start chatting!</p>
            <p style={{ fontSize: '0.8rem', marginTop: '6px', opacity: 0.8 }}>Choose a friend from the left sidebar to send direct messages.</p>
          </div>
        )}
      </div>

      {/* Friend Requests Modal Dialog */}
      <DiscoverConfirmDialog
        open={Boolean(pendingAction)}
        title={pendingAction?.kind === 'block'
          ? `Block ${friendLabel(pendingAction?.friend)}?`
          : `Remove ${friendLabel(pendingAction?.friend)}?`}
        body={pendingAction?.kind === 'block'
          ? 'They will be removed from your friends and your chat history with them is deleted. They cannot message you, send you friend requests, find you in search, or be matched with you in Random Match. You can unblock them later.'
          : 'They will be removed from your friends and your chat history with them is deleted. You can send them a new friend request later.'}
        confirmLabel={actionBusy
          ? (pendingAction?.kind === 'block' ? 'Blocking…' : 'Removing…')
          : (pendingAction?.kind === 'block' ? 'Block' : 'Remove')}
        danger
        busy={actionBusy}
        error={actionError}
        onConfirm={handleConfirmAction}
        onCancel={() => setPendingAction(null)}
      />

      {showRequestDialog && (
        <FriendRequestDialog
          friendRequests={friendRequests}
          isLoading={friendRequestsLoading}
          onDismiss={() => setShowRequestDialog(false)}
          onAccept={async (reqId) => {
            await acceptFriendRequest(reqId);
          }}
          onReject={async (reqId) => {
            await rejectFriendRequest(reqId);
          }}
        />
      )}
    </div>
  );
}
