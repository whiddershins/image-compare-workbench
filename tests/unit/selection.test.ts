import { describe, expect, it } from 'vitest';
import type { ImageAsset, Workspace } from '../../src/domain/model';
import {
  appendAssets,
  clearWorkspace,
  cycleSelection,
  emptyWorkspace,
  selectAsset,
  setActiveSide,
  setWipePosition,
  swapSelections,
} from '../../src/domain/workspaceTransitions';

function makeAsset(id: string, path: string, ordinal: number): ImageAsset {
  return {
    id,
    name: path,
    relativePath: path,
    mediaType: 'image/png',
    byteSize: 100,
    lastModified: 1,
    width: 100,
    height: 80,
    importOrdinal: ordinal,
  };
}

function withAssets(assets: ImageAsset[]): Workspace {
  return appendAssets(emptyWorkspace(), assets);
}

describe('selection', () => {
  it('initial selection: zero assets', () => {
    const w = emptyWorkspace();
    expect(w.selection.a).toBeNull();
    expect(w.selection.b).toBeNull();
  });

  it('initial selection: one asset sets A and B to it', () => {
    const w = withAssets([makeAsset('1', 'a.png', 0)]);
    expect(w.selection.a).toBe('1');
    expect(w.selection.b).toBe('1');
    expect(w.selection.activeSide).toBe('b');
  });

  it('initial selection: multiple assets sets A=first B=second', () => {
    const w = withAssets([
      makeAsset('1', 'a.png', 0),
      makeAsset('2', 'b.png', 1),
      makeAsset('3', 'c.png', 2),
    ]);
    expect(w.selection.a).toBe('1');
    expect(w.selection.b).toBe('2');
  });

  it('selecting A changes only A', () => {
    let w = withAssets([
      makeAsset('1', 'a.png', 0),
      makeAsset('2', 'b.png', 1),
      makeAsset('3', 'c.png', 2),
    ]);
    w = { ...w, camera: { centerX: 1, centerY: 2, scale: 3 } };
    const cameraBefore = w.camera;
    const wipeBefore = w.comparison;
    const result = selectAsset(w, 'a', '3');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.selection.a).toBe('3');
    expect(result.value.selection.b).toBe('2');
    expect(result.value.camera).toBe(cameraBefore);
    expect(result.value.comparison).toBe(wipeBefore);
  });

  it('selecting B changes only B', () => {
    let w = withAssets([
      makeAsset('1', 'a.png', 0),
      makeAsset('2', 'b.png', 1),
      makeAsset('3', 'c.png', 2),
    ]);
    w = { ...w, camera: { centerX: 1, centerY: 2, scale: 3 } };
    const cameraBefore = w.camera;
    const wipeBefore = w.comparison;
    const result = selectAsset(w, 'b', '3');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.selection.b).toBe('3');
    expect(result.value.selection.a).toBe('1');
    expect(result.value.camera).toBe(cameraBefore);
    expect(result.value.comparison).toBe(wipeBefore);
  });

  it('unknown ID produces typed error', () => {
    const w = withAssets([makeAsset('1', 'a.png', 0)]);
    const result = selectAsset(w, 'a', 'missing');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('unknown-asset');
  });

  it('same asset may occupy A and B', () => {
    const w = withAssets([
      makeAsset('1', 'a.png', 0),
      makeAsset('2', 'b.png', 1),
    ]);
    const result = selectAsset(w, 'b', '1');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.selection.a).toBe('1');
    expect(result.value.selection.b).toBe('1');
  });

  it('cycling wraps', () => {
    const w = withAssets([
      makeAsset('1', 'a.png', 0),
      makeAsset('2', 'b.png', 1),
      makeAsset('3', 'c.png', 2),
    ]);
    const next = cycleSelection(w, 'b', 1);
    expect(next.selection.b).toBe('3');
    const wrap = cycleSelection(next, 'b', 1);
    expect(wrap.selection.b).toBe('1');
    const back = cycleSelection(w, 'a', -1);
    expect(back.selection.a).toBe('3');
  });

  it('active side updates on select', () => {
    const w = withAssets([
      makeAsset('1', 'a.png', 0),
      makeAsset('2', 'b.png', 1),
    ]);
    const result = selectAsset(w, 'a', '2');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.selection.activeSide).toBe('a');
    const activated = setActiveSide(result.value, 'b');
    expect(activated.selection.activeSide).toBe('b');
  });

  it('swap exchanges selections and preserves camera/wipe', () => {
    let w = withAssets([
      makeAsset('1', 'a.png', 0),
      makeAsset('2', 'b.png', 1),
    ]);
    w = {
      ...w,
      camera: { centerX: 5, centerY: 6, scale: 2 },
      comparison: { kind: 'wipe', position: 0.3 },
    };
    const cameraBefore = w.camera;
    const wipeBefore = w.comparison;
    const swapped = swapSelections(w);
    expect(swapped.selection.a).toBe('2');
    expect(swapped.selection.b).toBe('1');
    expect(swapped.camera).toBe(cameraBefore);
    expect(swapped.comparison).toBe(wipeBefore);
  });

  it('append preserves selection, camera, wipe', () => {
    let w = withAssets([
      makeAsset('1', 'a.png', 0),
      makeAsset('2', 'b.png', 1),
    ]);
    w = {
      ...w,
      camera: { centerX: 1, centerY: 2, scale: 0.5 },
      comparison: { kind: 'wipe', position: 0.7 },
    };
    const cameraBefore = w.camera;
    const wipeBefore = w.comparison;
    const selBefore = w.selection;
    const next = appendAssets(w, [makeAsset('3', 'c.png', 2)]);
    expect(next.selection).toEqual(selBefore);
    expect(next.camera).toBe(cameraBefore);
    expect(next.comparison).toBe(wipeBefore);
    expect(next.imageSet.assets).toHaveLength(3);
  });

  it('clear empties workspace', () => {
    const w = withAssets([makeAsset('1', 'a.png', 0)]);
    const cleared = clearWorkspace();
    expect(cleared.imageSet.assets).toHaveLength(0);
    expect(cleared.selection.a).toBeNull();
    expect(cleared.camera).toBeNull();
    expect(cleared.comparison.position).toBe(0.5);
  });
});

describe('wipe', () => {
  it('clamps below zero and above one', () => {
    const w = emptyWorkspace();
    expect(setWipePosition(w, -1).comparison.position).toBe(0);
    expect(setWipePosition(w, 2).comparison.position).toBe(1);
    expect(setWipePosition(w, 0).comparison.position).toBe(0);
    expect(setWipePosition(w, 1).comparison.position).toBe(1);
  });
});
