import React, { useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';
import { Portal } from '../Portal';
import { CHAT_THEMES, THEME_GROUPS } from './chatThemes';
import { feedback } from '../../mobile/feedback';

/**
 * The theme's living wallpaper: a slowly drifting aurora of colour, a fine pattern and film grain.
 * Sits behind everything on the chat screen (z-index -1 inside its isolated stacking context).
 * The classic look has none.
 */
export function ChatBackdrop({ theme, mini = false }) {
  if (!theme || theme.id === 'default') return null;
  return (
    <span
      className={`ct-backdrop${mini ? ' ct-backdrop--mini' : ''}${theme.still ? ' is-still' : ''}`}
      aria-hidden="true"
    >
      <span className="ct-backdrop__aurora" />
      <span className="ct-backdrop__pattern" />
    </span>
  );
}

function ThemeCard({ theme, selected, onPick }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      className={`ct-swatch${selected ? ' is-selected' : ''}`}
      onClick={() => onPick(theme.id)}
      style={theme.vars}
    >
      <span className="ct-swatch__preview" style={{ '--ct-attach': 'scroll' }}>
        <ChatBackdrop theme={theme} mini />
        <span className="ct-swatch__bubble ct-swatch__bubble--them" />
        <span className="ct-swatch__bubble ct-swatch__bubble--them ct-swatch__bubble--short" />
        <span className="ct-swatch__bubble ct-swatch__bubble--me" />
        <span className="ct-swatch__bubble ct-swatch__bubble--me ct-swatch__bubble--short" />
        {selected && (
          <span className="ct-swatch__check" aria-hidden="true"><Check size={13} strokeWidth={3} /></span>
        )}
      </span>
      <span className="ct-swatch__name">{theme.name}</span>
    </button>
  );
}

/** Bottom sheet (centred dialog on desktop) for choosing a chat theme. */
export function ChatThemePicker({ open, currentId, onSelect, onClose, peerName }) {
  const [error, setError] = useState('');
  useEffect(() => { if (open) setError(''); }, [open]);

  const pick = (id) => {
    if (id === currentId) return;
    feedback('select');
    if (onSelect(id) === false) {
      feedback('error');
      setError("Couldn't change the theme. Check your connection and try again.");
      return;
    }
    setError('');
  };

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const classic = CHAT_THEMES.find(t => t.id === 'default');

  return (
    <Portal>
      <div className="ct-picker-scrim" onClick={onClose}>
        <div
          className="ct-picker"
          role="dialog"
          aria-modal="true"
          aria-label="Chat theme"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="ct-picker__grab" aria-hidden="true" />
          <div className="ct-picker__head">
            <div>
              <h3>Themes</h3>
              <p className="ct-picker__sub">
                {peerName ? `You and ${peerName} both see it` : 'Both of you see it'}
              </p>
            </div>
            <button type="button" className="ct-picker__close" onClick={onClose} aria-label="Close">
              <X size={18} aria-hidden="true" />
            </button>
          </div>
          <div role="radiogroup" aria-label="Themes">
            {THEME_GROUPS.map(group => (
              <section key={group} className="ct-picker__group">
                <h4>{group}</h4>
                <div className="ct-picker__grid">
                  {(group === THEME_GROUPS[THEME_GROUPS.length - 1] ? [...CHAT_THEMES.filter(t => t.group === group), classic] : CHAT_THEMES.filter(t => t.group === group))
                    .map(theme => (
                      <ThemeCard key={theme.id} theme={theme} selected={theme.id === currentId} onPick={pick} />
                    ))}
                </div>
              </section>
            ))}
          </div>
          {error && <p className="ct-picker__error" role="alert">{error}</p>}
        </div>
      </div>
    </Portal>
  );
}
