import { describe, expect, it } from 'vitest';
import type { ImageAsset, Workspace } from '../../src/domain/model';
import {
  appendAssets,
  emptyWorkspace,
  selectAsset,
  setSizeNormalization,
} from '../../src/domain/workspaceTransitions';
import {
  imageWorldScale,
  placedBounds,
  pairContext,
} from '../../src/domain/sizeNormalization';
import { selectedPairBounds } from '../../src/domain/camera';

function asset(
  id: string,
  width: number,
  height: number,
  ordinal: number,
): ImageAsset {
  return {
    id,
    name: `${id}.png`,
    relativePath: `${id}.png`,
    mediaType: 'image/png',
    byteSize: 1,
    lastModified: 0,
    width,
    height,
    importOrdinal: ordinal,
  };
}

function workspaceWithPair(a: ImageAsset, b: ImageAsset): Workspace {
  let w = appendAssets(emptyWorkspace(), [a, b]);
  const sa = selectAsset(w, 'a', a.id);
  if (!sa.ok) throw new Error('select a');
  w = sa.value;
  const sb = selectAsset(w, 'b', b.id);
  if (!sb.ok) throw new Error('select b');
  return sb.value;
}

describe('size normalization', () => {
  const small = asset('small', 768, 1376, 0);
  const large = asset('large', 2304, 4096, 1); // 3× linear scale of small if same aspect... 
  // 2304/768=3, 4096/1376≈2.976 — nearly same composition

  it('native keeps scale 1 for both', () => {
    const w = setSizeNormalization(
      workspaceWithPair(small, large),
      'native',
    );
    const pair = pairContext(w);
    expect(imageWorldScale(small, 'native', pair)).toBe(1);
    expect(imageWorldScale(large, 'native', pair)).toBe(1);
  });

  it('equal-height makes world heights match', () => {
    const w = setSizeNormalization(
      workspaceWithPair(small, large),
      'equal-height',
    );
    const pair = pairContext(w);
    const sSmall = imageWorldScale(small, 'equal-height', pair);
    const sLarge = imageWorldScale(large, 'equal-height', pair);
    expect(small.height * sSmall).toBeCloseTo(large.height * sLarge);
    expect(small.height * sSmall).toBeCloseTo(Math.max(small.height, large.height));
  });

  it('equal-width makes world widths match', () => {
    const w = setSizeNormalization(
      workspaceWithPair(small, large),
      'equal-width',
    );
    const pair = pairContext(w);
    const sSmall = imageWorldScale(small, 'equal-width', pair);
    const sLarge = imageWorldScale(large, 'equal-width', pair);
    expect(small.width * sSmall).toBeCloseTo(large.width * sLarge);
  });

  it('equal-max-edge matches longer edges', () => {
    const w = setSizeNormalization(
      workspaceWithPair(small, large),
      'equal-max-edge',
    );
    const pair = pairContext(w);
    const sSmall = imageWorldScale(small, 'equal-max-edge', pair);
    const sLarge = imageWorldScale(large, 'equal-max-edge', pair);
    const eSmall = Math.max(small.width, small.height) * sSmall;
    const eLarge = Math.max(large.width, large.height) * sLarge;
    expect(eSmall).toBeCloseTo(eLarge);
  });

  it('match-a keeps A native and scales B to A height', () => {
    const w = setSizeNormalization(
      workspaceWithPair(small, large),
      'match-a',
    );
    const pair = pairContext(w);
    expect(imageWorldScale(small, 'match-a', pair)).toBe(1);
    const sB = imageWorldScale(large, 'match-a', pair);
    expect(large.height * sB).toBeCloseTo(small.height);
  });

  it('match-b keeps B native and scales A to B height', () => {
    const w = setSizeNormalization(
      workspaceWithPair(small, large),
      'match-b',
    );
    const pair = pairContext(w);
    expect(imageWorldScale(large, 'match-b', pair)).toBe(1);
    const sA = imageWorldScale(small, 'match-b', pair);
    expect(small.height * sA).toBeCloseTo(large.height);
  });

  it('setSizeNormalization does not alter camera or wipe', () => {
    let w = workspaceWithPair(small, large);
    w = {
      ...w,
      camera: { centerX: 10, centerY: -4, scale: 2 },
      comparison: {
        kind: 'wipe',
        lock: 'world',
        position: 0.33,
        worldX: 0,
      },
    };
    const cam = w.camera;
    const wipe = w.comparison;
    const next = setSizeNormalization(w, 'equal-height');
    expect(next.camera).toBe(cam);
    expect(next.comparison).toBe(wipe);
    expect(next.sizeNormalization).toBe('equal-height');
  });

  it('placed bounds use world scale', () => {
    const scale = 2;
    const b = placedBounds(small, scale);
    expect(b.right - b.left).toBeCloseTo(small.width * scale);
    expect(b.bottom - b.top).toBeCloseTo(small.height * scale);
  });

  it('selectedPairBounds respects normalization for fit', () => {
    const w = setSizeNormalization(
      workspaceWithPair(small, large),
      'equal-height',
    );
    const bounds = selectedPairBounds(w);
    expect(bounds).not.toBeNull();
    // After equal-height, both heights equal max → union height is that max
    expect(bounds!.bottom - bounds!.top).toBeCloseTo(
      Math.max(small.height, large.height),
    );
  });

  it('same aspect overlay: match-a makes world sizes nearly equal', () => {
    // Exact 2× variant
    const a = asset('a', 100, 200, 0);
    const b = asset('b', 200, 400, 1);
    const w = setSizeNormalization(workspaceWithPair(a, b), 'match-a');
    const pair = pairContext(w);
    const sA = imageWorldScale(a, 'match-a', pair);
    const sB = imageWorldScale(b, 'match-a', pair);
    expect(a.width * sA).toBeCloseTo(b.width * sB);
    expect(a.height * sA).toBeCloseTo(b.height * sB);
  });
});
