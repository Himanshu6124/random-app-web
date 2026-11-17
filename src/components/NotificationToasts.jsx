import React, { useEffect, useRef, useState } from 'react';
import { MessageCircle, UserPlus, UserCheck, Sparkles, X, Bell } from 'lucide-react';
import {
  subscribeToasts, dismissToast, navigateTo,
  notificationPermission, requestNotificationPermission, isPromptDismissed, dismissPrompt
} from '../services/notify';

const KIND_ICON = { message: MessageCircle, request: UserPlus, success: UserCheck, match: Sparkles };

/**
 * One toast. Drag it left, right or up past a small threshold (or flick it) to dismiss; a tap
 * still opens what it is about. Pointer events cover mouse and touch alike.
 */
function SwipeableToast({ toast: t }) {
  const Icon = KIND_ICON[t.kind] || MessageCircle;
  const [drag, setDrag] = useState(null); // { x, y } while dragging
  const [leaving, setLeaving] = useState(null); // { x, y } fly-out target
  // Once dragged, the entrance animation must never run again: removing the drag class used to
  // restart it (it starts from opacity 0), which made the toast blink before flying out.
  const [touched, setTouched] = useState(false);
  const startRef = useRef(null);
  const movedRef = useRef(false);

  const onPointerDown = (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    if (e.target.closest('.rc-toast__close, .rc-toast__action')) return;
    startRef.current = { x: e.clientX, y: e.clientY, t: Date.now() };
    movedRef.current = false;
  };
  const onPointerMove = (e) => {
    const start = startRef.current;
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = Math.min(0, e.clientY - start.y); // only upwards
    if (!movedRef.current && Math.hypot(dx, dy) < 6) return;
    if (!movedRef.current) {
      movedRef.current = true;
      setTouched(true);
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* not capturable */ }
    }
    setDrag({ x: dx, y: dy });
  };
  const onPointerUp = (e) => {
    const start = startRef.current;
    startRef.current = null;
    if (!start || !movedRef.current || !drag) { setDrag(null); return; }
    const dt = Math.max(1, Date.now() - start.t);
    const fast = Math.abs(drag.x) / dt > 0.5 || Math.abs(drag.y) / dt > 0.5;
    const far = Math.abs(drag.x) > 80 || drag.y < -36;
    if (far || fast) {
      const horizontal = Math.abs(drag.x) >= Math.abs(drag.y);
      setLeaving(horizontal
        ? { x: Math.sign(drag.x || 1) * (window.innerWidth || 400), y: drag.y }
        : { x: drag.x, y: -200 });
      setTimeout(() => dismissToast(t.id), 220);
    }
    setDrag(null);
    e.preventDefault();
  };
  // A drag must not count as a tap on the toast.
  const onClickCapture = (e) => {
    if (movedRef.current) {
      e.stopPropagation();
      e.preventDefault();
      movedRef.current = false;
    }
  };

  const pos = leaving || drag;
  const style = pos ? {
    transform: `translate(${pos.x}px, ${pos.y}px)`,
    opacity: leaving ? 0 : Math.max(0.3, 1 - Math.max(Math.abs(pos.x) / 220, Math.abs(pos.y) / 90))
  } : undefined;

  return (
    <div
      className={`rc-toast rc-toast--${t.kind}${touched ? ' is-touched' : ''}${drag ? ' is-dragging' : ''}${leaving || (!drag && pos) ? ' is-settling' : ''}`}
      role="status"
      style={style}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => { startRef.current = null; setDrag(null); }}
      onClickCapture={onClickCapture}
    >
      <button
        type="button"
        className="rc-toast__main"
        onClick={() => { navigateTo(t.target); dismissToast(t.id); }}
      >
        <span className="rc-toast__avatar" aria-hidden="true">
          {t.icon ? <img src={t.icon} alt="" draggable={false} onError={(e) => { e.currentTarget.style.display = 'none'; }} /> : <Icon size={16} />}
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
}

/** Small, short-lived alerts at the top of the screen. They never block the chat. */
export function NotificationToasts() {
  const [toasts, setToasts] = useState([]);
  useEffect(() => subscribeToasts(setToasts), []);

  return (
    <div className="rc-toasts" aria-live="polite" aria-atomic="false">
      {toasts.map((t) => <SwipeableToast key={t.id} toast={t} />)}
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
