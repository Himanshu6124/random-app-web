import React, { useState } from 'react';
import { useAuth, INTEREST_TAGS } from '../context/AuthContext';
import { GuestEntryModal } from '../components/GuestEntryModal';
import './LoginView.css';

export function LoginView() {
  const { login, signUp, loginAsGuest, authError, clearAuthError, profilePictures } = useAuth();

  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [loading, setLoading] = useState(false);
  const [guestModalOpen, setGuestModalOpen] = useState(false);
  const [localError, setLocalError] = useState('');

  // Login form state
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Sign up form state
  const [signUpUsername, setSignUpUsername] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');
  const [signUpName, setSignUpName] = useState('');
  const [signUpEmail, setSignUpEmail] = useState('');
  const [signUpGender, setSignUpGender] = useState('boy');
  const [signUpBio, setSignUpBio] = useState('');
  const [selectedPhotoUrl, setSelectedPhotoUrl] = useState('/userImages/boy1.png');
  const [signUpAvatar, setSignUpAvatar] = useState(null);
  const [selectedInterests, setSelectedInterests] = useState(['Tech', 'Gaming']);

  const handleTabChange = (newMode) => {
    setMode(newMode);
    setLocalError('');
    clearAuthError();
  };

  const toggleInterest = (tag) => {
    setSelectedInterests(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');
    if (!loginUsername.trim() || !loginPassword.trim()) {
      setLocalError('Please enter both username and password.');
      return;
    }
    setLoading(true);
    try {
      await login(loginUsername.trim(), loginPassword.trim());
    } catch (err) {
      setLocalError(err.message || 'Failed to sign in.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUpSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');

    const photoUrl = selectedPhotoUrl || signUpAvatar?.icon || '';

    if (!signUpUsername.trim() || !signUpPassword.trim()) {
      setLocalError('Username and password are required.');
      return;
    }
    if (!signUpName.trim()) {
      setLocalError('Display name is required.');
      return;
    }
    if (!signUpEmail.trim()) {
      setLocalError('Valid email address is required.');
      return;
    }
    if (!signUpGender || !['boy', 'girl'].includes(signUpGender.toLowerCase())) {
      setLocalError('Gender must be "boy" or "girl".');
      return;
    }
    if (signUpPassword.length < 6) {
      setLocalError('Password must be at least 6 characters long.');
      return;
    }
    if (!photoUrl) {
      setLocalError('Profile picture is required. Please select an avatar.');
      return;
    }

    setLoading(true);
    try {
      await signUp({
        username: signUpUsername.trim(),
        password: signUpPassword.trim(),
        name: signUpName.trim(),
        email: signUpEmail.trim(),
        gender: signUpGender.toLowerCase(),
        bio: signUpBio.trim(),
        photoUrl: photoUrl.trim(),
        interests: selectedInterests
      });
    } catch (err) {
      setLocalError(err.message || 'Failed to create account.');
    } finally {
      setLoading(false);
    }
  };

  // Fallback avatars if profile pictures have not yet loaded
  const defaultAvatars = [
    '/userImages/boy1.png',
    '/userImages/boy2.png',
    '/userImages/boy3.png',
    '/userImages/boy4.png',
    '/userImages/girl1.png',
    '/userImages/girl2.png',
    '/userImages/girl3.png',
    '/userImages/girl4.png'
  ];

  const availablePictures = Array.isArray(profilePictures) && profilePictures.length > 0
    ? profilePictures
    : defaultAvatars;

  return (
    <div className="login-page-container">
      <div className="login-bg-glow glow-1"></div>
      <div className="login-bg-glow glow-2"></div>

      <div className="login-card glass-panel animate-fade-in">
        {/* Brand Header */}
        <div className="login-header">
          <div className="login-logo animate-glow">
            <span className="logo-icon">⚡</span>
          </div>
          <h1 className="login-title">RandoMeet</h1>
          <p className="login-subtitle">Connect instantly with people worldwide</p>
        </div>

        {/* Mode Switcher */}
        <div className="auth-tab-bar">
          <button 
            type="button"
            className={`auth-tab-btn ${mode === 'login' ? 'active' : ''}`}
            onClick={() => handleTabChange('login')}
          >
            Sign In
          </button>
          <button 
            type="button"
            className={`auth-tab-btn ${mode === 'signup' ? 'active' : ''}`}
            onClick={() => handleTabChange('signup')}
          >
            Create Account
          </button>
        </div>

        {/* Error Alert */}
        {(localError || authError) && (
          <div className="auth-error-alert">
            <span className="error-icon">⚠️</span>
            <span>{localError || authError}</span>
          </div>
        )}

        {/* Login Form */}
        {mode === 'login' ? (
          <form className="auth-form" onSubmit={handleLoginSubmit}>
            <div className="form-group">
              <label htmlFor="login-username">Username</label>
              <div className="input-wrapper">
                <span className="input-icon">👤</span>
                <input
                  id="login-username"
                  type="text"
                  placeholder="e.g. alice"
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  disabled={loading}
                  autoComplete="username"
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="login-password">Password</label>
              <div className="input-wrapper">
                <span className="input-icon">🔒</span>
                <input
                  id="login-password"
                  type="password"
                  placeholder="••••••••"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  disabled={loading}
                  autoComplete="current-password"
                  required
                />
              </div>
            </div>

            <button 
              type="submit" 
              className="btn-primary auth-submit-btn" 
              disabled={loading}
            >
              {loading ? (
                <span className="btn-spinner"></span>
              ) : (
                <>Sign In to RandoMeet 🚀</>
              )}
            </button>
          </form>
        ) : (
          /* Sign Up Form */
          <form className="auth-form" onSubmit={handleSignUpSubmit}>
            {/* Avatar / Profile Picture Selector */}
            <div className="form-group">
              <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Profile Picture *</span>
                {!(selectedPhotoUrl || signUpAvatar) ? (
                  <span style={{ fontSize: '0.75rem', color: '#f87171', textTransform: 'none', fontWeight: '500' }}>
                    Required
                  </span>
                ) : (
                  <span style={{ fontSize: '0.75rem', color: 'var(--cyan-accent)', textTransform: 'none', fontWeight: '500' }}>
                    ✓ Selected
                  </span>
                )}
              </label>
              <div className="avatar-picker-grid">
                {availablePictures.map((picUrl, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className={`avatar-pick-item api-pic ${selectedPhotoUrl === picUrl ? 'selected' : ''}`}
                    onClick={() => { setSelectedPhotoUrl(picUrl); setSignUpAvatar(null); }}
                    title={`Avatar ${idx + 1}`}
                    style={{ padding: 0, overflow: 'hidden' }}
                  >
                    <img 
                      src={picUrl} 
                      alt={`Avatar ${idx + 1}`} 
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  </button>
                ))}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="signup-username">Username *</label>
                <div className="input-wrapper">
                  <span className="input-icon">@</span>
                  <input
                    id="signup-username"
                    type="text"
                    placeholder="alice"
                    value={signUpUsername}
                    onChange={(e) => setSignUpUsername(e.target.value)}
                    disabled={loading}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="signup-name">Display Name *</label>
                <div className="input-wrapper">
                  <span className="input-icon">✨</span>
                  <input
                    id="signup-name"
                    type="text"
                    placeholder="Alice Wonderland"
                    value={signUpName}
                    onChange={(e) => setSignUpName(e.target.value)}
                    disabled={loading}
                    required
                  />
                </div>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="signup-email">Email *</label>
              <div className="input-wrapper">
                <span className="input-icon">✉️</span>
                <input
                  id="signup-email"
                  type="email"
                  placeholder="alice@example.com"
                  value={signUpEmail}
                  onChange={(e) => setSignUpEmail(e.target.value)}
                  disabled={loading}
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="signup-password">Password *</label>
                <div className="input-wrapper">
                  <span className="input-icon">🔒</span>
                  <input
                    id="signup-password"
                    type="password"
                    placeholder="••••••••"
                    value={signUpPassword}
                    onChange={(e) => setSignUpPassword(e.target.value)}
                    disabled={loading}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="signup-gender">Gender *</label>
                <select
                  id="signup-gender"
                  className="input-select"
                  value={signUpGender}
                  onChange={(e) => setSignUpGender(e.target.value)}
                  disabled={loading}
                  required
                >
                  <option value="boy">Boy</option>
                  <option value="girl">Girl</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="signup-bio">Bio / About You</label>
              <textarea
                id="signup-bio"
                className="input-textarea"
                rows="2"
                placeholder="Tell others what you love to chat about..."
                value={signUpBio}
                onChange={(e) => setSignUpBio(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label>Select Interests</label>
              <div className="interest-picker-tags">
                {INTEREST_TAGS.map(tag => (
                  <button
                    key={tag}
                    type="button"
                    className={`tag-pill ${selectedInterests.includes(tag) ? 'active' : ''}`}
                    onClick={() => toggleInterest(tag)}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            <button 
              type="submit" 
              className="btn-cyan auth-submit-btn" 
              disabled={loading}
            >
              {loading ? (
                <span className="btn-spinner"></span>
              ) : (
                <>Create Account & Enter 🚀</>
              )}
            </button>
          </form>
        )}

        {/* Guest Mode Entry Section */}
        <div style={{
          marginTop: '20px',
          paddingTop: '20px',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          textAlign: 'center'
        }}>
          <button
            type="button"
            id="continue-as-guest-btn"
            onClick={() => setGuestModalOpen(true)}
            style={{
              width: '100%',
              padding: '13px 18px',
              borderRadius: '12px',
              background: 'rgba(99, 102, 241, 0.15)',
              border: '1px solid rgba(99, 102, 241, 0.4)',
              color: '#a5b4fc',
              fontWeight: 700,
              fontSize: '0.98rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              cursor: 'pointer',
              transition: 'all 0.2s',
              boxShadow: '0 4px 14px rgba(99, 102, 241, 0.15)'
            }}
          >
            <span style={{ fontSize: '1.2rem' }}>⚡</span>
            Continue as Guest
          </button>
          <p style={{ fontSize: '0.78rem', color: '#71717a', marginTop: '8px', marginBottom: 0 }}>
            Enter with just your name & gender • Instant matching
          </p>
        </div>

        {/* Footer info */}
        <div className="login-footer">
          <p>Protected by JWT Token Authentication • Chat Monolith Engine</p>
        </div>
      </div>

      <GuestEntryModal
        isOpen={guestModalOpen}
        onClose={() => setGuestModalOpen(false)}
        onGuestSubmit={async (guestData) => {
          await loginAsGuest(guestData);
          setGuestModalOpen(false);
        }}
      />
    </div>
  );
}
