import React, { useState } from 'react';
import { X, User } from 'lucide-react';

export function GuestEntryModal({ isOpen, onClose, onGuestSubmit }) {
  const [name, setName] = useState('');
  const [gender, setGender] = useState('boy');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Please enter your name.');
      return;
    }

    setLoading(true);
    try {
      await onGuestSubmit({ name: trimmedName, gender });
    } catch (err) {
      setError(err.message || 'Failed to start guest session.');
      setLoading(false);
    }
  };

  return (
    <div className="m-sheet-backdrop"
      id="guest-entry-modal-backdrop"
      onClick={(e) => {
        if (e.target.id === 'guest-entry-modal-backdrop') onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'var(--scrim)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '16px'
      }}
    >
      <div
        className="glass-panel animate-scale-up m-sheet"
        style={{
          width: '100%',
          maxWidth: '420px',
          backgroundColor: '#21141f',
          borderRadius: 'var(--radius-xl)',
          border: '1px solid var(--border-color)',
          padding: '28px',
          boxShadow: 'var(--shadow-pop)',
          position: 'relative',
          color: 'var(--text-primary)'
        }}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          id="guest-modal-close-btn"
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: 'var(--plum-3)',
            border: 'none',
            borderRadius: '50%',
            width: '44px',
            height: '44px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#c9b6bf',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          <X size={18} />
        </button>

        {/* Header Icon */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px' }}>
          <div>
            <h2 style={{ fontSize: 'var(--fs-xl)', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              Quick Guest Entry
            </h2>
            <p style={{ fontSize: 'var(--fs-md)', color: '#c9b6bf', margin: '2px 0 0' }}>
              Instant matching • No password needed
            </p>
          </div>
        </div>

        {error && (
          <div style={{
            padding: '10px 14px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--danger-tint)',
            border: '1px solid var(--danger-line)',
            color: 'var(--danger)',
            fontSize: 'var(--fs-md)',
            marginBottom: '16px'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Name Field */}
          <div>
            <label style={{ display: 'block', fontSize: 'var(--fs-md)', fontWeight: 600, color: '#f5ecef', marginBottom: '8px' }}>
              Your Name *
            </label>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: 'var(--plum-0)',
              border: '1px solid var(--border-strong)',
              borderRadius: 'var(--radius-md)',
              padding: '0 14px'
            }}>
              <User size={18} color="#a8939e" style={{ marginRight: '10px' }} />
              <input
                id="guest-name-input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Alex"
                maxLength={30}
                required
                autoFocus
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-sub)',
                  fontSize: 'var(--fs-base)',
                  padding: '12px 0'
                }}
              />
            </div>
          </div>

          {/* Gender Selector */}
          <div>
            <label style={{ display: 'block', fontSize: 'var(--fs-md)', fontWeight: 600, color: '#f5ecef', marginBottom: '8px' }}>
              Select Gender *
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
              {[['boy', 'Male', 'male'], ['girl', 'Female', 'female'], ['other', 'Other', 'other']].map(([value, label, idPart]) => (
                <button
                  key={value}
                  type="button"
                  id={`guest-gender-${idPart}`}
                  onClick={() => setGender(value)}
                  style={{
                    padding: '12px',
                    borderRadius: 'var(--radius-md)',
                    border: gender === value
                      ? '1.5px solid var(--accent)'
                      : '1px solid rgba(255, 255, 255, 0.1)',
                    backgroundColor: gender === value
                      ? 'var(--plum-5)'
                      : 'var(--plum-3)',
                    color: gender === value ? 'var(--accent)' : 'var(--text-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    fontWeight: 600,
                    fontSize: 'var(--fs-body)',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', margin: '6px 0 0' }}>
              An avatar will be automatically assigned for you.
            </p>
            <p id="guest-gender-warning" style={{ fontSize: 'var(--fs-sm)', color: 'var(--accent)', margin: '4px 0 0' }}>
              Heads up: you can't change your gender once it's set.
            </p>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            id="guest-modal-submit-btn"
            disabled={loading || !name.trim()}
            style={{
              marginTop: '8px',
              padding: '14px',
              borderRadius: 'var(--radius-md)',
              border: 'none',
              background: (loading || !name.trim()) ? 'var(--plum-3)' : 'var(--accent)',
              color: (loading || !name.trim()) ? 'var(--text-muted)' : 'var(--accent-ink)',
              fontFamily: 'var(--font-main)',
              fontWeight: 700,
              fontSize: 'var(--fs-base)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              cursor: (loading || !name.trim()) ? 'not-allowed' : 'pointer',
              
              transition: 'all 0.2s'
            }}
          >
            {loading ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" />
                Entering Chat...
              </>
            ) : (
              'Start Chatting'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
