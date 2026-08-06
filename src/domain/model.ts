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

export type ComparisonState = {
  readonly kind: 'wipe';
  /**
   * Normalized viewport X coordinate.
   * 0 means all B.
   * 1 means all A.
   */
  readonly position: number;
};

export interface Workspace {
  readonly imageSet: ImageSet;
  readonly selection: SelectionState;
  readonly camera: CameraState | null;
  readonly comparison: ComparisonState;
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
