import { useCallback, useEffect, useState, type ChangeEvent } from 'react';
import { validateAvatarFile } from '../utils/imageResize';

interface CropSource {
  src: string;
  isObjectUrl: boolean;
}

/**
 * Manages temporary object URLs and lifecycle for interactive avatar cropping.
 */
export function useAvatarCropper(options: {
  onApply: (dataUrl: string) => void;
  onError: (message: string) => void;
}) {
  const [source, setSource] = useState<CropSource | null>(null);

  const revokeIfNeeded = useCallback((target: CropSource | null) => {
    if (target?.isObjectUrl) {
      URL.revokeObjectURL(target.src);
    }
  }, []);

  useEffect(() => {
    return () => {
      revokeIfNeeded(source);
    };
  }, [source, revokeIfNeeded]);

  const pickFileForCrop = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;

      try {
        validateAvatarFile(file);
        const objectUrl = URL.createObjectURL(file);
        setSource({ src: objectUrl, isObjectUrl: true });
      } catch (err) {
        options.onError(err instanceof Error ? err.message : 'Gagal memuat gambar.');
      }
    },
    [options]
  );

  const openExistingForCrop = useCallback((existingDataUrl: string) => {
    setSource({ src: existingDataUrl, isObjectUrl: false });
  }, []);

  const closeCrop = useCallback(() => {
    setSource(null);
  }, []);

  const confirmCrop = useCallback(
    (dataUrl: string) => {
      options.onApply(dataUrl);
      setSource(null);
    },
    [options]
  );

  return {
    cropImageSrc: source?.src ?? null,
    pickFileForCrop,
    openExistingForCrop,
    closeCrop,
    confirmCrop,
  };
}

