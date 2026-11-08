import React, { useState } from 'react';

const boyAvatars = Array.from({ length: 8 }, (_, i) => `/userImages/boy${i + 1}.png`);
const girlAvatars = Array.from({ length: 8 }, (_, i) => `/userImages/girl${i + 1}.png`);

/**
 * Username-claim step for brand-new Google users (CONTRACT 3).
 * Shown right after the Google popup succeeds, before the account is created.
 * Shared by the login screen and the guest-upgrade modal so the avatar/gender UI
 * exists in exactly one place.
 *
 * Props:
 * - suggestion:  { suggestedUsername, name, email, photoUrl } hints from the backend
 * - loading:     submit in flight
 * - error:       inline error string (e.g. "Username already exists")
 * - onSubmit:    ({ username, name, gender }) => Promise
 * - onCancel:    optional back/cancel affordance
 */
export function GoogleUsernameClaimForm({ suggestion, loading, error, onSubmit, onCancel }) {
  const [username, setUsername] = useState(suggestion?.suggestedUsername || '');
  const [name, setName] = useState(suggestion?.name || suggestion?.suggestedUsername || '');
  const [gender, setGender] = useState(suggestion?.gender || 'boy');
  const [photoUrl, setPhotoUrl] = useState(
    suggestion?.photoUrl || (suggestion?.gender === 'girl' ? '/userImages/girl1.png' : '/userImages/boy1.png')
  );

  const handleGenderChange = (newGender) => {
    setGender(newGender);
    if (newGender === 'girl' && !photoUrl.includes('/girl')) {
      setPhotoUrl('/userImages/girl1.png');
    } else if (newGender === 'boy' && !photoUrl.includes('/boy')) {
      setPhotoUrl('/userImages/boy1.png');
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!username.trim() || !name.trim()) return;
    onSubmit({ username: username.trim(), name: name.trim(), gender, photoUrl });
  };

  return (
    <form className="auth-form" onSubmit={handleSubmit} id="google-username-claim-form">
      <div className="form-group" style={{ textAlign: 'center' }}>
        <p style={{ fontSize: '0.92rem', color: 'var(--text-secondary)', margin: '0 0 4px 0' }}>
          {suggestion?.email ? (
            <>Signed in as <strong style={{ color: '#ffffff' }}>{suggestion.email}</strong></>
          ) : (
            <>Google sign-in succeeded</>
          )}
        </p>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>
          One last step — pick the username you will be known by.
        </p>
      </div>

      <div className="form-group">
        <label htmlFor="google-claim-username">Username *</label>
        <div className="input-wrapper">
          <span className="input-icon">@</span>
          <input
            id="google-claim-username"
            type="text"
            placeholder="your_handle"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={loading}
            minLength={3}
            maxLength={30}
            pattern="[a-zA-Z0-9_]+"
            autoComplete="username"
            required
          />
        </div>
        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          3-30 characters · letters, numbers, underscores
        </span>
      </div>

      <div className="form-group">
        <label htmlFor="google-claim-name">Display Name *</label>
        <div className="input-wrapper">
          <span className="input-icon">👤</span>
          <input
            id="google-claim-name"
            type="text"
            placeholder="How others see you"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={loading}
            maxLength={50}
            required
          />
        </div>
      </div>

      <div className="form-group">
        <label>Gender</label>
        <div className="input-wrapper">
          <span className="input-icon">🧑</span>
          <select
            id="google-claim-gender"
            value={gender}
            onChange={(e) => handleGenderChange(e.target.value)}
            disabled={loading}
            style={{ background: 'transparent', color: 'white', border: 'none', outline: 'none', flex: 1 }}
          >
            <option value="boy" style={{ background: '#1C1C1E' }}>Boy</option>
            <option value="girl" style={{ background: '#1C1C1E' }}>Girl</option>
          </select>
        </div>
      </div>

      {/* Avatar selector */}
      <div className="form-group">
        <label>Choose Avatar *</label>
        <div className="avatar-picker-grid">
          {(gender === 'girl' ? girlAvatars : boyAvatars).map((picUrl, idx) => {
            const isSelected = photoUrl === picUrl;
            return (
              <button
                key={idx}
                type="button"
                className={`avatar-pick-item api-pic ${isSelected ? 'selected' : ''}`}
                onClick={() => setPhotoUrl(picUrl)}
                title={`Select Avatar ${idx + 1}`}
                style={{
                  padding: 0,
                  overflow: 'hidden',
                  cursor: 'pointer',
                  border: isSelected ? '3px solid #10b981' : '2px solid rgba(255, 255, 255, 0.1)',
                  boxShadow: isSelected ? '0 0 15px rgba(16, 185, 129, 0.6)' : 'none',
                  transform: isSelected ? 'scale(1.08)' : 'scale(1)',
                  transition: 'all 0.2s ease',
                  background: 'transparent'
                }}
              >
                <img
                  src={picUrl}
                  alt={`Avatar ${idx + 1}`}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              </button>
            );
          })}
        </div>

        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          Click to choose your profile picture
        </span>
      </div>

      {error && (
        <div id="google-claim-error" style={{
          padding: '8px 12px',
          borderRadius: '10px',
          background: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid rgba(239, 68, 68, 0.4)',
          color: '#fca5a5',
          fontSize: '0.82rem',
          marginBottom: '12px'
        }}>
          {error}
        </div>
      )}

      <button
        type="submit"
        className="btn-primary auth-submit-btn"
        id="google-claim-submit-btn"
        disabled={loading || !username.trim() || !name.trim()}
      >
        {loading ? <span className="btn-spinner"></span> : <>Create Account & Enter 🚀</>}
      </button>

      {onCancel && (
        <button
          type="button"
          className="btn-secondary auth-submit-btn"
          onClick={onCancel}
          disabled={loading}
          style={{ marginTop: '8px' }}
        >
          Back
        </button>
      )}
    </form>
  );
}
