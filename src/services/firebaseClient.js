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
import { getAuth, GoogleAuthProvider, signInWithPopup, signInAnonymously, signOut } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

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
    if (auth.currentUser) return auth.currentUser;
    const cred = await signInAnonymously(auth);
    return cred.user;
  } catch (e) {
    // Guest chat cannot depend on Firebase: log and move on.
    console.warn('[firebaseClient] Anonymous Firebase session unavailable:', e?.message || e);
    return null;
  }
}

/** Google popup sign-in. Returns the Firebase User on success. */
export async function signInWithGooglePopup() {
  const auth = getFirebaseAuth();
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const cred = await signInWithPopup(auth, provider);
  return cred.user;
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
