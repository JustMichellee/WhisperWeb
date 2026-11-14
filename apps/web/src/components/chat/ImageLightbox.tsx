import { useEffect, type FC } from 'react';
import { Download, X } from 'lucide-react';

interface ImageLightboxProps {
  src: string | null;
  fileName: string;
  onClose: () => void;
}

export const ImageLightbox: FC<ImageLightboxProps> = ({ src, fileName, onClose }) => {
  useEffect(() => {
    if (!src) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [src, onClose]);

  if (!src) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Pratinjau gambar ${fileName}`}
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/90 flex flex-col"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex items-center justify-between px-4 py-3 text-white bg-black/40"
      >
        <p className="text-sm font-medium truncate max-w-[70%]">{fileName}</p>
        <div className="flex items-center gap-2">
          <a
            href={src}
            download={fileName}
            aria-label={`Unduh ${fileName}`}
            className="p-2.5 rounded-lg hover:bg-white/15 inline-flex items-center gap-1.5 text-sm"
          >
            <Download className="w-5 h-5" aria-hidden="true" />
            <span>Unduh</span>
          </a>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup pratinjau gambar"
            className="p-2.5 rounded-lg hover:bg-white/15"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
        <img
          src={src}
          alt={fileName}
          onClick={(e) => e.stopPropagation()}
          className="max-w-full max-h-full object-contain rounded-lg"
        />
      </div>
    </div>
  );
};

