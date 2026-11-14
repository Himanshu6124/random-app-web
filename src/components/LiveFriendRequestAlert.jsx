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
      className="animate-slide-down m-toast"
      style={{
        position: 'fixed',
        top: '24px',
        right: '24px',
        zIndex: 2000,
        backgroundColor: '#352131',
        border: '1px solid rgba(240, 114, 137, 0.5)',
        boxShadow: '0 16px 36px rgba(0, 0, 0, 0.7), 0 0 24px rgba(240, 114, 137, 0.35)',
        borderRadius: 'var(--radius-bubble)',
        padding: '12px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        color: 'var(--text-primary)',
        maxWidth: '92vw',
        width: 'auto'
      }}
    >
      <div style={{
        width: '44px',
        height: '44px',
        borderRadius: '50%',
        overflow: 'hidden',
        border: '1px solid var(--border-strong)',
        flexShrink: 0,
        backgroundColor: 'var(--plum-4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        {photoUrl ? (
          <img src={photoUrl} alt={senderName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <UserPlus size={22} color="var(--text-secondary)" />
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontSize: 'var(--fs-body)', fontWeight: 700, color: 'var(--text-primary)' }}>
          {senderName}
        </div>
        <div style={{ fontSize: 'var(--fs-sm)', color: '#f6a3b2' }}>
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
            backgroundColor: 'var(--accent)',
            color: 'var(--accent-ink)',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            padding: '8px 14px',
            fontSize: 'var(--fs-md)',
            fontWeight: 600,
            cursor: 'pointer'
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
            background: 'var(--plum-4)',
            border: 'none',
            color: 'var(--text-secondary)',
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
