import type {
  CameraState,
  ComparisonState,
  ViewportSize,
  WipeLock,
  Workspace,
} from './model';
import { DEFAULT_WIPE, DEFAULT_WIPE_LOCK } from './model';
import { screenToWorld, worldToScreen } from './geometry';

export function clampWipePosition(position: number): number {
  if (!Number.isFinite(position)) return DEFAULT_WIPE;
  return Math.min(1, Math.max(0, position));
}

export function defaultComparison(): ComparisonState {
  return {
    kind: 'wipe',
    lock: DEFAULT_WIPE_LOCK,
    position: DEFAULT_WIPE,
    worldX: 0,
  };
}

/**
 * Viewport-normalized wipe position used for clip-path and the divider.
 * When lock is 'world', derived from camera so the line tracks a fixed world X.
 * When lock is 'viewport', uses stored position (screen-fixed through zoom/pan).
 */
export function displayWipePosition(
  comparison: ComparisonState,
  camera: CameraState | null,
  viewport: ViewportSize,
): number {
  if (
    comparison.lock === 'viewport' ||
    !camera ||
    viewport.width <= 0 ||
    viewport.height <= 0
  ) {
    return clampWipePosition(comparison.position);
  }

  const screen = worldToScreen(camera, viewport, {
    x: comparison.worldX,
    y: camera.centerY,
  });
  return clampWipePosition(screen.x / viewport.width);
}

/**
 * Set wipe from a viewport-normalized position (drag / keyboard).
 * Always updates both position and worldX so lock mode can switch without a jump.
 */
export function setWipeFromViewportPosition(
  workspace: Workspace,
  position: number,
  viewport: ViewportSize,
): Workspace {
  const clamped = clampWipePosition(position);
  let worldX = workspace.comparison.worldX;

  if (workspace.camera && viewport.width > 0 && viewport.height > 0) {
    worldX = screenToWorld(workspace.camera, viewport, {
      x: clamped * viewport.width,
      y: viewport.height / 2,
    }).x;
  }

  return {
    ...workspace,
    comparison: {
      kind: 'wipe',
      lock: workspace.comparison.lock,
      position: clamped,
      worldX,
    },
  };
}

/**
 * Toggle or set wipe lock. Preserves the current on-screen wipe location.
 */
export function setWipeLock(
  workspace: Workspace,
  lock: WipeLock,
  viewport: ViewportSize,
): Workspace {
  if (workspace.comparison.lock === lock) return workspace;

  const camera = workspace.camera;
  let position = clampWipePosition(workspace.comparison.position);
  let worldX = workspace.comparison.worldX;

  if (camera && viewport.width > 0 && viewport.height > 0) {
    // Current visual location in the mode we're leaving
    const currentDisplay = displayWipePosition(
      workspace.comparison,
      camera,
      viewport,
    );
    position = currentDisplay;
    worldX = screenToWorld(camera, viewport, {
      x: currentDisplay * viewport.width,
      y: viewport.height / 2,
    }).x;
  }

  return {
    ...workspace,
    comparison: {
      kind: 'wipe',
      lock,
      position,
      worldX,
    },
  };
}

export function wipeLockLabel(lock: WipeLock): string {
  return lock === 'world' ? 'Wipe: image' : 'Wipe: screen';
}

export function wipeLockDescription(lock: WipeLock): string {
  if (lock === 'world') {
    return 'Wipe stays on the same world/image X through pan and zoom (default).';
  }
  return 'Wipe stays fixed in the viewport; image content slides under it.';
}
