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
 * How the wipe plane responds to camera navigation.
 * - hybrid (default):
 *   - pointer drag / Space+drag: screen-fixed wipe (images slide under divider)
 *   - two-finger / wheel pan: world-locked (camera + wipe move together)
 *   - zoom: image-fixed (divider stays on the same image position)
 * - world: fixed world/image coordinate through both pan and zoom
 * - viewport: fixed screen fraction through both pan and zoom
 */
export const WIPE_BEHAVIORS = ['hybrid', 'world', 'viewport'] as const;
export type WipeBehavior = (typeof WIPE_BEHAVIORS)[number];

/**
 * Wipe divider orientation.
 * - vertical: A left of divider, B right (default)
 * - horizontal: A above divider, B below
 * position 0 = all B, 1 = all A in both cases.
 */
export type WipeAxis = 'vertical' | 'horizontal';

/**
 * Two orthogonal sticky axes for the main view:
 * - presentation: wipe composite vs solo full frame
 * - focus: which side is "home" when full, and drives A tap / B tap
 *
 * Switching Wipe ↔ Full must not change focus, so side-tap stays stable.
 * Re-pressing Full flips focus a↔b. Momentary side-tap is session UI only.
 */
export type ViewPresentation = 'wipe' | 'full';
export type ViewFocus = 'a' | 'b';

/** What the viewport draws (sticky or after side-tap overlay). */
export type DrawnView = 'wipe' | 'a' | 'b';

export type ComparisonState = {
  readonly kind: 'wipe';
  readonly presentation: ViewPresentation;
  readonly focus: ViewFocus;
  readonly axis: WipeAxis;
  readonly behavior: WipeBehavior;
  /**
   * Normalized fraction along the wipe axis (0 = all B, 1 = all A).
   * Authoritative when behavior is 'viewport'. Otherwise this is a screen cache;
   * display is derived from worldX/worldY + camera.
   */
  readonly position: number;
  /** World-space X of the wipe plane for vertical hybrid/world behavior. */
  readonly worldX: number;
  /** World-space Y of the wipe plane for horizontal hybrid/world behavior. */
  readonly worldY: number;
};

export const DEFAULT_WIPE_BEHAVIOR: WipeBehavior = 'hybrid';
export const DEFAULT_WIPE_AXIS: WipeAxis = 'vertical';
export const DEFAULT_VIEW_PRESENTATION: ViewPresentation = 'wipe';
export const DEFAULT_VIEW_FOCUS: ViewFocus = 'a';

/**
 * What dimension is equalized into world space (orthogonal to reference).
 * - native: 1 world unit = 1 source pixel; reference is ignored
 * - height | width | max-edge | min-edge: uniform scale so that dimension matches
 */
export type SizeNormBasis =
  | 'native'
  | 'height'
  | 'width'
  | 'max-edge'
  | 'min-edge';

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
  'min-edge',
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
