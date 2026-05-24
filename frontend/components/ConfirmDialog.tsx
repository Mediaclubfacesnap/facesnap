'use client';

import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'default';
}

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default'
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) {
      // Focus the cancel button when dialog opens
      setTimeout(() => cancelRef.current?.focus(), 50);

      const handleEsc = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
      };
      document.addEventListener('keydown', handleEsc);
      document.body.style.overflow = 'hidden';

      return () => {
        document.removeEventListener('keydown', handleEsc);
        document.body.style.overflow = '';
      };
    }
  }, [isOpen, onClose]);

  const variantStyles = {
    danger: {
      bg: 'bg-rose-500',
      hover: 'hover:bg-rose-400',
      icon: 'text-rose-400',
      border: 'border-rose-500/20',
    },
    warning: {
      bg: 'bg-amber-500',
      hover: 'hover:bg-amber-400',
      icon: 'text-amber-400',
      border: 'border-amber-500/20',
    },
    default: {
      bg: 'bg-primary',
      hover: 'hover:bg-cyan-400',
      icon: 'text-primary',
      border: 'border-primary/20',
    },
  };
  const styles = variantStyles[variant];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Dialog */}
          <motion.div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
            aria-describedby="confirm-dialog-desc"
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className={`relative glass-panel rounded-xl p-6 max-w-md w-full ${styles.border} border`}
          >
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-300 transition-colors"
              aria-label="Close dialog"
              type="button"
            >
              <X size={18} />
            </button>

            {/* Content */}
            <div className="flex items-start gap-4">
              <div className={`p-2.5 rounded-lg bg-white/[0.04] ${styles.icon} flex-shrink-0`}>
                <AlertTriangle size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <h3
                  id="confirm-dialog-title"
                  className="text-base font-semibold text-gray-50 mb-1"
                >
                  {title}
                </h3>
                <p
                  id="confirm-dialog-desc"
                  className="text-sm text-gray-400 leading-relaxed"
                >
                  {description}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 mt-6">
              <button
                ref={cancelRef}
                onClick={onClose}
                type="button"
                className="px-4 py-2.5 text-sm font-medium text-gray-300 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] rounded-lg transition-colors"
              >
                {cancelLabel}
              </button>
              <button
                onClick={() => {
                  onConfirm();
                  onClose();
                }}
                type="button"
                className={`px-4 py-2.5 text-sm font-semibold text-white ${styles.bg} ${styles.hover} rounded-lg transition-colors`}
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
