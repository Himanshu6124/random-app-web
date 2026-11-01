import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Sparkles, X, Lock, User, Mail, Key } from 'lucide-react';

export function GuestUpgradeModal() {
  const {
    user,
    profilePictures,
    upgradeModalOpen,
    upgradeModalReason,
    closeUpgradeModal,
    upgradeGuestAccount
  } = useAuth();

  const [username, setUsername] = useState('');
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [gender, setGender] = useState(user?.gender || 'boy');
  const [photoUrl, setPhotoUrl] = useState(user?.photoUrl || (user?.gender === 'girl' ? '/userImages/girl1.png' : '/userImages/boy1.png'));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!upgradeModalOpen) return null;

  const boyAvatars = [
    '/userImages/boy1.png',
    '/userImages/boy2.png',
    '/userImages/boy3.png',
    '/userImages/boy4.png',
    '/userImages/boy5.png',
    '/userImages/boy6.png',
    '/userImages/boy7.png',
    '/userImages/boy8.png'
  ];

  const girlAvatars = [
    '/userImages/girl1.png',
    '/userImages/girl2.png',
    '/userImages/girl3.png',
    '/userImages/girl4.png',
    '/userImages/girl5.png',
    '/userImages/girl6.png',
    '/userImages/girl7.png',
    '/userImages/girl8.png'
  ];

  const currentGender = (gender || user?.gender || 'boy').toLowerCase();
  const avatarList = currentGender === 'girl' ? girlAvatars : boyAvatars;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !name.trim() || !email.trim() || !password.trim()) {
      setError('Please fill in all required fields.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      await upgradeGuestAccount({
        username: username.trim(),
        name: name.trim(),
        email: email.trim(),
        password: password.trim(),
        gender,
        photoUrl
      });
    } catch (err) {
      setError(err.message || 'Upgrade failed.');
      setLoading(false);
    }
  };

  return (
    <div
      id="guest-upgrade-modal-backdrop"
      onClick={(e) => {
        if (e.target.id === 'guest-upgrade-modal-backdrop') closeUpgradeModal();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1100,
        padding: '16px',
        overflowY: 'auto'
      }}
    >
      <div
        className="glass-panel animate-scale-up"
        style={{
          width: '100%',
          maxWidth: '460px',
          backgroundColor: '#1C1C1E',
          borderRadius: '24px',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          padding: '28px',
          boxShadow: '0 24px 50px rgba(0, 0, 0, 0.8)',
          position: 'relative',
          color: '#ffffff',
          maxHeight: '90vh',
          overflowY: 'auto'
        }}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={closeUpgradeModal}
          id="upgrade-modal-close-btn"
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: 'rgba(255, 255, 255, 0.08)',
            border: 'none',
            borderRadius: '50%',
            width: '36px',
            height: '36px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#a1a1aa',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          <X size={18} />
        </button>

        {/* Header Icon */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #10b981, #059669)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 16px rgba(16, 185, 129, 0.35)'
          }}>
            <Sparkles size={24} color="#ffffff" />
          </div>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: '#ffffff' }}>
              Create Free Account
            </h2>
            <p style={{ fontSize: '0.85rem', color: '#34d399', margin: '2px 0 0', fontWeight: 500 }}>
              {upgradeModalReason
                ? (upgradeModalReason.charAt(0).toUpperCase() + upgradeModalReason.slice(1))
                : 'Save friends & unlock direct messaging!'}
            </p>
          </div>
        </div>

        {error && (
          <div style={{
            padding: '10px 14px',
            borderRadius: '10px',
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#f87171',
            fontSize: '0.88rem',
            marginBottom: '16px'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Gender Selector */}
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#e4e4e7', marginBottom: '6px' }}>
              Gender *
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {['boy', 'girl'].map(g => (
                <button
                  key={g}
                  type="button"
                  onClick={() => {
                    setGender(g);
                    if (g === 'girl' && !photoUrl.includes('/girl')) {
                      setPhotoUrl('/userImages/girl1.png');
                    } else if (g === 'boy' && !photoUrl.includes('/boy')) {
                      setPhotoUrl('/userImages/boy1.png');
                    }
                  }}
                  style={{
                    flex: 1,
                    padding: '8px',
                    borderRadius: '10px',
                    border: currentGender === g ? '2px solid #10b981' : '1px solid rgba(255, 255, 255, 0.1)',
                    background: currentGender === g ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                    color: '#ffffff',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  {g === 'boy' ? '👦 Male (Boy)' : '👧 Female (Girl)'}
                </button>
              ))}
            </div>
          </div>

          {/* Avatar Selector */}
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#e4e4e7', marginBottom: '6px' }}>
              Choose {currentGender === 'girl' ? 'Female' : 'Male'} Avatar (8 Available)
            </label>
            <div style={{
              display: 'flex',
              gap: '8px',
              overflowX: 'auto',
              paddingBottom: '6px'
            }}>
              {avatarList.map((uri, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setPhotoUrl(uri)}
                  style={{
                    width: '46px',
                    height: '46px',
                    borderRadius: '12px',
                    border: photoUrl === uri ? '2px solid #10b981' : '1px solid rgba(255, 255, 255, 0.1)',
                    padding: 0,
                    background: photoUrl === uri ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                    cursor: 'pointer',
                    flexShrink: 0,
                    overflow: 'hidden'
                  }}
                >
                  <img src={uri} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </button>
              ))}
            </div>
          </div>

          {/* Username */}
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#e4e4e7', marginBottom: '6px' }}>
              Username *
            </label>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '10px',
              padding: '0 12px'
            }}>
              <User size={16} color="#71717a" style={{ marginRight: '8px' }} />
              <input
                id="upgrade-username-input"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. alex24"
                required
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: '#ffffff',
                  fontSize: '0.9rem',
                  padding: '10px 0'
                }}
              />
            </div>
          </div>

          {/* Display Name */}
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#e4e4e7', marginBottom: '6px' }}>
              Display Name *
            </label>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '10px',
              padding: '0 12px'
            }}>
              <User size={16} color="#71717a" style={{ marginRight: '8px' }} />
              <input
                id="upgrade-name-input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Display Name"
                required
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: '#ffffff',
                  fontSize: '0.9rem',
                  padding: '10px 0'
                }}
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#e4e4e7', marginBottom: '6px' }}>
              Email *
            </label>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '10px',
              padding: '0 12px'
            }}>
              <Mail size={16} color="#71717a" style={{ marginRight: '8px' }} />
              <input
                id="upgrade-email-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                required
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: '#ffffff',
                  fontSize: '0.9rem',
                  padding: '10px 0'
                }}
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#e4e4e7', marginBottom: '6px' }}>
              Password (min 6 chars) *
            </label>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '10px',
              padding: '0 12px'
            }}>
              <Key size={16} color="#71717a" style={{ marginRight: '8px' }} />
              <input
                id="upgrade-password-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: '#ffffff',
                  fontSize: '0.9rem',
                  padding: '10px 0'
                }}
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            id="upgrade-modal-submit-btn"
            disabled={loading}
            style={{
              marginTop: '10px',
              padding: '14px',
              borderRadius: '12px',
              border: 'none',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: '1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              boxShadow: '0 8px 20px rgba(16, 185, 129, 0.4)',
              transition: 'all 0.2s'
            }}
          >
            {loading ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" />
                Upgrading Account...
              </>
            ) : (
              <>
                <Lock size={18} />
                Create Account & Unlock All
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
