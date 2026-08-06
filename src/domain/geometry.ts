import type { Bounds, CameraState, Point, ViewportSize } from './model';
import { MAX_CAMERA_SCALE, MIN_CAMERA_SCALE } from './model';

export function imageBounds(width: number, height: number): Bounds {
  return {
    left: -width / 2,
    right: width / 2,
    top: -height / 2,
    bottom: height / 2,
  };
}

export function unionBounds(a: Bounds, b: Bounds): Bounds {
  return {
    left: Math.min(a.left, b.left),
    right: Math.max(a.right, b.right),
    top: Math.min(a.top, b.top),
    bottom: Math.max(a.bottom, b.bottom),
  };
}

export function worldToScreen(
  camera: CameraState,
  viewport: ViewportSize,
  world: Point,
): Point {
  return {
    x: viewport.width / 2 + (world.x - camera.centerX) * camera.scale,
    y: viewport.height / 2 + (world.y - camera.centerY) * camera.scale,
  };
}

export function screenToWorld(
  camera: CameraState,
  viewport: ViewportSize,
  screen: Point,
): Point {
  return {
    x: camera.centerX + (screen.x - viewport.width / 2) / camera.scale,
    y: camera.centerY + (screen.y - viewport.height / 2) / camera.scale,
  };
}

export function clampScale(scale: number): number {
  if (!Number.isFinite(scale) || scale <= 0) return MIN_CAMERA_SCALE;
  return Math.min(MAX_CAMERA_SCALE, Math.max(MIN_CAMERA_SCALE, scale));
}

/**
 * Fit bounds into the viewport with fractional padding (0–1 of min dimension).
 */
export function fitBounds(
  bounds: Bounds,
  viewport: ViewportSize,
  padding: number,
): CameraState {
  const worldW = Math.max(bounds.right - bounds.left, 1e-9);
  const worldH = Math.max(bounds.bottom - bounds.top, 1e-9);
  const pad = Math.max(0, Math.min(0.45, padding));
  const availW = viewport.width * (1 - 2 * pad);
  const availH = viewport.height * (1 - 2 * pad);
  const scaleX = availW / worldW;
  const scaleY = availH / worldH;
  const scale = clampScale(Math.min(scaleX, scaleY));
  return {
    centerX: (bounds.left + bounds.right) / 2,
    centerY: (bounds.top + bounds.bottom) / 2,
    scale,
  };
}

/**
 * Zoom around a screen point, preserving the world point under that pointer.
 */
export function zoomAtScreenPoint(
  camera: CameraState,
  viewport: ViewportSize,
  screenPoint: Point,
  zoomFactor: number,
): CameraState {
  const world = screenToWorld(camera, viewport, screenPoint);
  const nextScale = clampScale(camera.scale * zoomFactor);
  // Keep world under screenPoint:
  // screenX = vw/2 + (worldX - centerX) * scale
  // centerX = worldX - (screenX - vw/2) / scale
  return {
    centerX: world.x - (screenPoint.x - viewport.width / 2) / nextScale,
    centerY: world.y - (screenPoint.y - viewport.height / 2) / nextScale,
    scale: nextScale,
  };
}

export function zoomAboutCenter(
  camera: CameraState,
  zoomFactor: number,
): CameraState {
  return {
    centerX: camera.centerX,
    centerY: camera.centerY,
    scale: clampScale(camera.scale * zoomFactor),
  };
}

export function setScalePreserveCenter(
  camera: CameraState,
  scale: number,
): CameraState {
  return {
    centerX: camera.centerX,
    centerY: camera.centerY,
    scale: clampScale(scale),
  };
}

/**
 * Pan by screen-pixel deltas (CSS pixels). Positive dx moves content right
 * (camera center moves left in world space).
 */
export function panByScreenDelta(
  camera: CameraState,
  dx: number,
  dy: number,
): CameraState {
  return {
    centerX: camera.centerX - dx / camera.scale,
    centerY: camera.centerY - dy / camera.scale,
    scale: camera.scale,
  };
}

/**
 * CSS transform for world→screen: translate to viewport center, scale, then
 * offset by -center so world origin maps correctly.
 */
export function cameraCssTransform(
  camera: CameraState,
  viewport: ViewportSize,
): string {
  const tx = viewport.width / 2 - camera.centerX * camera.scale;
  const ty = viewport.height / 2 - camera.centerY * camera.scale;
  return `translate(${tx}px, ${ty}px) scale(${camera.scale})`;
}
