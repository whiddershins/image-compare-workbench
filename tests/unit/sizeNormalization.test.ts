import { describe, expect, it } from 'vitest';
import type { ImageAsset, SizeNormalization, Workspace } from '../../src/domain/model';
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

function withNorm(w: Workspace, norm: SizeNormalization): Workspace {
  return setSizeNormalization(w, norm);
}

describe('size normalization (orthogonal basis × reference)', () => {
  const small = asset('small', 768, 1376, 0);
  const large = asset('large', 2304, 4096, 1);

  it('native keeps scale 1 for both regardless of reference', () => {
    const w = withNorm(workspaceWithPair(small, large), {
      basis: 'native',
      reference: 'a',
    });
    const pair = pairContext(w);
    expect(imageWorldScale(small, w.sizeNormalization, pair)).toBe(1);
    expect(imageWorldScale(large, w.sizeNormalization, pair)).toBe(1);
  });

  it('height × pair makes world heights match', () => {
    const w = withNorm(workspaceWithPair(small, large), {
      basis: 'height',
      reference: 'pair',
    });
    const pair = pairContext(w);
    const sSmall = imageWorldScale(small, w.sizeNormalization, pair);
    const sLarge = imageWorldScale(large, w.sizeNormalization, pair);
    expect(small.height * sSmall).toBeCloseTo(large.height * sLarge);
    expect(small.height * sSmall).toBeCloseTo(
      Math.max(small.height, large.height),
    );
  });

  it('width × pair makes world widths match', () => {
    const w = withNorm(workspaceWithPair(small, large), {
      basis: 'width',
      reference: 'pair',
    });
    const pair = pairContext(w);
    const sSmall = imageWorldScale(small, w.sizeNormalization, pair);
    const sLarge = imageWorldScale(large, w.sizeNormalization, pair);
    expect(small.width * sSmall).toBeCloseTo(large.width * sLarge);
  });

  it('max-edge × pair matches longer edges', () => {
    const w = withNorm(workspaceWithPair(small, large), {
      basis: 'max-edge',
      reference: 'pair',
    });
    const pair = pairContext(w);
    const sSmall = imageWorldScale(small, w.sizeNormalization, pair);
    const sLarge = imageWorldScale(large, w.sizeNormalization, pair);
    const eSmall = Math.max(small.width, small.height) * sSmall;
    const eLarge = Math.max(large.width, large.height) * sLarge;
    expect(eSmall).toBeCloseTo(eLarge);
  });

  it('height × lock A keeps A native and scales B to A height', () => {
    const w = withNorm(workspaceWithPair(small, large), {
      basis: 'height',
      reference: 'a',
    });
    const pair = pairContext(w);
    expect(imageWorldScale(small, w.sizeNormalization, pair)).toBe(1);
    const sB = imageWorldScale(large, w.sizeNormalization, pair);
    expect(large.height * sB).toBeCloseTo(small.height);
  });

  it('width × lock A scales B to A width', () => {
    const w = withNorm(workspaceWithPair(small, large), {
      basis: 'width',
      reference: 'a',
    });
    const pair = pairContext(w);
    expect(imageWorldScale(small, w.sizeNormalization, pair)).toBe(1);
    const sB = imageWorldScale(large, w.sizeNormalization, pair);
    expect(large.width * sB).toBeCloseTo(small.width);
  });

  it('height × lock B keeps B native and scales A to B height', () => {
    const w = withNorm(workspaceWithPair(small, large), {
      basis: 'height',
      reference: 'b',
    });
    const pair = pairContext(w);
    expect(imageWorldScale(large, w.sizeNormalization, pair)).toBe(1);
    const sA = imageWorldScale(small, w.sizeNormalization, pair);
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
    const next = setSizeNormalization(w, {
      basis: 'height',
      reference: 'pair',
    });
    expect(next.camera).toBe(cam);
    expect(next.comparison).toBe(wipe);
    expect(next.sizeNormalization).toEqual({
      basis: 'height',
      reference: 'pair',
    });
  });

  it('placed bounds use world scale', () => {
    const scale = 2;
    const b = placedBounds(small, scale);
    expect(b.right - b.left).toBeCloseTo(small.width * scale);
    expect(b.bottom - b.top).toBeCloseTo(small.height * scale);
  });

  it('selectedPairBounds respects height × pair for fit', () => {
    const w = withNorm(workspaceWithPair(small, large), {
      basis: 'height',
      reference: 'pair',
    });
    const bounds = selectedPairBounds(w);
    expect(bounds).not.toBeNull();
    expect(bounds!.bottom - bounds!.top).toBeCloseTo(
      Math.max(small.height, large.height),
    );
  });

  it('same aspect: height × lock A makes world sizes equal', () => {
    const a = asset('a', 100, 200, 0);
    const b = asset('b', 200, 400, 1);
    const w = withNorm(workspaceWithPair(a, b), {
      basis: 'height',
      reference: 'a',
    });
    const pair = pairContext(w);
    const sA = imageWorldScale(a, w.sizeNormalization, pair);
    const sB = imageWorldScale(b, w.sizeNormalization, pair);
    expect(a.width * sA).toBeCloseTo(b.width * sB);
    expect(a.height * sA).toBeCloseTo(b.height * sB);
  });
});
