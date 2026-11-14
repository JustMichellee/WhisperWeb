const MAX_AVATAR_SOURCE_BYTES = 5 * 1024 * 1024;
export const AVATAR_CROP_VIEW_SIZE = 240;
export const AVATAR_OUTPUT_SIZE = 192;

export interface CropLayoutInput {
  naturalWidth: number;
  naturalHeight: number;
  viewSize?: number;
  zoom: number;
  rotationDeg: number;
  offsetX: number;
  offsetY: number;
}

export interface CropLayoutResult {
  scale: number;
  drawWidth: number;
  drawHeight: number;
  maxOffsetX: number;
  maxOffsetY: number;
  clampedX: number;
  clampedY: number;
}

export function validateAvatarFile(file: File): void {
  if (!file.type.startsWith('image/')) {
    throw new Error('Pilih file gambar (JPG, PNG, WEBP).');
  }
  if (file.size > MAX_AVATAR_SOURCE_BYTES) {
    throw new Error('Ukuran gambar sumber maksimal 5 MB.');
  }
}

/**
 * Computes image dimensions and clamped pan offsets for a rotated square crop viewport.
 */
export function computeCropLayout({
  naturalWidth,
  naturalHeight,
  viewSize = AVATAR_CROP_VIEW_SIZE,
  zoom,
  rotationDeg,
  offsetX,
  offsetY,
}: CropLayoutInput): CropLayoutResult {
  const safeW = Math.max(1, naturalWidth);
  const safeH = Math.max(1, naturalHeight);
  const normalizedRot = ((rotationDeg % 360) + 360) % 360;
  const swapped = normalizedRot === 90 || normalizedRot === 270;
  const rotW = swapped ? safeH : safeW;
  const rotH = swapped ? safeW : safeH;

  const baseScale = Math.max(viewSize / rotW, viewSize / rotH);
  const safeZoom = Math.max(1, Math.min(4, zoom));
  const scale = baseScale * safeZoom;

  const rotDrawW = rotW * scale;
  const rotDrawH = rotH * scale;
  const maxOffsetX = Math.max(0, (rotDrawW - viewSize) / 2);
  const maxOffsetY = Math.max(0, (rotDrawH - viewSize) / 2);

  const clampedX = Math.max(-maxOffsetX, Math.min(maxOffsetX, offsetX));
  const clampedY = Math.max(-maxOffsetY, Math.min(maxOffsetY, offsetY));

  return {
    scale,
    drawWidth: safeW * scale,
    drawHeight: safeH * scale,
    maxOffsetX,
    maxOffsetY,
    clampedX,
    clampedY,
  };
}

/**
 * Renders the adjusted crop viewport onto a 192x192 canvas and returns a compact Data URL.
 */
export function renderCroppedAvatarDataUrl(
  img: HTMLImageElement,
  params: {
    zoom: number;
    rotationDeg: number;
    offsetX: number;
    offsetY: number;
    viewSize?: number;
  }
): string {
  const viewSize = params.viewSize ?? AVATAR_CROP_VIEW_SIZE;
  const layout = computeCropLayout({
    naturalWidth: img.naturalWidth || img.width,
    naturalHeight: img.naturalHeight || img.height,
    viewSize,
    zoom: params.zoom,
    rotationDeg: params.rotationDeg,
    offsetX: params.offsetX,
    offsetY: params.offsetY,
  });

  const canvas = document.createElement('canvas');
  canvas.width = AVATAR_OUTPUT_SIZE;
  canvas.height = AVATAR_OUTPUT_SIZE;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Browser tidak mendukung pemrosesan gambar kanvas.');
  }

  const ratio = AVATAR_OUTPUT_SIZE / viewSize;
  const outW = layout.drawWidth * ratio;
  const outH = layout.drawHeight * ratio;

  ctx.save();
  ctx.translate(
    AVATAR_OUTPUT_SIZE / 2 + layout.clampedX * ratio,
    AVATAR_OUTPUT_SIZE / 2 + layout.clampedY * ratio
  );
  ctx.rotate((params.rotationDeg * Math.PI) / 180);
  ctx.drawImage(img, -outW / 2, -outH / 2, outW, outH);
  ctx.restore();

  const webpUrl = canvas.toDataURL('image/webp', 0.85);
  if (webpUrl.startsWith('data:image/webp') && webpUrl.length <= 340_000) {
    return webpUrl;
  }

  const jpegUrl = canvas.toDataURL('image/jpeg', 0.85);
  if (jpegUrl.length > 340_000) {
    throw new Error('Ukuran gambar terlalu besar setelah dikompresi.');
  }
  return jpegUrl;
}
