import React, { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { UserPlus, UserCheck, X } from 'lucide-react';

export function LiveFriendRequestAlert() {
  const {
    liveFriendRequest,
    acceptLiveFriendRequest,
    dismissLiveFriendRequest,
    upgradeModalOpen
  } = useAuth();

  // Auto-dismiss notification after 15 seconds if ignored
  useEffect(() => {
    if (!liveFriendRequest) return;
    const timer = setTimeout(() => {
      dismissLiveFriendRequest();
    }, 15000);
    return () => clearTimeout(timer);
  }, [liveFriendRequest, dismissLiveFriendRequest]);

  if (!liveFriendRequest || upgradeModalOpen) return null;

  const senderName = liveFriendRequest.name || liveFriendRequest.username || 'Someone';
  const photoUrl = liveFriendRequest.photoUrl;

  return (
    <div
      id="live-friend-request-alert"
      className="animate-slide-down"
      style={{
        position: 'fixed',
        top: '24px',
        right: '24px',
        zIndex: 2000,
        backgroundColor: '#1E1B4B',
        border: '1px solid rgba(139, 92, 246, 0.5)',
        boxShadow: '0 16px 36px rgba(0, 0, 0, 0.7), 0 0 24px rgba(139, 92, 246, 0.35)',
        borderRadius: '18px',
        padding: '12px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        color: '#ffffff',
        maxWidth: '92vw',
        width: 'auto'
      }}
    >
      <div style={{
        width: '44px',
        height: '44px',
        borderRadius: '50%',
        overflow: 'hidden',
        border: '2px solid var(--cyan-accent)',
        flexShrink: 0,
        backgroundColor: '#312E81',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        {photoUrl ? (
          <img src={photoUrl} alt={senderName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <UserPlus size={22} color="var(--cyan-accent)" />
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#ffffff' }}>
          {senderName}
        </div>
        <div style={{ fontSize: '0.8rem', color: '#c7d2fe' }}>
          sent you a friend request!
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '8px' }}>
        <button
          id="accept-live-friend-request-btn"
          type="button"
          onClick={acceptLiveFriendRequest}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: '#10b981',
            color: '#ffffff',
            border: 'none',
            borderRadius: '12px',
            padding: '8px 14px',
            fontSize: '0.85rem',
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
          }}
        >
          <UserCheck size={16} />
          <span>Accept</span>
        </button>

        <button
          id="dismiss-live-friend-request-btn"
          type="button"
          onClick={dismissLiveFriendRequest}
          style={{
            background: 'rgba(255, 255, 255, 0.1)',
            border: 'none',
            color: '#94a3b8',
            borderRadius: '50%',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer'
          }}
          title="Dismiss"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
