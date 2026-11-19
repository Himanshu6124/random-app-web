import React, { useEffect, useState } from 'react';
import { Bell, BellOff } from 'lucide-react';
import {
  notificationPermission, requestNotificationPermission, notificationsOff, setNotificationsOff
} from '../services/notify';
import { enablePushNotifications, disablePushNotifications, pushSupported, getLastPushError, pushUnsupportedReason } from '../services/pushClient';
import { authService } from '../services/authService';
import { isIOS } from '../mobile/nativeShell';

function isStandalone() {
  return typeof window !== 'undefined'
    && (window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true);
}

/**
 * Profile card that turns message / friend-request alerts on or off for this browser.
 * "On" means permission granted, the user has not switched it off here, and (where supported) this
 * browser is registered for push so alerts also arrive while the app is closed.
 */
export function NotificationSettings() {
  const [permission, setPermission] = useState(notificationPermission);
  const [off, setOff] = useState(notificationsOff);
  const [busy, setBusy] = useState(false);
  // null = not checked yet, true = registered for push, false = only while the app is open
  const [pushOk, setPushOk] = useState(null);
  const [pushError, setPushError] = useState('');

  const on = permission === 'granted' && !off;

  // Re-check registration whenever alerts are on (also repairs a missing server token).
  useEffect(() => {
    if (!on) { setPushOk(null); return undefined; }
    if (!pushSupported()) { setPushOk(false); setPushError(pushUnsupportedReason()); return undefined; }
    let cancelled = false;
    enablePushNotifications(authService.getToken()).then((token) => {
      if (!cancelled) {
        setPushOk(Boolean(token));
        setPushError(token ? '' : getLastPushError());
      }
    });
    return () => { cancelled = true; };
  }, [on]);

  // Permission can change in browser settings while the app stays open.
  useEffect(() => {
    const sync = () => setPermission(notificationPermission());
    document.addEventListener('visibilitychange', sync);
    return () => document.removeEventListener('visibilitychange', sync);
  }, []);

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (on) {
        setNotificationsOff(true);
        setOff(true);
        await disablePushNotifications(authService.getToken());
      } else {
        setNotificationsOff(false);
        setOff(false);
        if (permission !== 'granted') setPermission(await requestNotificationPermission());
      }
    } finally {
      setBusy(false);
    }
  };

  let hint;
  let canToggle = true;
  if (permission === 'unsupported') {
    canToggle = false;
    hint = isIOS && !isStandalone()
      ? 'On iPhone, add RandomChatly to your Home Screen (Share → Add to Home Screen), open it from there, then turn this on.'
      : "This browser doesn't support notifications.";
  } else if (permission === 'denied') {
    canToggle = false;
    hint = 'Blocked in your browser. Allow notifications for this site in the browser’s site settings, then come back.';
  } else if (!on) {
    hint = 'Get alerts for new messages and friend requests.';
  } else if (pushOk === false) {
    hint = 'On while RandomChatly is open. Alerts when it is closed are not available in this browser.';
  } else {
    hint = 'On. You will get alerts even when RandomChatly is closed.';
  }

  return (
    <section className="profile-notify-settings" aria-labelledby="profile-notify-title">
      <div className="profile-notify-settings__text">
        <h3 id="profile-notify-title">
          {on ? <Bell size={16} aria-hidden="true" /> : <BellOff size={16} aria-hidden="true" />}
          <span>Notifications</span>
        </h3>
        <p>{hint}</p>
        {pushOk === false && pushError && (
          <p className="profile-notify-settings__error">{pushError}</p>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-labelledby="profile-notify-title"
        className={`rc-switch${on ? ' is-on' : ''}`}
        disabled={!canToggle || busy}
        onClick={toggle}
      >
        <span className="rc-switch__thumb" />
      </button>
    </section>
  );
}
