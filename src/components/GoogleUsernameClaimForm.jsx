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
  const [gender, setGender] = useState('boy');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!username.trim() || !name.trim()) return;
    onSubmit({ username: username.trim(), name: name.trim(), gender });
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
            onChange={(e) => setGender(e.target.value)}
            disabled={loading}
            style={{ background: 'transparent', color: 'white', border: 'none', outline: 'none', flex: 1 }}
          >
            <option value="boy" style={{ background: '#1C1C1E' }}>Boy</option>
            <option value="girl" style={{ background: '#1C1C1E' }}>Girl</option>
          </select>
        </div>
      </div>

      {/* Avatar preview of what the backend will assign per gender */}
      <div className="form-group">
        <label>Avatar preview</label>
        <div className="avatar-picker-grid">
          {(gender === 'girl' ? girlAvatars : boyAvatars).map((picUrl, idx) => (
            <div
              key={idx}
              className="avatar-pick-item api-pic"
              title="Assigned randomly at account creation"
              style={{ padding: 0, overflow: 'hidden', cursor: 'default', opacity: 0.85 }}
            >
              <img
                src={picUrl}
                alt={`Avatar ${idx + 1}`}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            </div>
          ))}
        </div>

        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          One of these is picked for you at random.
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
