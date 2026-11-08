import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { signInWithGooglePopup } from '../services/firebaseClient';
import { GoogleUsernameClaimForm } from './GoogleUsernameClaimForm';
import { Sparkles, X } from 'lucide-react';

export function GuestUpgradeModal() {
  const {
    user,
    upgradeModalOpen,
    upgradeModalReason,
    closeUpgradeModal,
    linkGoogleAccount,
    firebaseConfigured,
    performLogout
  } = useAuth();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [conflictChoice, setConflictChoice] = useState(false);
  const [pendingIdToken, setPendingIdToken] = useState(null);
  const [googleClaim, setGoogleClaim] = useState(null);
  const [claimLoading, setClaimLoading] = useState(false);
  const [claimError, setClaimError] = useState('');

  if (!upgradeModalOpen) return null;

  const handleClose = () => {
    setGoogleClaim(null);
    setPendingIdToken(null);
    setError('');
    setClaimError('');
    setConflictChoice(false);
    closeUpgradeModal();
  };

  /**
   * Prompts the Google popup. Once authenticated, prompt the user with the same
   * username, name, gender, and avatar selection dialog as the main login page.
   */
  const handleGoogleLink = async () => {
    setError('');
    setLoading(true);
    try {
      const fbUser = await signInWithGooglePopup();
      const idToken = await fbUser.getIdToken();
      setPendingIdToken(idToken);

      const baseUsername = user?.name
        ? user.name.toLowerCase().replace(/[^a-z0-9_]/g, '_').substring(0, 30)
        : (fbUser.email ? fbUser.email.split('@')[0].replace(/[^a-z0-9_]/g, '_').substring(0, 30) : '');

      setGoogleClaim({
        email: fbUser.email,
        name: user?.name || fbUser.displayName || '',
        suggestedUsername: baseUsername || 'user_' + Math.random().toString(36).substring(2, 7),
        gender: user?.gender || 'boy',
        photoUrl: user?.photoUrl || ''
      });
    } catch (err) {
      const message = err.message || 'Google account linking failed.';
      if (message.toLowerCase().includes('already has a profile')) {
        setConflictChoice(true);
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClaimSubmit = async ({ username, name, gender, photoUrl }) => {
    setClaimError('');
    setClaimLoading(true);
    try {
      await linkGoogleAccount(pendingIdToken, { username, name, gender, photoUrl });
      handleClose();
    } catch (err) {
      const message = err.message || 'Google account linking failed.';
      if (message.toLowerCase().includes('already has a profile')) {
        setConflictChoice(true);
      } else {
        setClaimError(message);
      }
    } finally {
      setClaimLoading(false);
    }
  };

  return (
    <div
      id="guest-upgrade-modal-backdrop"
      onClick={(e) => {
        if (e.target.id === 'guest-upgrade-modal-backdrop') handleClose();
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
          onClick={handleClose}
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
            transition: 'all 0.2s',
            zIndex: 10
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

        {conflictChoice ? (
          /* CONFLICT: this Google account already has a profile. Offer a clear choice
             instead of silently dropping the user out of their chat (CONTRACT B1-4). */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <p style={{ fontSize: '0.9rem', color: '#e4e4e7', margin: 0 }}>
              Your Google account already has a profile in this app. You can open the login
              screen and sign into it — but that means leaving your <strong>current chat</strong>.
            </p>
            <button
              type="button"
              id="upgrade-conflict-leave-btn"
              onClick={() => {
                handleClose();
                performLogout();
              }}
              style={{
                padding: '12px', borderRadius: '12px', border: 'none',
                background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)',
                color: '#ffffff', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer'
              }}
            >
              Leave chat & open login screen
            </button>
            <button
              type="button"
              onClick={() => { setConflictChoice(false); setError(''); }}
              style={{
                padding: '12px', borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                background: 'rgba(255, 255, 255, 0.06)',
                color: '#ffffff', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer'
              }}
            >
              Stay in this chat
            </button>
          </div>
        ) : googleClaim ? (
          <GoogleUsernameClaimForm
            suggestion={googleClaim}
            loading={claimLoading}
            error={claimError}
            onSubmit={handleClaimSubmit}
            onCancel={() => { setGoogleClaim(null); setPendingIdToken(null); setClaimError(''); }}
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <p style={{ fontSize: '0.88rem', color: '#a1a1aa', margin: 0 }}>
              Sign in with Google to create your account — your active chat, messages and friends stay exactly as they are.
            </p>

            <button
              type="button"
              id="upgrade-modal-submit-btn"
              onClick={handleGoogleLink}
              disabled={loading || !firebaseConfigured}
              title={firebaseConfigured
                ? 'Link your Google account to this guest profile'
                : 'Google sign-in is not configured on this server yet'}
              style={{
                padding: '14px',
                borderRadius: '12px',
                border: 'none',
                background: (loading || !firebaseConfigured) ? 'rgba(255, 255, 255, 0.15)' : '#ffffff',
                color: (loading || !firebaseConfigured) ? '#71717a' : '#1f2937',
                fontWeight: 700,
                fontSize: '1rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                cursor: (loading || !firebaseConfigured) ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {loading ? (
                <span className="spinner-border spinner-border-sm me-2" />
              ) : (
                <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                </svg>
              )}
              <span>
                {!firebaseConfigured ? 'Google sign-in not configured' : (loading ? 'Signing in with Google…' : 'Sign in with Google')}
              </span>
            </button>

            {!firebaseConfigured && (
              <p style={{ fontSize: '0.78rem', color: '#fbbf24', margin: 0 }}>
                Google sign-in is not configured on this server yet. Your guest account still
                works; ask the admin to set the Firebase configuration to enable upgrades.
              </p>
            )}

            <p style={{ fontSize: '0.75rem', color: '#52525b', margin: 0, textAlign: 'center' }}>
              Mid-chat upgrade keeps the conversation alive — nothing is lost.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
