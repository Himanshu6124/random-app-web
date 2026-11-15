/**
 * Shared lazy Firebase client (CONTRACT B1-1). Auth (Stage B1) and Storage (Stage B2)
 * both import from here.
 *
 * Rules of this module:
 * - NEVER initialize at module top level: an unconfigured app must still load, render the
 *   login screen and let guests chat. Everything degrades behind isFirebaseConfigured().
 * - All VITE_FIREBASE_* values are public web-config values, safe for the client bundle.
 * - Never hard-code real values; they come from .env (see .env.example).
 */
import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult,
  signInAnonymously, signOut
} from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import { isIOS } from '../mobile/nativeShell';

const cfg = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

/** True when every required VITE_FIREBASE_* variable is present. */
export function isFirebaseConfigured() {
  return Boolean(cfg.apiKey && cfg.authDomain && cfg.projectId && cfg.storageBucket && cfg.appId);
}

const NOT_CONFIGURED_MESSAGE =
  'Google sign-in and media uploads are not configured yet (missing VITE_FIREBASE_* env values). '
  + 'Please continue as a guest for now.';

function getFirebaseApp() {
  if (!isFirebaseConfigured()) {
    throw new Error(NOT_CONFIGURED_MESSAGE);
  }
  if (!getApps().length) {
    initializeApp(cfg);
  }
  return getApps()[0];
}

/** Initializes lazily; throws a clear Error if unconfigured. */
export function getFirebaseAuth() {
  return getAuth(getFirebaseApp());
}

/** Initializes lazily; throws a clear Error if unconfigured. */
export function getFirebaseStorage() {
  return getStorage(getFirebaseApp());
}

/** Current Firebase user (anonymous, Google, …) or null. */
export function getCurrentFirebaseUser() {
  if (!isFirebaseConfigured() || !getApps().length) return null;
  try {
    return getAuth(getApps()[0]).currentUser;
  } catch {
    return null;
  }
}

/**
 * Signs in anonymously if nobody is signed in; no-op when unconfigured or when a user
 * already exists (so a Google-linked session is never downgraded). Guests need this so
 * Storage rules let them upload chat media.
 */
export async function ensureAnonymousFirebaseSession() {
  if (!isFirebaseConfigured()) return null;
  try {
    const auth = getFirebaseAuth();
    // currentUser is null until persisted state loads; without this wait a guest could be
    // signed in anonymously over a Google user who just came back from a redirect.
    await auth.authStateReady();
    if (auth.currentUser) return auth.currentUser;
    const cred = await signInAnonymously(auth);
    return cred.user;
  } catch (e) {
    // Guest chat cannot depend on Firebase: log and move on.
    console.warn('[firebaseClient] Anonymous Firebase session unavailable:', e?.message || e);
    return null;
  }
}

const REDIRECT_KEY = 'randomeet_google_redirect';
const REDIRECT_MAX_AGE_MS = 15 * 60 * 1000;
const POPUP_TIMEOUT_MS = 3 * 60 * 1000;

/**
 * True inside a web app installed to the iOS home screen. There the Google popup opens in a
 * separate browser view that shares no storage with the app, so its result never comes back
 * and signInWithPopup waits forever. Those users get the redirect flow instead.
 */
export function isInstalledIosApp() {
  if (typeof window === 'undefined' || !isIOS) return false;
  return window.navigator.standalone === true
    || Boolean(window.matchMedia?.('(display-mode: standalone)').matches);
}

function googleProvider() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return provider;
}

/**
 * Starts Google sign-in. Returns the Firebase User (popup flow), or null when a redirect
 * was started instead: the page then navigates to Google and the caller must just wait.
 * After the redirect returns, consumeGoogleRedirect() hands back the user together with
 * `purpose` and `context` (plain JSON) so the caller can resume where it left off.
 */
export async function startGoogleSignIn({ purpose = 'login', context = null } = {}) {
  const auth = getFirebaseAuth();
  if (isInstalledIosApp()) {
    try {
      localStorage.setItem(REDIRECT_KEY, JSON.stringify({ purpose, context, at: Date.now() }));
    } catch {
      /* storage blocked: the redirect result is still consumed, just without context */
    }
    await signInWithRedirect(auth, googleProvider());
    return null;
  }

  // A popup that never reports back (blocked or orphaned) must not spin forever.
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(
      'Google sign-in did not finish. Please try again.'
    )), POPUP_TIMEOUT_MS);
  });
  try {
    const cred = await Promise.race([signInWithPopup(auth, googleProvider()), timeout]);
    return cred.user;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Finishes a Google redirect started by startGoogleSignIn. Returns null when no redirect is
 * pending, otherwise { purpose, context, user } where user is null if the person backed out.
 * Throws the Firebase error when the sign-in itself failed.
 */
export async function consumeGoogleRedirect() {
  let pending = null;
  try {
    pending = JSON.parse(localStorage.getItem(REDIRECT_KEY) || 'null');
    localStorage.removeItem(REDIRECT_KEY);
  } catch {
    pending = null;
  }
  if (!pending || !isFirebaseConfigured()) return null;
  if (Date.now() - (pending.at || 0) > REDIRECT_MAX_AGE_MS) return null;

  const cred = await getRedirectResult(getFirebaseAuth());
  return { purpose: pending.purpose, context: pending.context, user: cred?.user || null };
}

/** Signs the Firebase user out (does not touch the app's own JWT session). */
export async function signOutFirebase() {
  if (!isFirebaseConfigured() || !getApps().length) return;
  try {
    await signOut(getFirebaseAuth());
  } catch {
    // best effort
  }
}
