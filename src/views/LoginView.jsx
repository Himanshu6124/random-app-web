import React, { useEffect, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { GuestEntryModal } from '../components/GuestEntryModal';
import { GoogleUsernameClaimForm } from '../components/GoogleUsernameClaimForm';
import { HERO, STEPS, SAFETY, FAQ } from '../content/landingContent';
import { SEO_PAGES } from '../content/seoPages';
import './LoginView.css';

const GOOGLE_SVG = (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
  </svg>
);

function GoogleButton({ onClick, disabled, loading, configured }) {
  return (
    <div>
      <button
        type="button"
        id="google-signin-btn"
        onClick={onClick}
        disabled={disabled}
        title={configured
          ? 'Sign in with your Google account'
          : 'Google sign-in is not configured yet — use Continue as Guest'}
        style={{
          width: '100%',
          minHeight: '52px',
          padding: '13px 18px',
          borderRadius: 'var(--radius-full)',
          background: configured ? 'var(--google-surface)' : 'transparent',
          border: configured ? '1px solid var(--google-line)' : '1px solid var(--border-strong)',
          color: configured ? 'var(--google-text)' : 'var(--text-secondary)',
          fontFamily: 'var(--font-main)',
          fontWeight: 600,
          fontSize: 'var(--fs-base)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '10px',
          cursor: disabled ? 'not-allowed' : 'pointer',
          transition: 'background-color 0.18s'
        }}
      >
        {loading ? <span className="btn-spinner"></span> : GOOGLE_SVG}
        <span>Sign in with Google</span>
      </button>
      {!configured && (
        <p id="google-not-configured-note" style={{
          fontSize: 'var(--fs-sm)', color: 'var(--accent)', marginTop: '8px', marginBottom: 0
        }}>
          Google sign-in &amp; media are not configured yet — Continue as Guest works fully.
        </p>
      )}
    </div>
  );
}

function GuestButton({ onClick }) {
  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '12px',
        margin: '20px 0', color: 'var(--text-muted)', fontSize: 'var(--fs-sm)'
      }}>
        <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }} />
        <span>or</span>
        <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }} />
      </div>
      <button
        type="button"
        id="continue-as-guest-btn"
        onClick={onClick}
        className="btn-primary"
        style={{ width: '100%', minHeight: '52px', fontSize: 'var(--fs-base)' }}
      >
        Continue as Guest
      </button>
      <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', marginTop: '8px', marginBottom: 0 }}>
        Enter with just your name &amp; gender • Instant matching
      </p>
      <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', marginTop: '16px', marginBottom: 0 }}>
        You can link a Google account mid-chat later without losing anything.
      </p>
    </div>
  );
}

export function LoginView() {
  const {
    loginAsGuest, authError, clearAuthError,
    signInWithGoogle, completeGoogleSignup, firebaseConfigured,
    googleRedirectLogin, clearGoogleRedirectLogin
  } = useAuth();

  const [loading, setLoading] = useState(false);
  const [guestModalOpen, setGuestModalOpen] = useState(false);
  const [localError, setLocalError] = useState('');

  // Username-claim step for brand-new Google users (CONTRACT 3)
  const [googleClaim, setGoogleClaim] = useState(null); // { registrationToken, suggestedUsername, name, email, photoUrl }
  const [claimLoading, setClaimLoading] = useState(false);
  const [claimError, setClaimError] = useState('');

  const clearErrors = () => {
    setLocalError('');
    clearAuthError();
  };

  // Back from a Google redirect (installed iOS app): continue with the claim step or show why it failed.
  useEffect(() => {
    if (!googleRedirectLogin) return;
    if (googleRedirectLogin.claim) setGoogleClaim(googleRedirectLogin.claim);
    if (googleRedirectLogin.error) setLocalError(googleRedirectLogin.error);
    clearGoogleRedirectLogin();
  }, [googleRedirectLogin, clearGoogleRedirectLogin]);

  // ---- Google sign-in (CONTRACT: login screen has exactly two actions) ----
  const handleGoogleSignIn = async () => {
    clearErrors();
    setLoading(true);
    let redirecting = false;
    try {
      const res = await signInWithGoogle();
      if (res && res.status === 'REDIRECTING') {
        // Installed iOS app: the page is leaving for Google, keep the spinner until it does.
        redirecting = true;
      } else if (res && res.status === 'NEEDS_USERNAME') {
        // Brand-new Google user: show the username-claim step before creating the account.
        setGoogleClaim(res);
      }
      // Otherwise the session was applied inside AuthContext and the app navigates away.
    } catch (err) {
      setLocalError(err.message || 'Google sign-in failed. Please try again.');
    } finally {
      if (!redirecting) setLoading(false);
    }
  };

  const handleClaimSubmit = async ({ username, name, gender, photoUrl }) => {
    setClaimError('');
    setClaimLoading(true);
    try {
      await completeGoogleSignup({
        registrationToken: googleClaim.registrationToken,
        username,
        name,
        gender,
        photoUrl
      });
      setGoogleClaim(null);
    } catch (err) {
      setClaimError(err.message || 'Could not create the account. Please try again.');
    } finally {
      setClaimLoading(false);
    }
  };

  return (
    <div className="login-page-container">
      <div className="login-card animate-fade-in">
        <div className="login-header">
          <div className="login-brand">RandomChatly</div>
          <h1 className="login-title">{HERO.title}</h1>
          <p className="login-subtitle">{HERO.lead}</p>
        </div>

        {localError && (
          <div id="login-error-alert" className="auth-error-alert">
            <AlertTriangle size={16} aria-hidden="true" /><span>{localError}</span>
            <button type="button" className="auth-error-dismiss" onClick={clearErrors} aria-label="Dismiss"><X size={16} aria-hidden="true" /></button>
          </div>
        )}

        {googleClaim ? (
          <GoogleUsernameClaimForm
            suggestion={googleClaim}
            loading={claimLoading}
            error={claimError}
            onSubmit={handleClaimSubmit}
            onCancel={() => { setGoogleClaim(null); setClaimError(''); }}
          />
        ) : (
          <>
            <GoogleButton
              onClick={handleGoogleSignIn}
              disabled={loading || !firebaseConfigured}
              loading={loading}
              configured={firebaseConfigured}
            />
            <GuestButton onClick={() => { clearErrors(); setGuestModalOpen(true); }} />
          </>
        )}

      </div>

      <section className="login-about" aria-labelledby="landing-steps-title">
        <h2 id="landing-steps-title" className="login-about-title">{STEPS.title}</h2>
        <ol className="landing-steps">
          {STEPS.items.map((step, i) => (
            <li key={step.title}>
              <span className="landing-step-num" aria-hidden="true">{i + 1}</span>
              <div>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="login-about" aria-labelledby="landing-safety-title">
        <h2 id="landing-safety-title" className="login-about-title">{SAFETY.title}</h2>
        <ul className="login-about-list">
          {SAFETY.items.map((item) => (
            <li key={item.title}>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="login-about" aria-labelledby="landing-faq-title">
        <h2 id="landing-faq-title" className="login-about-title">{FAQ.title}</h2>
        <div className="landing-faq">
          {FAQ.items.map((item) => (
            <details key={item.question}>
              <summary><h3>{item.question}</h3></summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </div>
        <a className="landing-more-link" href="/faq/">See all questions</a>
      </section>

      <footer className="landing-footer">
        <nav aria-label="More about RandomChatly">
          <ul>
            {SEO_PAGES.map((page) => (
              <li key={page.slug}><a href={`/${page.slug}/`}>{page.navLabel}</a></li>
            ))}
          </ul>
        </nav>
      </footer>

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
