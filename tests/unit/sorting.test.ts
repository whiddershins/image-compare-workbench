import { describe, expect, it } from 'vitest';
import { naturalCompare, sortAssets } from '../../src/domain/sorting';
import type { ImageAsset } from '../../src/domain/model';

function asset(
  partial: Partial<ImageAsset> & Pick<ImageAsset, 'id' | 'relativePath'>,
): ImageAsset {
  return {
    name: partial.relativePath.split('/').pop() ?? partial.relativePath,
    mediaType: 'image/png',
    byteSize: 1,
    lastModified: 0,
    width: 10,
    height: 10,
    importOrdinal: 0,
    ...partial,
  };
}

describe('naturalCompare', () => {
  it('orders numeric runs as numbers', () => {
    expect(naturalCompare('image2.png', 'image10.png')).toBeLessThan(0);
    expect(naturalCompare('image10.png', 'image3.png')).toBeGreaterThan(0);
  });

  it('handles relative paths', () => {
    expect(naturalCompare('shot-01/a.png', 'shot-02/a.png')).toBeLessThan(0);
  });
});

describe('sortAssets', () => {
  it('sorts by relative path with natural order', () => {
    const sorted = sortAssets([
      asset({ id: 'c', relativePath: 'image10.png', importOrdinal: 0 }),
      asset({ id: 'a', relativePath: 'image2.png', importOrdinal: 1 }),
      asset({ id: 'b', relativePath: 'image3.png', importOrdinal: 2 }),
    ]);
    expect(sorted.map((a) => a.relativePath)).toEqual([
      'image2.png',
      'image3.png',
      'image10.png',
    ]);
  });

  it('uses importOrdinal as stable tie-breaker', () => {
    const sorted = sortAssets([
      asset({ id: 'b', relativePath: 'same.png', importOrdinal: 2 }),
      asset({ id: 'a', relativePath: 'same.png', importOrdinal: 1 }),
    ]);
    expect(sorted.map((a) => a.id)).toEqual(['a', 'b']);
  });
});
