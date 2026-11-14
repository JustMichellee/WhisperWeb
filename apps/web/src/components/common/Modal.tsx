import { useEffect, useRef, type FC, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { useT } from '../../stores/useI18nStore';

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  closeLabel?: string;
  disableClose?: boolean;
  maxWidthClass?: string;
  children: ReactNode;
}

export const Modal: FC<ModalProps> = ({
  open,
  title,
  onClose,
  closeLabel,
  disableClose = false,
  maxWidthClass = 'max-w-md',
  children,
}) => {
  const { t } = useT();
  const resolvedCloseLabel = closeLabel ?? t('common.close');
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const prevFocused = document.activeElement as HTMLElement | null;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !disableClose) {
        const dialogs = document.querySelectorAll('[role="dialog"]');
        if (dialogs.length > 0 && dialogs[dialogs.length - 1] !== panelRef.current) {
          return;
        }
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    panelRef.current?.focus();

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      prevFocused?.focus();
    };
  }, [open, disableClose, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65"
      onClick={() => {
        if (!disableClose) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className={`w-full ${maxWidthClass} rounded-2xl bg-[var(--bg-sidebar)] text-[var(--text-primary)] border border-[var(--border-subtle)] shadow-2xl overflow-hidden`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-subtle)]">
          <h2 id="modal-title" className="text-base font-semibold">
            {title}
          </h2>
          {!disableClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label={resolvedCloseLabel}
              className="p-2 rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          )}
        </div>
        <div className="p-5 max-h-[82dvh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
};
