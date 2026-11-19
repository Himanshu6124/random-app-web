/**
 * Browser push (Firebase Cloud Messaging). Registers this browser so the server can reach the account
 * when the app is closed or has no live socket connection.
 *
 * Permission is never requested here: browsers only show the prompt after a tap (see
 * NotificationPermissionPrompt). This module only acts once permission is already granted.
 */
import { authService } from './authService';
import { getFirebaseApp, isFirebaseConfigured } from './firebaseClient';
import { getVapidKey } from './pushConfig';
import { notificationsOff } from './notify';

let lastPushError = '';

/** Why the last registration attempt failed ('' if it worked or never ran). Shown in Profile. */
export function getLastPushError() {
  return lastPushError;
}

/** Which requirement for push is missing on this browser ('' when all are met). */
export function pushUnsupportedReason() {
  if (typeof window === 'undefined') return 'no window';
  if (!window.isSecureContext) return 'page is not served over HTTPS';
  if (!('serviceWorker' in navigator)) return 'no service worker support';
  if (!('PushManager' in window)) return 'no Push API in this browser';
  if (!('Notification' in window)) return 'no Notification API';
  if (!isFirebaseConfigured()) return 'Firebase web config missing in this build';
  if (!getVapidKey()) return 'VAPID key missing in this build';
  return '';
}

export function pushSupported() {
  return typeof window !== 'undefined'
    && window.isSecureContext
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window
    && isFirebaseConfigured()
    && Boolean(getVapidKey());
}

/**
 * Gets this browser's push token and stores it on the signed-in account. Safe to call on every
 * app start: the server keeps one token per account and moves it off any other account that held it.
 */
export async function enablePushNotifications(jwt) {
  if (!jwt || !pushSupported() || Notification.permission !== 'granted' || notificationsOff()) return null;
  try {
    const { getMessaging, getToken } = await import('firebase/messaging');
    const registration = await navigator.serviceWorker.ready;
    const messaging = getMessaging(getFirebaseApp());
    const token = await getToken(messaging, {
      vapidKey: getVapidKey(),
      serviceWorkerRegistration: registration
    });
    if (!token) {
      lastPushError = 'No push token returned';
      return null;
    }
    await authService.updateFcmToken(token, jwt);
    lastPushError = '';
    return token;
  } catch (e) {
    lastPushError = [e?.code, e?.message || String(e)].filter(Boolean).join(': ');
    console.warn('[push] Could not enable browser push:', lastPushError);
    return null;
  }
}

/**
 * Called on logout: removes the token from the account and from this browser, so the next person on
 * this device does not receive the previous account's notifications.
 */
export async function disablePushNotifications(jwt) {
  if (!isFirebaseConfigured()) return;
  if (jwt) {
    try {
      await authService.deleteFcmToken(jwt);
    } catch {
      /* best effort: the token is also cleared on the server when the account is deleted */
    }
  }
  try {
    const { getMessaging, deleteToken } = await import('firebase/messaging');
    await deleteToken(getMessaging(getFirebaseApp()));
  } catch {
    /* nothing registered on this browser */
  }
}
