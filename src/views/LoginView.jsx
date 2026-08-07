import React, { useState } from 'react';
import { useAuth, AVATAR_LIST, INTEREST_TAGS } from '../context/AuthContext';
import './LoginView.css';

export function LoginView() {
  const { login, signUp, authError, clearAuthError, profilePictures } = useAuth();

  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState('');

  // Login form state
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Sign up form state
  const [signUpUsername, setSignUpUsername] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');
  const [signUpName, setSignUpName] = useState('');
  const [signUpEmail, setSignUpEmail] = useState('');

  const [signUpGender, setSignUpGender] = useState('Non-binary');
  const [signUpBio, setSignUpBio] = useState('');
  const [selectedPhotoUrl, setSelectedPhotoUrl] = useState('');
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
      setLocalError('Please fill in both username and password.');
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
    if (signUpPassword.length < 6) {
      setLocalError('Password must be at least 6 characters long.');
      return;
    }
    if (!photoUrl) {
      setLocalError('Profile picture is required. Please select a profile picture.');
      return;
    }

    setLoading(true);
    try {
      await signUp({
        username: signUpUsername.trim(),
        password: signUpPassword.trim(),
        name: signUpName.trim() || signUpUsername.trim(),
        email: signUpEmail.trim(),
        gender: signUpGender,
        bio: signUpBio.trim(),
        // photoUrl is the API field (matches KMP User.photoUrl)
        photoUrl,
        interests: selectedInterests
      });
    } catch (err) {
      setLocalError(err.message || 'Failed to create account.');
    } finally {
      setLoading(false);
    }
  };

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
              <label htmlFor="login-username">Username or Email</label>
              <div className="input-wrapper">
                <span className="input-icon">👤</span>
                <input
                  id="login-username"
                  type="text"
                  placeholder="e.g. VibeSeeker99"
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
            {/* Avatar / Profile Picture Selector (From API Endpoint) */}
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
                {Array.isArray(profilePictures) && profilePictures.length > 0 ? (
                  profilePictures.map((picUrl, idx) => (
                    <button
                      key={idx}
                      type="button"
                      className={`avatar-pick-item api-pic ${selectedPhotoUrl === picUrl ? 'selected' : ''}`}
                      onClick={() => { setSelectedPhotoUrl(picUrl); setSignUpAvatar(null); }}
                      title={`Profile Picture ${idx + 1}`}
                      style={{ padding: 0, overflow: 'hidden' }}
                    >
                      <img 
                        src={picUrl} 
                        alt={`Profile ${idx + 1}`} 
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    </button>
                  ))
                ) : (
                  AVATAR_LIST.map((item, idx) => (
                    <button
                      key={idx}
                      type="button"
                      className={`avatar-pick-item ${signUpAvatar?.icon === item.icon ? 'selected' : ''}`}
                      style={{ backgroundColor: item.bg }}
                      onClick={() => { setSignUpAvatar(item); setSelectedPhotoUrl(''); }}
                      title={item.label}
                    >
                      <span>{item.icon}</span>
                    </button>
                  ))
                )}
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
                    placeholder="coolusername"
                    value={signUpUsername}
                    onChange={(e) => setSignUpUsername(e.target.value)}
                    disabled={loading}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="signup-name">Display Name</label>
                <div className="input-wrapper">
                  <span className="input-icon">✨</span>
                  <input
                    id="signup-name"
                    type="text"
                    placeholder="Alex Smith"
                    value={signUpName}
                    onChange={(e) => setSignUpName(e.target.value)}
                    disabled={loading}
                  />
                </div>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="signup-email">Email</label>
              <div className="input-wrapper">
                <span className="input-icon">✉️</span>
                <input
                  id="signup-email"
                  type="email"
                  placeholder="you@example.com"
                  value={signUpEmail}
                  onChange={(e) => setSignUpEmail(e.target.value)}
                  disabled={loading}
                  autoComplete="email"
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
                <label htmlFor="signup-gender">Gender</label>
                <select
                  id="signup-gender"
                  className="input-select"
                  value={signUpGender}
                  onChange={(e) => setSignUpGender(e.target.value)}
                  disabled={loading}
                >
                  <option value="Non-binary">Non-binary</option>
                  <option value="Female">Female</option>
                  <option value="Male">Male</option>
                  <option value="Prefer not to say">Prefer not to say</option>
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

        {/* Footer info */}
        <div className="login-footer">
          <p>Protected by JWT Token Authentication • RandoMeet KMP Engine</p>
        </div>
      </div>
    </div>
  );
}
