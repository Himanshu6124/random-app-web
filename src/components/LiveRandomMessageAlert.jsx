import React, { useEffect } from 'react';
import { useSocket } from '../context/SocketContext';
import { MessageSquare, ArrowRight, X } from 'lucide-react';

export function LiveRandomMessageAlert() {
  const {
    liveRandomMessage,
    dismissLiveRandomMessage,
    activeTab,
    setActiveTab
  } = useSocket();

  // Auto-dismiss alert after 10 seconds if ignored
  useEffect(() => {
    if (!liveRandomMessage) return;
    const timer = setTimeout(() => {
      dismissLiveRandomMessage();
    }, 10000);
    return () => clearTimeout(timer);
  }, [liveRandomMessage, dismissLiveRandomMessage]);

  if (!liveRandomMessage || activeTab === 'match') return null;

  const peerName = liveRandomMessage.peerName || 'Random Match';
  const photoUrl = liveRandomMessage.photoUrl;
  const messagePreview = liveRandomMessage.text || 'Sent you a message';

  return (
    <div
      id="live-random-message-alert"
      className="animate-slide-down m-toast"
      style={{
        position: 'fixed',
        top: '24px',
        right: '24px',
        zIndex: 2000,
        backgroundColor: '#352131',
        border: '1px solid rgba(126, 166, 246, 0.6)',
        boxShadow: '0 16px 36px rgba(0, 0, 0, 0.7), 0 0 24px rgba(126, 166, 246, 0.35)',
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
          <img src={photoUrl} alt={peerName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.target.style.display = 'none'; }} />
        ) : (
          <MessageSquare size={22} color="var(--text-secondary)" />
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', maxWidth: '200px' }}>
        <div style={{ fontSize: 'var(--fs-body)', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {peerName}
        </div>
        <div style={{ fontSize: 'var(--fs-sm)', color: '#f6a3b2', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {messagePreview}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '8px' }}>
        <button
          id="view-live-random-message-btn"
          type="button"
          onClick={() => {
            setActiveTab('match');
            dismissLiveRandomMessage();
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'var(--accent)',
            color: 'var(--accent-ink)',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            padding: '8px 14px',
            fontSize: 'var(--fs-md)',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          <span>Chat</span>
          <ArrowRight size={15} />
        </button>

        <button
          id="dismiss-live-random-message-btn"
          type="button"
          onClick={dismissLiveRandomMessage}
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
