import { dismissToast, useToasts } from '../utils/uiFeedback';

const ICONS = {
  success: '✓',
  error: '!',
  info: 'i',
} as const;

export default function ToastContainer() {
  const toasts = useToasts();
  if (toasts.length === 0) return null;

  return (
    <div className="ui-toast-stack" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`ui-toast ui-toast-${t.type}`}>
          <span className="ui-toast-badge" aria-hidden="true">
            {ICONS[t.type]}
          </span>
          <span className="ui-toast-msg">{t.message}</span>
          <button
            type="button"
            className="ui-toast-close"
            onClick={() => dismissToast(t.id)}
            aria-label="Tutup notifikasi"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}