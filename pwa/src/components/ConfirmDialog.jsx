import { useEffect, useRef } from 'react';

// Bottom sheet confirmation, slides up from bottom.
// Replaces the centered modal with a full-width sheet styled per DESIGN.md tokens.
// STOP does not require confirmation — only OPEN and CLOSE.
export default function ConfirmDialog({ open, title, message, confirmLabel, tone, onConfirm, onCancel }) {
  const cancelRef = useRef(null);

  useEffect(() => {
    if (open) cancelRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    function onKey(e) {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter')  onConfirm();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel, onConfirm]);

  if (!open) return null;

  return (
    <div className="sheet-backdrop" onClick={onCancel} role="presentation">
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="sheet-stripe" aria-hidden="true">
          <span /><span /><span />
        </span>
        <div className="sheet-body">
          <h2 id="confirm-title" className="sheet-title">{title}</h2>
          <p className="sheet-message">{message}</p>
        </div>
        <div className="sheet-actions">
          <button ref={cancelRef} type="button" className="sheet-btn sheet-btn--ghost" onClick={onCancel}>
            Huỷ
          </button>
          <button type="button" className={`sheet-btn sheet-btn--solid tone-${tone}`} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
