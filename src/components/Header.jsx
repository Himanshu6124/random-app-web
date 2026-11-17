import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { Users, MessageSquare, Volume2, VolumeX, LogOut, Compass, UserRound } from 'lucide-react';

export function Header({ activeTab, setActiveTab }) {
  const { user, isGuest, soundEnabled, setSoundEnabled, logout, totalUnreadFriendsCount, friendRequests } = useAuth();
  const { unreadRandomCount } = useSocket();

  return (
    <header className="glass-panel header-wrapper">
      {/* Brand Logo */}
      <div className="header-brand">
        <h1 className="app-wordmark">RandomChatly</h1>
      </div>

      {/* Navigation Tabs */}
      <nav className="header-nav">
        <button
          className={activeTab === 'match' ? 'btn-secondary is-current' : 'btn-secondary'}
          onClick={() => setActiveTab('match')}
          style={{ padding: '8px 16px', borderRadius: 'var(--radius-full)', display: 'flex', alignItems: 'center', gap: '6px', position: 'relative' }}
        >
          <MessageSquare size={18} />
          <span>Random Match</span>
          {unreadRandomCount > 0 && (
            <span className="app-count">{unreadRandomCount}</span>
          )}
        </button>

        <button
          className={activeTab === 'discover' ? 'btn-secondary is-current' : 'btn-secondary'}
          onClick={() => setActiveTab('discover')}
          aria-current={activeTab === 'discover' ? 'page' : undefined}
          style={{ padding: '8px 16px', borderRadius: 'var(--radius-full)', display: 'flex', alignItems: 'center', gap: '6px', position: 'relative' }}
          title="Find people, see who is nearby and your match history"
        >
          <Compass size={18} />
          <span>Discover</span>
        </button>

        <button
          className={activeTab === 'friends' ? 'btn-secondary is-current' : 'btn-secondary'}
          onClick={() => setActiveTab('friends')}
          style={{ padding: '8px 16px', borderRadius: 'var(--radius-full)', display: 'flex', alignItems: 'center', gap: '6px', position: 'relative' }}
          title="View Friends"
        >
          <Users size={18} />
          <span>Friends</span>
          {totalUnreadFriendsCount + (friendRequests?.length || 0) > 0 && (
            <span className="app-count">{totalUnreadFriendsCount + (friendRequests?.length || 0)}</span>
          )}
        </button>
      </nav>

      {/* Right User Actions */}
      <div className="header-actions">
        {/* Sound Toggle */}
        <button
          onClick={() => setSoundEnabled(!soundEnabled)}
          className="btn-secondary"
          title={soundEnabled ? "Mute audio chimes" : "Enable audio chimes"}
          style={{ width: '44px', height: '44px', padding: 0, borderRadius: '50%', flexShrink: 0 }}
        >
          {soundEnabled ? <Volume2 size={18} color="var(--text-primary)" /> : <VolumeX size={18} color="var(--text-muted)" />}
        </button>

        {/* Profile Avatar Button */}
        <button
          onClick={() => setActiveTab('profile')}
          className="header-user-btn"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'transparent',
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
            backgroundColor: 'var(--plum-4)',
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 'var(--fs-base)',
            overflow: 'hidden',
            flexShrink: 0
          }}>
            {user?.photoUrl ? (
              <img src={user.photoUrl} alt="User Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.target.style.display='none'; }} />
            ) : (
              <UserRound size={16} aria-hidden="true" />
            )}
          </div>
          <span className="header-user-name" style={{ fontSize: 'var(--fs-md)', fontWeight: 600 }}>{user?.name || user?.username}</span>
          {isGuest && (
            <span style={{
              fontSize: 'var(--fs-xs)',
              fontWeight: 600,
              color: 'var(--accent)',
              border: '1px solid var(--accent-line)',
              padding: '1px 6px',
              borderRadius: 'var(--radius-xs)'
            }}>
              Guest
            </span>
          )}
        </button>

        {/* Logout Action */}
        <button
          onClick={logout}
          className="btn-secondary header-signout-btn"
          title={isGuest ? "Exit Guest Session" : "Sign Out / Logout"}
          style={{ padding: '8px 14px', borderRadius: 'var(--radius-full)', fontSize: 'var(--fs-md)', flexShrink: 0 }}
        >
          <LogOut size={16} />
          <span className="header-signout-text">{isGuest ? 'Exit' : 'Sign Out'}</span>
        </button>
      </div>
    </header>
  );
}
