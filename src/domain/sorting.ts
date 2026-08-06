import type { ImageAsset } from './model';

/**
 * Natural sort: numeric runs compare as numbers so image2 < image10.
 * Stable final tie-breaker is importOrdinal.
 */
export function naturalCompare(a: string, b: string): number {
  const left = a.normalize('NFC');
  const right = b.normalize('NFC');
  const re = /(\d+)|(\D+)/g;
  const leftParts = left.match(re) ?? [];
  const rightParts = right.match(re) ?? [];
  const len = Math.max(leftParts.length, rightParts.length);

  for (let i = 0; i < len; i++) {
    const lp = leftParts[i] ?? '';
    const rp = rightParts[i] ?? '';
    if (lp === rp) continue;

    const lNum = /^\d+$/.test(lp);
    const rNum = /^\d+$/.test(rp);
    if (lNum && rNum) {
      const diff = Number(lp) - Number(rp);
      if (diff !== 0) return diff;
      // Equal numeric value: shorter digit run first (e.g. "2" before "02" if ever equal)
      if (lp.length !== rp.length) return lp.length - rp.length;
      continue;
    }
    if (lNum !== rNum) return lNum ? -1 : 1;

    const cmp = lp.localeCompare(rp, undefined, { sensitivity: 'base' });
    if (cmp !== 0) return cmp;
  }
  return 0;
}

export function sortAssets(assets: readonly ImageAsset[]): ImageAsset[] {
  return [...assets].sort((a, b) => {
    const pathCmp = naturalCompare(a.relativePath, b.relativePath);
    if (pathCmp !== 0) return pathCmp;
    return a.importOrdinal - b.importOrdinal;
  });
}
