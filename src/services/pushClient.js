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
    if (!token) return null;
    await authService.updateFcmToken(token, jwt);
    return token;
  } catch (e) {
    console.warn('[push] Could not enable browser push:', e?.message || e);
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
