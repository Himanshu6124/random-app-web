import React, { useState } from 'react';
import { Zap, X, User, Sparkles } from 'lucide-react';

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
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
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
          backgroundColor: '#1C1C1E',
          borderRadius: '24px',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          padding: '28px',
          boxShadow: '0 24px 48px rgba(0, 0, 0, 0.7)',
          position: 'relative',
          color: '#ffffff'
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 16px rgba(99, 102, 241, 0.35)'
          }}>
            <Zap size={24} color="#ffffff" />
          </div>
          <div>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 700, margin: 0, color: '#ffffff' }}>
              Quick Guest Entry
            </h2>
            <p style={{ fontSize: '0.85rem', color: '#a1a1aa', margin: '2px 0 0' }}>
              Instant matching • No password needed
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

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Name Field */}
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#e4e4e7', marginBottom: '8px' }}>
              Your Name *
            </label>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '12px',
              padding: '0 14px'
            }}>
              <User size={18} color="#71717a" style={{ marginRight: '10px' }} />
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
                  color: '#ffffff',
                  fontSize: '0.95rem',
                  padding: '12px 0'
                }}
              />
            </div>
          </div>

          {/* Gender Selector */}
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#e4e4e7', marginBottom: '8px' }}>
              Select Gender *
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <button
                type="button"
                id="guest-gender-male"
                onClick={() => setGender('boy')}
                style={{
                  padding: '12px',
                  borderRadius: '12px',
                  border: gender === 'boy'
                    ? '2px solid #6366f1'
                    : '1px solid rgba(255, 255, 255, 0.1)',
                  backgroundColor: gender === 'boy'
                    ? 'rgba(99, 102, 241, 0.2)'
                    : 'rgba(255, 255, 255, 0.04)',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  fontWeight: 600,
                  fontSize: '0.95rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                <span style={{ fontSize: '1.2rem' }}>👦</span> Male
              </button>

              <button
                type="button"
                id="guest-gender-female"
                onClick={() => setGender('girl')}
                style={{
                  padding: '12px',
                  borderRadius: '12px',
                  border: gender === 'girl'
                    ? '2px solid #ec4899'
                    : '1px solid rgba(255, 255, 255, 0.1)',
                  backgroundColor: gender === 'girl'
                    ? 'rgba(236, 72, 153, 0.2)'
                    : 'rgba(255, 255, 255, 0.04)',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  fontWeight: 600,
                  fontSize: '0.95rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                <span style={{ fontSize: '1.2rem' }}>👧</span> Female
              </button>
            </div>
            <p style={{ fontSize: '0.75rem', color: '#71717a', margin: '6px 0 0' }}>
              An avatar will be automatically assigned for you.
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
              borderRadius: '12px',
              border: 'none',
              background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: '1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              cursor: (loading || !name.trim()) ? 'not-allowed' : 'pointer',
              opacity: (loading || !name.trim()) ? 0.6 : 1,
              boxShadow: '0 8px 20px rgba(99, 102, 241, 0.4)',
              transition: 'all 0.2s'
            }}
          >
            {loading ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" />
                Entering Chat...
              </>
            ) : (
              <>
                <Sparkles size={18} />
                Start Chatting 🚀
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
