import { useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'warning';
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'danger',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 dark:bg-black/75 backdrop-blur-xs p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-desc"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="bg-white dark:bg-[#111316] border border-slate-200 dark:border-zinc-800 rounded-2xl w-full max-w-md shadow-xl overflow-hidden">
        <div className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div
                className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                  tone === 'danger'
                    ? 'bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400'
                    : 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400'
                }`}
              >
                <AlertTriangle className="w-5 h-5" aria-hidden="true" />
              </div>
              <div>
                <h3
                  id="confirm-dialog-title"
                  className="text-base font-semibold text-slate-900 dark:text-zinc-100"
                >
                  {title}
                </h3>
                <p
                  id="confirm-dialog-desc"
                  className="text-sm text-slate-600 dark:text-zinc-400 mt-1.5 leading-relaxed"
                >
                  {description}
                </p>
              </div>
            </div>
            <button
              onClick={onCancel}
              className="p-1.5 text-slate-400 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-200 rounded-md"
              aria-label="Close confirmation dialog"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="px-6 py-3.5 bg-slate-50 dark:bg-zinc-900/80 border-t border-slate-200 dark:border-zinc-800 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-700 rounded-lg transition-colors whitespace-nowrap"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onCancel();
            }}
            className={`px-4 py-2 text-xs font-medium text-white rounded-lg transition-colors whitespace-nowrap ${
              tone === 'danger'
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-amber-600 hover:bg-amber-700'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
