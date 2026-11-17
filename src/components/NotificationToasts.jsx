import React, { useEffect, useState } from 'react';
import { MessageCircle, UserPlus, UserCheck, Sparkles, X, Bell } from 'lucide-react';
import {
  subscribeToasts, dismissToast, navigateTo,
  notificationPermission, requestNotificationPermission, isPromptDismissed, dismissPrompt
} from '../services/notify';

const KIND_ICON = { message: MessageCircle, request: UserPlus, success: UserCheck, match: Sparkles };

/** Small, short-lived alerts at the top of the screen. They never block the chat. */
export function NotificationToasts() {
  const [toasts, setToasts] = useState([]);
  useEffect(() => subscribeToasts(setToasts), []);

  return (
    <div className="rc-toasts" aria-live="polite" aria-atomic="false">
      {toasts.map((t) => {
        const Icon = KIND_ICON[t.kind] || MessageCircle;
        return (
          <div key={t.id} className={`rc-toast rc-toast--${t.kind}`} role="status">
            <button
              type="button"
              className="rc-toast__main"
              onClick={() => { navigateTo(t.target); dismissToast(t.id); }}
            >
              <span className="rc-toast__avatar" aria-hidden="true">
                {t.icon ? <img src={t.icon} alt="" onError={(e) => { e.currentTarget.style.display = 'none'; }} /> : <Icon size={16} />}
              </span>
              <span className="rc-toast__text">
                <span className="rc-toast__title">{t.title}</span>
                {t.body && <span className="rc-toast__body">{t.body}</span>}
              </span>
            </button>
            {t.action && (
              <button
                type="button"
                className="rc-toast__action"
                onClick={() => { t.action.run(); dismissToast(t.id); }}
              >
                {t.action.label}
              </button>
            )}
            <button type="button" className="rc-toast__close" aria-label="Dismiss" onClick={() => dismissToast(t.id)}>
              <X size={14} />
            </button>
            <span className="rc-toast__timer" aria-hidden="true" />
          </div>
        );
      })}
    </div>
  );
}

/**
 * A one-time, dismissible strip asking to turn on browser notifications. Browsers only allow
 * the permission prompt from a tap, so it is never requested automatically.
 */
export function NotificationPermissionPrompt() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (notificationPermission() !== 'default' || isPromptDismissed()) return undefined;
    // Wait a little so it does not compete with the first screen.
    const timer = setTimeout(() => setVisible(true), 4000);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  const close = () => { dismissPrompt(); setVisible(false); };

  return (
    <div className="rc-notify-prompt" role="dialog" aria-label="Turn on notifications">
      <Bell size={16} aria-hidden="true" />
      <span className="rc-notify-prompt__text">Get alerts for new messages and friend requests?</span>
      <button
        type="button"
        className="rc-notify-prompt__yes"
        onClick={async () => { await requestNotificationPermission(); close(); }}
      >
        Turn on
      </button>
      <button type="button" className="rc-notify-prompt__no" onClick={close}>Not now</button>
    </div>
  );
}
