import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { Sparkles, Users, MessageSquare, Volume2, VolumeX, LogOut } from 'lucide-react';

export function Header({ activeTab, setActiveTab }) {
  const { user, soundEnabled, setSoundEnabled, logout } = useAuth();
  const { connectionStatus } = useSocket();

  const statusConfig = {
    connected: { color: 'var(--green-accent)', label: '● Live', dot: '#10b981' },
    connecting: { color: '#eab308', label: '● Connecting...', dot: '#eab308' },
    disconnected: { color: 'var(--text-muted)', label: '● Offline', dot: '#6b7280' }
  };
  const status = statusConfig[connectionStatus] || statusConfig.disconnected;

  return (
    <header className="glass-panel header-wrapper">
      {/* Brand Logo */}
      <div className="header-brand">
        <div style={{
          width: '42px',
          height: '42px',
          borderRadius: '12px',
          background: 'linear-gradient(135deg, var(--primary-purple) 0%, var(--cyan-accent) 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: 'var(--shadow-glow)',
          flexShrink: 0
        }}>
          <Sparkles size={24} color="#ffffff" />
        </div>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: '800', background: 'linear-gradient(90deg, #ffffff, #a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: 0, lineHeight: 1.2 }}>
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
      <nav className="header-nav">
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
      <div className="header-actions">
        {/* Sound Toggle */}
        <button
          onClick={() => setSoundEnabled(!soundEnabled)}
          className="btn-secondary"
          title={soundEnabled ? "Mute audio chimes" : "Enable audio chimes"}
          style={{ width: '38px', height: '38px', padding: 0, borderRadius: '50%', flexShrink: 0 }}
        >
          {soundEnabled ? <Volume2 size={18} color="var(--cyan-accent)" /> : <VolumeX size={18} color="var(--text-muted)" />}
        </button>

        {/* Profile Avatar Button */}
        <button
          onClick={() => setActiveTab('profile')}
          className="header-user-btn"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid var(--border-color)',
            padding: '4px 12px 4px 4px',
            borderRadius: 'var(--radius-full)',
            cursor: 'pointer',
            color: 'var(--text-primary)'
          }}
          title="View & Edit Profile"
        >
          <div style={{
            width: '30px',
            height: '30px',
            borderRadius: '50%',
            backgroundColor: '#8b5cf6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1rem',
            overflow: 'hidden',
            flexShrink: 0
          }}>
            {user?.photoUrl ? (
              <img src={user.photoUrl} alt="User Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.target.style.display='none'; }} />
            ) : (
              '⚡'
            )}
          </div>
          <span className="header-user-name" style={{ fontSize: '0.85rem', fontWeight: 600 }}>{user?.name || user?.username}</span>
        </button>

        {/* Logout Action */}
        <button
          onClick={logout}
          className="btn-secondary header-signout-btn"
          title="Sign Out / Logout"
          style={{ padding: '8px 14px', borderRadius: 'var(--radius-full)', fontSize: '0.85rem', flexShrink: 0 }}
        >
          <LogOut size={16} />
          <span className="header-signout-text">Sign Out</span>
        </button>
      </div>
    </header>
  );
}
