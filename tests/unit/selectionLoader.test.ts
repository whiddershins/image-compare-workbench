import { describe, expect, it } from 'vitest';
import { SelectionLoader } from '../../src/application/selectionLoader';

describe('selection loader latest-wins', () => {
  it('ignores stale completions', () => {
    const loader = new SelectionLoader();
    const t1 = loader.begin('b', 'asset-1');
    const t2 = loader.begin('b', 'asset-2');
    expect(loader.complete('b', t1, 'asset-1', 'url-1')).toBe(false);
    expect(loader.complete('b', t2, 'asset-2', 'url-2')).toBe(true);
    const state = loader.getState('b');
    expect(state.status).toBe('ready');
    if (state.status === 'ready') {
      expect(state.assetId).toBe('asset-2');
      expect(state.url).toBe('url-2');
    }
  });

  it('ignores stale failures after newer request', () => {
    const loader = new SelectionLoader();
    const t1 = loader.begin('a', 'a1');
    const t2 = loader.begin('a', 'a2');
    expect(loader.fail('a', t1, 'a1', 'boom')).toBe(false);
    expect(loader.complete('a', t2, 'a2', 'ok')).toBe(true);
  });

  it('reordered completions: only latest applies', () => {
    const loader = new SelectionLoader();
    const tokens = ['x', 'y', 'z'].map((id) => loader.begin('b', id));
    // Complete out of order: z, x, y
    expect(loader.complete('b', tokens[2]!, 'z', 'uz')).toBe(true);
    expect(loader.complete('b', tokens[0]!, 'x', 'ux')).toBe(false);
    expect(loader.complete('b', tokens[1]!, 'y', 'uy')).toBe(false);
    const state = loader.getState('b');
    expect(state.status).toBe('ready');
    if (state.status === 'ready') expect(state.assetId).toBe('z');
  });
});
