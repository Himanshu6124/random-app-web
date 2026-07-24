import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { Sparkles, Users, MessageSquare, Volume2, VolumeX } from 'lucide-react';

export function Header({ activeTab, setActiveTab }) {
  const { user, soundEnabled, setSoundEnabled, logout } = useAuth();
  const { connectionStatus } = useSocket();

  const statusConfig = {
    connected: { color: 'var(--green-accent)', label: '● Live', dot: '#10b981' },
    connecting: { color: '#eab308', label: '● Connecting...', dot: '#eab308' },
    mock: { color: 'var(--cyan-accent)', label: '● Demo Mode', dot: '#06b6d4' },
    disconnected: { color: 'var(--text-muted)', label: '● Offline', dot: '#6b7280' }
  };
  const status = statusConfig[connectionStatus] || statusConfig.disconnected;

  return (
    <header className="glass-panel" style={{
      margin: '16px 16px 0 16px',
      padding: '12px 24px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      zIndex: 50
    }}>
      {/* Brand Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{
          width: '42px',
          height: '42px',
          borderRadius: '12px',
          background: 'linear-gradient(135deg, var(--primary-purple) 0%, var(--cyan-accent) 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: 'var(--shadow-glow)'
        }}>
          <Sparkles size={24} color="#ffffff" />
        </div>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: '800', background: 'linear-gradient(90deg, #ffffff, #a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            RandoMeet
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem' }}>
            <span style={{
              display: 'inline-block',
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              background: status.dot,
              boxShadow: `0 0 6px ${status.dot}`
            }} />
            <span style={{ color: status.color, fontWeight: 500 }}>{status.label}</span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <nav style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button
          className={activeTab === 'match' ? 'btn-primary' : 'btn-secondary'}
          onClick={() => setActiveTab('match')}
          style={{ padding: '8px 16px', borderRadius: 'var(--radius-full)' }}
        >
          <MessageSquare size={18} />
          <span>Random Match</span>
        </button>

        <button
          className={activeTab === 'friends' ? 'btn-primary' : 'btn-secondary'}
          onClick={() => setActiveTab('friends')}
          style={{ padding: '8px 16px', borderRadius: 'var(--radius-full)' }}
        >
          <Users size={18} />
          <span>Friends</span>
        </button>
      </nav>

      {/* Right User Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {/* Sound Toggle */}
        <button
          onClick={() => setSoundEnabled(!soundEnabled)}
          className="btn-secondary"
          title={soundEnabled ? "Mute audio chimes" : "Enable audio chimes"}
          style={{ width: '40px', height: '40px', padding: 0, borderRadius: '50%' }}
        >
          {soundEnabled ? <Volume2 size={18} color="var(--cyan-accent)" /> : <VolumeX size={18} color="var(--text-muted)" />}
        </button>

        {/* Profile Avatar Button */}
        <button
          onClick={() => setActiveTab('profile')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid var(--border-color)',
            padding: '6px 14px 6px 6px',
            borderRadius: 'var(--radius-full)',
            cursor: 'pointer',
            color: 'var(--text-primary)'
          }}
        >
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            backgroundColor: '#8b5cf6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.1rem',
            overflow: 'hidden'
          }}>
            {user?.photoUrl ? (
              <img src={user.photoUrl} alt="User Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.target.style.display='none'; }} />
            ) : (
              '⚡'
            )}
          </div>
          <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{user?.name || user?.username}</span>
        </button>

        {/* Logout Action */}
        <button
          onClick={logout}
          className="btn-secondary"
          title="Sign Out / Logout"
          style={{ padding: '8px 14px', borderRadius: 'var(--radius-full)', fontSize: '0.85rem' }}
        >
          Sign Out
        </button>
      </div>
    </header>
  );
}
