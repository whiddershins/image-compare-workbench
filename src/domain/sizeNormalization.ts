import type {
  Bounds,
  ImageAsset,
  SizeNormalizationMode,
  Workspace,
} from './model';
import { imageBounds } from './geometry';
import { getAsset } from './workspaceTransitions';

export interface PairContext {
  readonly a: ImageAsset | null;
  readonly b: ImageAsset | null;
}

export function pairContext(workspace: Workspace): PairContext {
  return {
    a: getAsset(workspace, workspace.selection.a),
    b: getAsset(workspace, workspace.selection.b),
  };
}

/**
 * Uniform scale from source pixels → world units for one asset in the pair.
 * Always preserves aspect ratio.
 */
export function imageWorldScale(
  asset: ImageAsset,
  mode: SizeNormalizationMode,
  pair: PairContext,
): number {
  if (mode === 'native') return 1;

  const { a, b } = pair;

  if (mode === 'match-a') {
    if (!a) return 1;
    if (asset.id === a.id) return 1;
    return scaleToMatchReference(asset, a);
  }

  if (mode === 'match-b') {
    if (!b) return 1;
    if (asset.id === b.id) return 1;
    return scaleToMatchReference(asset, b);
  }

  // Pair-equal modes need both sides when possible
  const dims = dimensionsForMode(mode, a, b);
  if (!dims) return 1;
  return scaleToTarget(asset, mode, dims.target);
}

/**
 * Match reference by height when both are portrait-ish, else by max edge.
 * Using height for typical gen/compare stacks keeps vertical features aligned;
 * for very different aspects we still only use a uniform scale (no stretch).
 */
function scaleToMatchReference(
  asset: ImageAsset,
  reference: ImageAsset,
): number {
  if (asset.height <= 0 || reference.height <= 0) return 1;
  // Prefer height match — same-composition res variants usually share aspect
  return reference.height / asset.height;
}

function dimensionsForMode(
  mode: 'equal-height' | 'equal-width' | 'equal-max-edge',
  a: ImageAsset | null,
  b: ImageAsset | null,
): { target: number } | null {
  const values: number[] = [];
  for (const asset of [a, b]) {
    if (!asset) continue;
    if (mode === 'equal-height') values.push(asset.height);
    else if (mode === 'equal-width') values.push(asset.width);
    else values.push(Math.max(asset.width, asset.height));
  }
  if (values.length === 0) return null;
  return { target: Math.max(...values) };
}

function scaleToTarget(
  asset: ImageAsset,
  mode: 'equal-height' | 'equal-width' | 'equal-max-edge',
  target: number,
): number {
  if (target <= 0) return 1;
  if (mode === 'equal-height') {
    return asset.height > 0 ? target / asset.height : 1;
  }
  if (mode === 'equal-width') {
    return asset.width > 0 ? target / asset.width : 1;
  }
  const edge = Math.max(asset.width, asset.height);
  return edge > 0 ? target / edge : 1;
}

export function placedWorldSize(
  asset: ImageAsset,
  worldScale: number,
): { width: number; height: number } {
  return {
    width: asset.width * worldScale,
    height: asset.height * worldScale,
  };
}

export function placedBounds(asset: ImageAsset, worldScale: number): Bounds {
  const { width, height } = placedWorldSize(asset, worldScale);
  return imageBounds(width, height);
}

export function assetWorldScaleInWorkspace(
  workspace: Workspace,
  asset: ImageAsset,
): number {
  return imageWorldScale(
    asset,
    workspace.sizeNormalization,
    pairContext(workspace),
  );
}

export function sizeNormalizationLabel(mode: SizeNormalizationMode): string {
  switch (mode) {
    case 'native':
      return 'Native px';
    case 'equal-height':
      return 'Equal height';
    case 'equal-width':
      return 'Equal width';
    case 'equal-max-edge':
      return 'Equal max edge';
    case 'match-a':
      return 'Match A';
    case 'match-b':
      return 'Match B';
  }
}

export function sizeNormalizationDescription(
  mode: SizeNormalizationMode,
): string {
  switch (mode) {
    case 'native':
      return 'True pixel sizes. Different resolutions will not overlay.';
    case 'equal-height':
      return 'Scale both so heights match (larger height wins). Good for same-composition stacks.';
    case 'equal-width':
      return 'Scale both so widths match.';
    case 'equal-max-edge':
      return 'Scale both so the longer edge matches.';
    case 'match-a':
      return 'Keep A at native size; scale B to A’s height. A stays put while cycling B.';
    case 'match-b':
      return 'Keep B at native size; scale A to B’s height.';
  }
}
