import { useEffect } from 'react';
import { X } from 'lucide-react';

interface PhotoLightboxProps {
  url: string;
  name: string;
  onClose: () => void;
}

export function PhotoLightbox({ url, name, onClose }: PhotoLightboxProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/80"
      onClick={onClose}
    >
      <div
        className="relative max-h-[90vh] max-w-[90vw]"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={url}
          alt={name}
          className="max-h-[85vh] max-w-[85vw] rounded object-contain shadow-xl"
        />
        <div className="mt-2 text-center text-sm text-white/80">{name}</div>
        <button
          type="button"
          onClick={onClose}
          className="absolute -right-3 -top-3 rounded-full bg-white p-1 shadow"
          aria-label="Fermer"
        >
          <X size={16} className="text-slate-700" />
        </button>
      </div>
    </div>
  );
}
