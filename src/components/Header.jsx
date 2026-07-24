import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { Sparkles, Users, MessageSquare, User, Volume2, VolumeX, Server } from 'lucide-react';

export function Header({ activeTab, setActiveTab }) {
  const { user, soundEnabled, setSoundEnabled } = useAuth();
  const { useLiveSocket, setUseLiveSocket, serverUrl, setServerUrl, authToken, setAuthToken } = useSocket();
  const [showServerModal, setShowServerModal] = useState(false);
  const [inputUrl, setInputUrl] = useState(serverUrl);
  const [inputToken, setInputToken] = useState(authToken);

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
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            <span className="badge-online"></span>
            <span>1,420 Online</span>
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

        {/* Server Config Modal Trigger */}
        <button
          onClick={() => setShowServerModal(true)}
          className="btn-secondary"
          title="App Socket Settings"
          style={{ width: '40px', height: '40px', padding: 0, borderRadius: '50%' }}
        >
          <Server size={18} color={useLiveSocket ? "var(--green-accent)" : "var(--text-secondary)"} />
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
            backgroundColor: user.avatarBg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.1rem'
          }}>
            {user.avatar}
          </div>
          <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{user.name}</span>
        </button>
      </div>

      {/* Server Settings Modal */}
      {showServerModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div className="glass-panel" style={{ width: '440px', padding: '24px' }}>
            <h3 style={{ marginBottom: '16px', fontSize: '1.2rem' }}>📱 RandoMeet App STOMP Protocol</h3>
            
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={useLiveSocket}
                  onChange={(e) => setUseLiveSocket(e.target.checked)}
                  style={{ width: '18px', height: '18px' }}
                />
                <span style={{ fontWeight: 600 }}>Connect to App STOMP Server</span>
              </label>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                {useLiveSocket ? 'Connecting to mobile app STOMP endpoint' : 'Using instant interactive stranger simulator'}
              </p>
            </div>

            {useLiveSocket && (
              <>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>STOMP WebSocket Base URL:</label>
                  <input
                    type="text"
                    value={inputUrl}
                    onChange={(e) => setInputUrl(e.target.value)}
                    placeholder="wss://randomchat.qz.io/ws-chat"
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      marginTop: '6px',
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border-color)',
                      color: 'white',
                      fontSize: '0.9rem',
                      outline: 'none'
                    }}
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    App default: <code>wss://randomchat.qz.io/ws-chat</code>
                  </span>
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Auth JWT Token:</label>
                  <input
                    type="text"
                    value={inputToken}
                    onChange={(e) => setInputToken(e.target.value)}
                    placeholder="Bearer JWT Token..."
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      marginTop: '6px',
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border-color)',
                      color: 'white',
                      fontSize: '0.85rem',
                      outline: 'none'
                    }}
                  />
                </div>
              </>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                className="btn-secondary"
                onClick={() => setShowServerModal(false)}
              >
                Close
              </button>
              <button
                className="btn-primary"
                onClick={() => {
                  setServerUrl(inputUrl);
                  setAuthToken(inputToken);
                  setShowServerModal(false);
                }}
              >
                Save & Connect
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
