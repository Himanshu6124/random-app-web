import React, { useEffect, useRef } from 'react';
import '../../styles/discover.css';

/** Small confirm dialog for destructive actions (clear history, block, report, unfriend). */
export function DiscoverConfirmDialog({ open, title, body, confirmLabel, danger = false, busy = false, error = '', onConfirm, onCancel }) {
  const cancelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    cancelRef.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="dc-dialog-backdrop" onClick={onCancel}>
      <div
        className="dc-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="dc-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="dc-dialog-title">{title}</h2>
        <p>{body}</p>
        {error && <p role="alert" style={{ color: 'var(--dc-rose)' }}>{error}</p>}
        <div className="dc-dialog-actions">
          <button ref={cancelRef} type="button" className="dc-btn dc-btn--ghost dc-btn--sm" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className={`dc-btn dc-btn--sm ${danger ? 'dc-btn--danger' : 'dc-btn--primary'}`}
            onClick={onConfirm}
            disabled={busy}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
