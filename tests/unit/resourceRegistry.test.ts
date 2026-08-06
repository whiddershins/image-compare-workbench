import { describe, expect, it } from 'vitest';
import {
  AssetResourceRegistry,
  type UrlAdapter,
} from '../../src/infrastructure/browser/assetResourceRegistry';

function fakeAdapter(): UrlAdapter & {
  created: string[];
  revoked: string[];
} {
  let n = 0;
  const created: string[] = [];
  const revoked: string[] = [];
  return {
    created,
    revoked,
    createObjectURL() {
      const url = `blob:fake-${++n}`;
      created.push(url);
      return url;
    },
    revokeObjectURL(url: string) {
      revoked.push(url);
    },
  };
}

describe('resource registry', () => {
  it('revokes original and thumbnail URLs once on dispose', () => {
    const adapter = fakeAdapter();
    const registry = new AssetResourceRegistry(adapter);
    const original = adapter.createObjectURL(new Blob());
    const thumb = adapter.createObjectURL(new Blob());
    const file = new File([new Uint8Array([1])], 'a.png', {
      type: 'image/png',
    });
    const res = registry.register('id-1', file, original, thumb);
    res.dispose();
    res.dispose(); // second dispose is no-op
    expect(adapter.revoked).toEqual([original, thumb]);
    expect(registry.get('id-1').ok).toBe(false);
  });

  it('clear disposes every resource', () => {
    const adapter = fakeAdapter();
    const registry = new AssetResourceRegistry(adapter);
    const file = new File([new Uint8Array([1])], 'a.png');
    for (let i = 0; i < 3; i++) {
      registry.register(
        `id-${i}`,
        file,
        adapter.createObjectURL(new Blob()),
        adapter.createObjectURL(new Blob()),
      );
    }
    expect(registry.size()).toBe(3);
    registry.clear();
    expect(registry.size()).toBe(0);
    expect(adapter.revoked).toHaveLength(6);
  });

  it('missing resource returns typed error', () => {
    const registry = new AssetResourceRegistry(fakeAdapter());
    const result = registry.get('nope');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('missing-resource');
  });
});
