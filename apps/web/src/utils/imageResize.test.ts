import { describe, expect, it } from 'vitest';
import { computeCropLayout } from './imageResize';

describe('computeCropLayout', () => {
  it('covers square viewport and clamps horizontal pan on landscape image', () => {
    const layout = computeCropLayout({
      naturalWidth: 800,
      naturalHeight: 400,
      viewSize: 240,
      zoom: 1,
      rotationDeg: 0,
      offsetX: 500,
      offsetY: 500,
    });

    expect(layout.drawHeight).toBe(240);
    expect(layout.drawWidth).toBe(480);
    expect(layout.maxOffsetX).toBe(120);
    expect(layout.maxOffsetY).toBe(0);
    expect(layout.clampedX).toBe(120);
    expect(layout.clampedY).toBe(0);
  });

  it('swaps aspect coverage bounds when rotated 90 degrees and expands pan with zoom', () => {
    const layout = computeCropLayout({
      naturalWidth: 800,
      naturalHeight: 400,
      viewSize: 240,
      zoom: 2,
      rotationDeg: 90,
      offsetX: -150,
      offsetY: 200,
    });

    expect(layout.maxOffsetX).toBe(120);
    expect(layout.maxOffsetY).toBe(360);
    expect(layout.clampedX).toBe(-120);
    expect(layout.clampedY).toBe(200);
  });
});

