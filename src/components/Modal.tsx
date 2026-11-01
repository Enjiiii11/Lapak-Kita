import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';

type ModalProps = {
  title: string;
  onClose: () => void;
  children: ReactNode;
  maxWidthClass?: string;
};

export default function Modal({ title, onClose, children, maxWidthClass = 'max-w-lg' }: ModalProps) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={title}>
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 animate-[fade-in_150ms_ease-out] bg-stone-900/50 backdrop-blur-sm"
      />
      <div
        className={`relative flex max-h-[90vh] w-full ${maxWidthClass} animate-[slide-up_200ms_ease-out] flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl`}
      >
        <div className="flex items-center justify-between border-b border-stone-100 px-6 py-4">
          <h2 className="text-lg font-bold text-stone-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-stone-500 transition hover:bg-stone-100 hover:text-stone-900"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>
  );
}
