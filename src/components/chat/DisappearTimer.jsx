import React, { useEffect, useRef, useState } from 'react';
import { Timer, Check } from 'lucide-react';
import { DISAPPEAR_OPTIONS, disappearLabel } from '../../services/chatSettingsService';

/**
 * Disappearing-messages picker for a chat header (friend DMs and random chats share it).
 * `seconds`: 0 = off, -1 = once seen, otherwise the lifetime of new messages.
 */
export function DisappearTimer({ seconds, onChange, hint }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown, { passive: true });
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
    };
  }, [open]);

  const pick = (value) => {
    setOpen(false);
    if (value !== seconds) onChange?.(value);
  };

  return (
    <div ref={ref} className="dm-timer">
      <button
        type="button"
        className={`dm-timer__btn${seconds ? ' is-on' : ''}`}
        onClick={() => setOpen(v => !v)}
        aria-label={seconds ? `Disappearing messages: ${disappearLabel(seconds)}` : 'Disappearing messages: off'}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Disappearing messages"
      >
        <Timer size={18} aria-hidden="true" />
        {seconds !== 0 && (
          <span className="dm-timer__label">{DISAPPEAR_OPTIONS.find(o => o.seconds === seconds)?.short}</span>
        )}
      </button>
      {open && (
        <div className="dm-timer__menu" role="menu" aria-label="Disappearing messages">
          <div className="dm-timer__title">Disappearing messages</div>
          {DISAPPEAR_OPTIONS.map(o => (
            <button
              key={o.seconds}
              type="button"
              role="menuitemradio"
              aria-checked={seconds === o.seconds}
              className={`dm-timer__opt${seconds === o.seconds ? ' is-on' : ''}`}
              onClick={() => pick(o.seconds)}
            >
              {o.label}
              {seconds === o.seconds && <Check size={15} aria-hidden="true" />}
            </button>
          ))}
          {hint && <p className="dm-timer__hint">{hint}</p>}
        </div>
      )}
    </div>
  );
}
