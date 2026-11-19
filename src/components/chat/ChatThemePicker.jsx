import React, { useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';
import { Portal } from '../Portal';
import { CHAT_THEMES } from './chatThemes';
import { feedback } from '../../mobile/feedback';

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
            <h3>Chat theme</h3>
            <button type="button" className="ct-picker__close" onClick={onClose} aria-label="Close">
              <X size={18} aria-hidden="true" />
            </button>
          </div>
          <div className="ct-picker__grid" role="radiogroup" aria-label="Themes">
            {CHAT_THEMES.map(theme => {
              const selected = theme.id === currentId;
              return (
                <button
                  key={theme.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  className={`ct-swatch${selected ? ' is-selected' : ''}`}
                  onClick={() => pick(theme.id)}
                >
                  <span className="ct-swatch__preview" style={{ ...theme.vars, '--ct-attach': 'scroll' }}>
                    <span className="ct-swatch__icon" aria-hidden="true">{theme.icon}</span>
                    <span className="ct-swatch__bubble ct-swatch__bubble--them" />
                    <span className="ct-swatch__bubble ct-swatch__bubble--me" />
                    <span className="ct-swatch__bubble ct-swatch__bubble--me ct-swatch__bubble--short" />
                    {selected && (
                      <span className="ct-swatch__check" aria-hidden="true"><Check size={14} strokeWidth={3} /></span>
                    )}
                  </span>
                  <span className="ct-swatch__name">
                    <span aria-hidden="true">{theme.icon}</span> {theme.name}
                  </span>
                </button>
              );
            })}
          </div>
          {error && <p className="ct-picker__error" role="alert">{error}</p>}
          <p className="ct-picker__note">
            {peerName ? `You and ${peerName} both see the theme you pick.` : 'Both of you see the theme you pick.'}
          </p>
        </div>
      </div>
    </Portal>
  );
}
