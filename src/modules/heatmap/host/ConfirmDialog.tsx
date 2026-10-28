/** Confirmation step for destructive host actions (native <dialog>, modal). */
import { useEffect, useRef } from "react";
import { HOST_UI } from "../content";

interface Props {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ open, title, body, confirmLabel, busy, onConfirm, onCancel }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="h-dialog"
      aria-labelledby="h-dialog-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onCancel();
      }}
    >
      <h2 id="h-dialog-title" className="h-dialog-title">
        {title}
      </h2>
      <p className="h-dialog-body">{body}</p>
      <div className="h-dialog-actions">
        <button type="button" className="btn btn-dark" disabled={busy} onClick={onConfirm}>
          {confirmLabel}
        </button>
        <button type="button" className="btn btn-secondary" disabled={busy} onClick={onCancel} autoFocus>
          {HOST_UI.cancel}
        </button>
      </div>
    </dialog>
  );
}
