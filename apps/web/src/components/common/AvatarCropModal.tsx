import {
  useEffect,
  useRef,
  useState,
  type FC,
  type KeyboardEvent,
  type PointerEvent,
  type WheelEvent,
} from 'react';
import { Minus, Plus, RotateCcw, RotateCw } from 'lucide-react';
import {
  AVATAR_CROP_VIEW_SIZE,
  computeCropLayout,
  renderCroppedAvatarDataUrl,
} from '../../utils/imageResize';
import { useT } from '../../stores/useI18nStore';
import { Modal } from './Modal';

interface AvatarCropModalProps {
  imageSrc: string | null;
  title?: string;
  onCancel: () => void;
  onConfirm: (dataUrl: string) => void;
}

export const AvatarCropModal: FC<AvatarCropModalProps> = ({
  imageSrc,
  title,
  onCancel,
  onConfirm,
}) => {
  const { t } = useT();
  const resolvedTitle = title ?? t('cropModal.defaultTitle');
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [rotationDeg, setRotationDeg] = useState(0);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [loadError, setLoadError] = useState<string | null>(null);

  const imgRef = useRef<HTMLImageElement | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(
    null
  );

  useEffect(() => {
    setZoom(1);
    setRotationDeg(0);
    setOffset({ x: 0, y: 0 });
    setNaturalSize(null);
    setLoadError(null);
  }, [imageSrc]);

  const layout = naturalSize
    ? computeCropLayout({
        naturalWidth: naturalSize.w,
        naturalHeight: naturalSize.h,
        viewSize: AVATAR_CROP_VIEW_SIZE,
        zoom,
        rotationDeg,
        offsetX: offset.x,
        offsetY: offset.y,
      })
    : null;

  const updateZoom = (nextZoom: number) => {
    const clampedZoom = Math.max(1, Math.min(3, Number(nextZoom.toFixed(2))));
    setZoom(clampedZoom);
    if (naturalSize) {
      const next = computeCropLayout({
        naturalWidth: naturalSize.w,
        naturalHeight: naturalSize.h,
        viewSize: AVATAR_CROP_VIEW_SIZE,
        zoom: clampedZoom,
        rotationDeg,
        offsetX: offset.x,
        offsetY: offset.y,
      });
      setOffset({ x: next.clampedX, y: next.clampedY });
    }
  };

  const handleRotate = () => {
    const nextRot = (rotationDeg + 90) % 360;
    setRotationDeg(nextRot);
    if (naturalSize) {
      const next = computeCropLayout({
        naturalWidth: naturalSize.w,
        naturalHeight: naturalSize.h,
        viewSize: AVATAR_CROP_VIEW_SIZE,
        zoom,
        rotationDeg: nextRot,
        offsetX: offset.x,
        offsetY: offset.y,
      });
      setOffset({ x: next.clampedX, y: next.clampedY });
    }
  };

  const handleReset = () => {
    setZoom(1);
    setRotationDeg(0);
    setOffset({ x: 0, y: 0 });
  };

  const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!layout) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      originX: layout.clampedX,
      originY: layout.clampedY,
    };
  };

  const handlePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current || !naturalSize) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    const next = computeCropLayout({
      naturalWidth: naturalSize.w,
      naturalHeight: naturalSize.h,
      viewSize: AVATAR_CROP_VIEW_SIZE,
      zoom,
      rotationDeg,
      offsetX: dragRef.current.originX + dx,
      offsetY: dragRef.current.originY + dy,
    });
    setOffset({ x: next.clampedX, y: next.clampedY });
  };

  const handlePointerUp = () => {
    dragRef.current = null;
  };

  const handleWheel = (e: WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.1 : -0.1;
    updateZoom(zoom + delta);
  };

  const handleViewportKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!naturalSize) return;
    const step = 10;
    let dx = 0;
    let dy = 0;
    if (e.key === 'ArrowLeft') dx = -step;
    else if (e.key === 'ArrowRight') dx = step;
    else if (e.key === 'ArrowUp') dy = -step;
    else if (e.key === 'ArrowDown') dy = step;
    else return;

    e.preventDefault();
    const next = computeCropLayout({
      naturalWidth: naturalSize.w,
      naturalHeight: naturalSize.h,
      viewSize: AVATAR_CROP_VIEW_SIZE,
      zoom,
      rotationDeg,
      offsetX: offset.x + dx,
      offsetY: offset.y + dy,
    });
    setOffset({ x: next.clampedX, y: next.clampedY });
  };

  const handleApply = () => {
    if (!imgRef.current || !layout) return;
    try {
      const dataUrl = renderCroppedAvatarDataUrl(imgRef.current, {
        zoom,
        rotationDeg,
        offsetX: layout.clampedX,
        offsetY: layout.clampedY,
      });
      onConfirm(dataUrl);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : t('cropModal.processError'));
    }
  };

  return (
    <Modal open={Boolean(imageSrc)} title={resolvedTitle} onClose={onCancel} maxWidthClass="max-w-sm">
      <div className="space-y-4">
        <p className="text-xs text-[var(--text-secondary)] text-center">
          {t('cropModal.hint')}
        </p>

        <div className="flex justify-center">
          <div
            role="application"
            tabIndex={0}
            aria-label={t('cropModal.viewportAria')}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onWheel={handleWheel}
            onKeyDown={handleViewportKeyDown}
            style={{ width: AVATAR_CROP_VIEW_SIZE, height: AVATAR_CROP_VIEW_SIZE }}
            className="relative overflow-hidden rounded-2xl bg-[var(--bg-app)] border border-[var(--border-subtle)] touch-none cursor-grab active:cursor-grabbing select-none"
          >
            {imageSrc && (
              <img
                ref={imgRef}
                src={imageSrc}
                alt={t('cropModal.previewAlt')}
                draggable={false}
                onLoad={(e) => {
                  const el = e.currentTarget;
                  setNaturalSize({ w: el.naturalWidth, h: el.naturalHeight });
                }}
                onError={() => setLoadError(t('cropModal.loadError'))}
                style={
                  layout
                    ? {
                        position: 'absolute',
                        left: '50%',
                        top: '50%',
                        width: layout.drawWidth,
                        height: layout.drawHeight,
                        maxWidth: 'none',
                        transform: `translate(calc(-50% + ${layout.clampedX}px), calc(-50% + ${layout.clampedY}px)) rotate(${rotationDeg}deg)`,
                      }
                    : { opacity: 0 }
                }
                className="pointer-events-none select-none"
              />
            )}

            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 rounded-full ring-2 ring-[var(--status-e2ee)]"
              style={{ boxShadow: '0 0 0 999px rgba(0, 0, 0, 0.55)' }}
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <label htmlFor="avatar-zoom-slider" className="font-medium text-[var(--text-secondary)]">
              {t('cropModal.zoomLabel')}
            </label>
            <span className="tabular-nums text-[var(--text-primary)] font-medium">
              {Math.round(zoom * 100)}%
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => updateZoom(zoom - 0.15)}
              aria-label={t('cropModal.zoomOutAria')}
              className="p-2 rounded-full bg-[var(--bg-app)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              <Minus className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
            <input
              id="avatar-zoom-slider"
              type="range"
              min={1}
              max={3}
              step={0.05}
              value={zoom}
              onChange={(e) => updateZoom(Number(e.target.value))}
              className="flex-1 accent-[var(--accent-primary)] cursor-pointer"
            />
            <button
              type="button"
              onClick={() => updateZoom(zoom + 0.15)}
              aria-label={t('cropModal.zoomInAria')}
              className="p-2 rounded-full bg-[var(--bg-app)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={handleRotate}
            className="px-3.5 py-2 rounded-full bg-[var(--bg-app)] border border-[var(--border-subtle)] text-xs font-medium inline-flex items-center gap-1.5 hover:bg-[var(--bg-hover)]"
          >
            <RotateCw className="w-3.5 h-3.5 text-[var(--status-e2ee)]" aria-hidden="true" />
            <span>{t('cropModal.rotateBtn')}</span>
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="px-3.5 py-2 rounded-full bg-[var(--bg-app)] border border-[var(--border-subtle)] text-xs font-medium inline-flex items-center gap-1.5 hover:bg-[var(--bg-hover)]"
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{t('cropModal.resetBtn')}</span>
          </button>
        </div>

        {loadError && (
          <p role="alert" className="text-xs text-center text-[var(--status-danger)]">
            {loadError}
          </p>
        )}

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2.5 rounded-xl border border-[var(--border-subtle)] text-sm font-medium hover:bg-[var(--bg-hover)]"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            disabled={!layout || Boolean(loadError)}
            onClick={handleApply}
            className="flex-1 py-2.5 px-4 rounded-xl bg-[var(--accent-primary)] text-[var(--accent-fg)] font-semibold text-sm hover:bg-[var(--accent-hover)] disabled:opacity-50"
          >
            {t('cropModal.applyBtn')}
          </button>
        </div>
      </div>
    </Modal>
  );
};

