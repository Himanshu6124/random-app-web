import React, { useEffect } from 'react';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import { Hand, MessageCircle, X } from 'lucide-react';

/** Toast for a friend's "Wave" from the Nearby map. */
export function LiveWaveAlert({ onOpenChat }) {
  const { liveWave, dismissLiveWave } = useSocket();
  const { upgradeModalOpen } = useAuth();

  useEffect(() => {
    if (!liveWave) return undefined;
    const timer = setTimeout(dismissLiveWave, 10000);
    return () => clearTimeout(timer);
  }, [liveWave, dismissLiveWave]);

  if (!liveWave || upgradeModalOpen) return null;

  const name = liveWave.name || liveWave.username || 'A friend';

  return (
    <div
      className="animate-slide-down m-toast"
      role="status"
      style={{
        position: 'fixed',
        top: '24px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 2000,
        backgroundColor: '#2a1a27',
        border: '1px solid rgba(126, 166, 246, 0.45)',
        boxShadow: 'var(--shadow-pop)',
        borderRadius: 'var(--radius-bubble)',
        padding: '10px 14px 10px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        color: 'var(--text-primary)',
        maxWidth: '92vw'
      }}
    >
      <div style={{
        width: '40px',
        height: '40px',
        borderRadius: '50%',
        overflow: 'hidden',
        flexShrink: 0,
        backgroundColor: 'var(--plum-4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        {liveWave.photoUrl
          ? <img src={liveWave.photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <Hand size={20} color="var(--accent)" />}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <span style={{ fontSize: 'var(--fs-body)', fontWeight: 700 }}>{name} waved at you</span>
        <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>They're nearby.</span>
      </div>
      <button
        type="button"
        onClick={() => { const id = liveWave.id; dismissLiveWave(); onOpenChat?.(id); }}
        className="btn-cyan"
        style={{ padding: '8px 14px', borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-md)' }}
      >
        <MessageCircle size={16} />
        <span>Message</span>
      </button>
      <button
        type="button"
        onClick={dismissLiveWave}
        aria-label="Dismiss"
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
          cursor: 'pointer',
          flexShrink: 0
        }}
      >
        <X size={16} />
      </button>
    </div>
  );
}
