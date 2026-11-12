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
        backgroundColor: '#1E1B4B',
        border: '1px solid rgba(6, 182, 212, 0.6)',
        boxShadow: '0 16px 36px rgba(0, 0, 0, 0.7), 0 0 24px rgba(6, 182, 212, 0.35)',
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
          <img src={photoUrl} alt={peerName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.target.style.display = 'none'; }} />
        ) : (
          <MessageSquare size={22} color="var(--cyan-accent)" />
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', maxWidth: '200px' }}>
        <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {peerName}
        </div>
        <div style={{ fontSize: '0.8rem', color: '#c7d2fe', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
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
            background: 'linear-gradient(135deg, var(--cyan-accent) 0%, #0284c7 100%)',
            color: '#ffffff',
            border: 'none',
            borderRadius: '12px',
            padding: '8px 14px',
            fontSize: '0.85rem',
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(6, 182, 212, 0.3)'
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
