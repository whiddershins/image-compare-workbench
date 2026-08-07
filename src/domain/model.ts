export type AssetId = string;
export type Side = 'a' | 'b';

export interface ImageAsset {
  readonly id: AssetId;
  readonly name: string;
  readonly relativePath: string;
  readonly mediaType: string | null;
  readonly byteSize: number;
  readonly lastModified: number;
  readonly width: number;
  readonly height: number;
  readonly importOrdinal: number;
}

export interface ImageSet {
  readonly assets: readonly ImageAsset[];
}

export interface SelectionState {
  readonly a: AssetId | null;
  readonly b: AssetId | null;
  readonly activeSide: Side;
}

export interface CameraState {
  /**
   * World coordinate displayed at the center of the viewport.
   * World units are source-image pixels.
   */
  readonly centerX: number;
  readonly centerY: number;

  /**
   * CSS pixels displayed per world unit.
   * A value of 1 means one source-image pixel per CSS pixel.
   */
  readonly scale: number;
}

/**
 * Where the wipe plane is anchored.
 * - world: fixed world coordinate along the wipe axis (default)
 * - viewport: fixed screen fraction (content slides under the line)
 */
export type WipeLock = 'world' | 'viewport';

/**
 * Wipe divider orientation.
 * - vertical: A left of divider, B right (default)
 * - horizontal: A above divider, B below
 * position 0 = all B, 1 = all A in both cases.
 */
export type WipeAxis = 'vertical' | 'horizontal';

/**
 * Sticky presentation of A/B (toolbar: Full A | Wipe).
 * Mutually exclusive. B tap (momentary full B) is NOT stored here — it is
 * session UI state that overlays this mode while a key/button is held.
 * - full-a: only side A (full frame)
 * - wipe: A/B wipe composite (default)
 * Wipe geometry (position/lock) is preserved when switching sticky modes.
 */
export type ViewMode = 'full-a' | 'wipe';

/**
 * What the viewport actually draws right now.
 * Includes momentary B tap (full B) which never becomes sticky domain state.
 */
export type EffectiveView = ViewMode | 'full-b';

export type ComparisonState = {
  readonly kind: 'wipe';
  readonly viewMode: ViewMode;
  readonly axis: WipeAxis;
  readonly lock: WipeLock;
  /**
   * Normalized fraction along the wipe axis (0 = all B, 1 = all A).
   * Authoritative when lock is 'viewport'. When lock is 'world', cache of
   * last drag; display is derived from worldX/worldY + camera.
   */
  readonly position: number;
  /**
   * World-space X of the wipe plane (used when axis is vertical + world lock).
   */
  readonly worldX: number;
  /**
   * World-space Y of the wipe plane (used when axis is horizontal + world lock).
   */
  readonly worldY: number;
};

export const DEFAULT_WIPE_LOCK: WipeLock = 'world';
export const DEFAULT_WIPE_AXIS: WipeAxis = 'vertical';
export const DEFAULT_VIEW_MODE: ViewMode = 'wipe';

export const VIEW_MODES: readonly ViewMode[] = ['full-a', 'wipe'] as const;

/**
 * What dimension is equalized into world space (orthogonal to reference).
 * - native: 1 world unit = 1 source pixel; reference is ignored
 * - height | width | max-edge: uniform scale so that dimension matches
 */
export type SizeNormBasis = 'native' | 'height' | 'width' | 'max-edge';

/**
 * Who owns the target size (orthogonal to basis).
 * - pair: both sides scale so the basis dimension equals max(A, B)
 * - a: A stays native; B scales to match A’s basis dimension
 * - b: B stays native; A scales to match B’s basis dimension
 */
export type SizeNormReference = 'pair' | 'a' | 'b';

export interface SizeNormalization {
  readonly basis: SizeNormBasis;
  readonly reference: SizeNormReference;
}

export const SIZE_NORM_BASES: readonly SizeNormBasis[] = [
  'native',
  'height',
  'width',
  'max-edge',
] as const;

export const SIZE_NORM_REFERENCES: readonly SizeNormReference[] = [
  'pair',
  'a',
  'b',
] as const;

export const DEFAULT_SIZE_NORMALIZATION: SizeNormalization = {
  basis: 'max-edge',
  reference: 'pair',
};

export interface Workspace {
  readonly imageSet: ImageSet;
  readonly selection: SelectionState;
  readonly camera: CameraState | null;
  readonly comparison: ComparisonState;
  /**
   * Per-image placement into world space for the current A/B pair.
   * Basis and reference are orthogonal controls.
   */
  readonly sizeNormalization: SizeNormalization;
}

export type ImportIssue =
  | {
      readonly kind: 'unsupported-file';
      readonly path: string;
    }
  | {
      readonly kind: 'duplicate-file';
      readonly path: string;
    }
  | {
      readonly kind: 'decode-failed';
      readonly path: string;
      readonly reason: string;
    }
  | {
      readonly kind: 'thumbnail-failed';
      readonly path: string;
      readonly reason: string;
    }
  | {
      readonly kind: 'directory-unreadable';
      readonly path: string;
      readonly reason: string;
    };

export type SelectionError =
  | { readonly kind: 'unknown-asset'; readonly assetId: AssetId }
  | { readonly kind: 'empty-set' };

export interface ViewportSize {
  readonly width: number;
  readonly height: number;
}

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface Bounds {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

export const MIN_CAMERA_SCALE = 0.1;
export const MAX_CAMERA_SCALE = 16;
export const DEFAULT_WIPE = 0.5;
export const FIT_PADDING = 0.08;
