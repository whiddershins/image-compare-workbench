import type {
  Bounds,
  ImageAsset,
  SizeNormBasis,
  SizeNormalization,
  SizeNormReference,
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
 *
 * Controls are orthogonal:
 * - basis: which dimension to equalize (or native)
 * - reference: pair-symmetric max, or lock to A / B native
 */
export function imageWorldScale(
  asset: ImageAsset,
  norm: SizeNormalization,
  pair: PairContext,
): number {
  if (norm.basis === 'native') return 1;

  const { a, b } = pair;

  if (norm.reference === 'a') {
    if (!a) return 1;
    if (asset.id === a.id) return 1;
    return scaleToMatchReference(asset, a, norm.basis);
  }

  if (norm.reference === 'b') {
    if (!b) return 1;
    if (asset.id === b.id) return 1;
    return scaleToMatchReference(asset, b, norm.basis);
  }

  // pair: both sides share max of the chosen basis dimension
  const target = pairTarget(norm.basis, a, b);
  if (target == null) return 1;
  return scaleToTarget(asset, norm.basis, target);
}

function measure(asset: ImageAsset, basis: Exclude<SizeNormBasis, 'native'>): number {
  if (basis === 'height') return asset.height;
  if (basis === 'width') return asset.width;
  return Math.max(asset.width, asset.height);
}

function scaleToMatchReference(
  asset: ImageAsset,
  reference: ImageAsset,
  basis: Exclude<SizeNormBasis, 'native'>,
): number {
  const ref = measure(reference, basis);
  const self = measure(asset, basis);
  if (ref <= 0 || self <= 0) return 1;
  return ref / self;
}

function pairTarget(
  basis: Exclude<SizeNormBasis, 'native'>,
  a: ImageAsset | null,
  b: ImageAsset | null,
): number | null {
  const values: number[] = [];
  if (a) values.push(measure(a, basis));
  if (b) values.push(measure(b, basis));
  if (values.length === 0) return null;
  return Math.max(...values);
}

function scaleToTarget(
  asset: ImageAsset,
  basis: Exclude<SizeNormBasis, 'native'>,
  target: number,
): number {
  if (target <= 0) return 1;
  const self = measure(asset, basis);
  return self > 0 ? target / self : 1;
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

export function sizeNormBasisLabel(basis: SizeNormBasis): string {
  switch (basis) {
    case 'native':
      return 'Native px';
    case 'height':
      return 'Height';
    case 'width':
      return 'Width';
    case 'max-edge':
      return 'Max edge';
  }
}

export function sizeNormReferenceLabel(ref: SizeNormReference): string {
  switch (ref) {
    case 'pair':
      return 'Both (max)';
    case 'a':
      return 'Lock A';
    case 'b':
      return 'Lock B';
  }
}

export function sizeNormBasisDescription(basis: SizeNormBasis): string {
  switch (basis) {
    case 'native':
      return 'True pixel sizes. Different resolutions will not overlay. Reference is ignored.';
    case 'height':
      return 'Equalize image heights in world space (aspect preserved).';
    case 'width':
      return 'Equalize image widths in world space (aspect preserved).';
    case 'max-edge':
      return 'Equalize the longer edge in world space (aspect preserved).';
  }
}

export function sizeNormReferenceDescription(ref: SizeNormReference): string {
  switch (ref) {
    case 'pair':
      return 'Both sides scale so the chosen dimension equals the larger of A and B.';
    case 'a':
      return 'A stays native; B scales to match A on the chosen dimension.';
    case 'b':
      return 'B stays native; A scales to match B on the chosen dimension.';
  }
}

export function withSizeNormBasis(
  current: SizeNormalization,
  basis: SizeNormBasis,
): SizeNormalization {
  if (basis === 'native') {
    return { basis, reference: current.reference };
  }
  return { basis, reference: current.reference };
}

export function withSizeNormReference(
  current: SizeNormalization,
  reference: SizeNormReference,
): SizeNormalization {
  return { basis: current.basis, reference };
}
