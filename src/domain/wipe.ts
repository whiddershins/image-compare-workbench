import type {
  CameraState,
  ComparisonState,
  ViewportSize,
  ViewMode,
  WipeAxis,
  WipeLock,
  Workspace,
} from './model';
import {
  DEFAULT_VIEW_MODE,
  DEFAULT_WIPE,
  DEFAULT_WIPE_AXIS,
  DEFAULT_WIPE_LOCK,
} from './model';
import { screenToWorld, worldToScreen } from './geometry';

export function clampWipePosition(position: number): number {
  if (!Number.isFinite(position)) return DEFAULT_WIPE;
  return Math.min(1, Math.max(0, position));
}

export function defaultComparison(): ComparisonState {
  return {
    kind: 'wipe',
    viewMode: DEFAULT_VIEW_MODE,
    axis: DEFAULT_WIPE_AXIS,
    lock: DEFAULT_WIPE_LOCK,
    position: DEFAULT_WIPE,
    worldX: 0,
    worldY: 0,
  };
}

/**
 * Sticky view mode. Does not alter wipe position, lock, camera, or selection.
 */
export function setViewMode(
  workspace: Workspace,
  viewMode: ViewMode,
): Workspace {
  if (workspace.comparison.viewMode === viewMode) return workspace;
  return {
    ...workspace,
    comparison: {
      ...workspace.comparison,
      viewMode,
    },
  };
}

/** Full control: wipe→a, a→b, b→a */
export function cycleFullView(mode: ViewMode): ViewMode {
  return mode === 'a' ? 'b' : 'a';
}

/** Label on the Full segment button */
export function fullButtonLabel(mode: ViewMode): string {
  return mode === 'b' ? 'Full B' : 'Full A';
}

/** Momentary hold shows the other solo side (wipe or full A → B; full B → A) */
export function tapTarget(mode: ViewMode): 'a' | 'b' {
  return mode === 'b' ? 'a' : 'b';
}

export function tapButtonLabel(mode: ViewMode): string {
  return tapTarget(mode) === 'a' ? 'A tap' : 'B tap';
}

/** What to draw: sticky mode, or opposite full while side-tap is held */
export function effectiveView(mode: ViewMode, tapping: boolean): ViewMode {
  return tapping ? tapTarget(mode) : mode;
}

export function fullButtonDescription(mode: ViewMode): string {
  if (mode === 'wipe') {
    return 'Show full A. Press again to switch to full B.';
  }
  if (mode === 'a') {
    return 'Full A (active). Press again for full B.';
  }
  return 'Full B (active). Press again for full A.';
}

export const WIPE_BUTTON_DESCRIPTION =
  'A/B wipe composite. Mutually exclusive with Full A/B.';

export function tapButtonDescription(mode: ViewMode): string {
  const t = tapTarget(mode);
  const back =
    mode === 'wipe' ? 'Wipe' : mode === 'a' ? 'Full A' : 'Full B';
  return `Hold to show full ${t.toUpperCase()}. Release returns to ${back}.`;
}

/**
 * Viewport-normalized wipe position used for clip-path and the divider.
 * World lock uses worldX (vertical axis) or worldY (horizontal axis).
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

  if (comparison.axis === 'horizontal') {
    const screen = worldToScreen(camera, viewport, {
      x: camera.centerX,
      y: comparison.worldY,
    });
    return clampWipePosition(screen.y / viewport.height);
  }

  const screen = worldToScreen(camera, viewport, {
    x: comparison.worldX,
    y: camera.centerY,
  });
  return clampWipePosition(screen.x / viewport.width);
}

/**
 * Set wipe from a viewport-normalized position (drag / keyboard).
 * Updates position and the world coord for the active axis.
 */
export function setWipeFromViewportPosition(
  workspace: Workspace,
  position: number,
  viewport: ViewportSize,
): Workspace {
  const clamped = clampWipePosition(position);
  let worldX = workspace.comparison.worldX;
  let worldY = workspace.comparison.worldY;
  const axis = workspace.comparison.axis;

  if (workspace.camera && viewport.width > 0 && viewport.height > 0) {
    if (axis === 'horizontal') {
      worldY = screenToWorld(workspace.camera, viewport, {
        x: viewport.width / 2,
        y: clamped * viewport.height,
      }).y;
    } else {
      worldX = screenToWorld(workspace.camera, viewport, {
        x: clamped * viewport.width,
        y: viewport.height / 2,
      }).x;
    }
  }

  return {
    ...workspace,
    comparison: {
      ...workspace.comparison,
      kind: 'wipe',
      position: clamped,
      worldX,
      worldY,
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
  let worldY = workspace.comparison.worldY;

  if (camera && viewport.width > 0 && viewport.height > 0) {
    const currentDisplay = displayWipePosition(
      workspace.comparison,
      camera,
      viewport,
    );
    position = currentDisplay;
    if (workspace.comparison.axis === 'horizontal') {
      worldY = screenToWorld(camera, viewport, {
        x: viewport.width / 2,
        y: currentDisplay * viewport.height,
      }).y;
    } else {
      worldX = screenToWorld(camera, viewport, {
        x: currentDisplay * viewport.width,
        y: viewport.height / 2,
      }).x;
    }
  }

  return {
    ...workspace,
    comparison: {
      ...workspace.comparison,
      kind: 'wipe',
      lock,
      position,
      worldX,
      worldY,
    },
  };
}

/**
 * Set wipe axis (vertical | horizontal). Preserves on-screen wipe fraction
 * and updates the world coord for the new axis.
 */
export function setWipeAxis(
  workspace: Workspace,
  axis: WipeAxis,
  viewport: ViewportSize,
): Workspace {
  if (workspace.comparison.axis === axis) return workspace;

  const camera = workspace.camera;
  let position = clampWipePosition(workspace.comparison.position);
  let worldX = workspace.comparison.worldX;
  let worldY = workspace.comparison.worldY;

  // Keep current on-screen fraction when flipping axis
  if (camera && viewport.width > 0 && viewport.height > 0) {
    position = displayWipePosition(
      workspace.comparison,
      camera,
      viewport,
    );
    if (axis === 'horizontal') {
      worldY = screenToWorld(camera, viewport, {
        x: viewport.width / 2,
        y: position * viewport.height,
      }).y;
    } else {
      worldX = screenToWorld(camera, viewport, {
        x: position * viewport.width,
        y: viewport.height / 2,
      }).x;
    }
  }

  return {
    ...workspace,
    comparison: {
      ...workspace.comparison,
      kind: 'wipe',
      axis,
      position,
      worldX,
      worldY,
    },
  };
}

export function wipeLockLabel(lock: WipeLock): string {
  return lock === 'world' ? 'Wipe: image' : 'Wipe: screen';
}

export function wipeLockDescription(lock: WipeLock): string {
  if (lock === 'world') {
    return 'Wipe stays on the same world/image position through pan and zoom (default).';
  }
  return 'Wipe stays fixed in the viewport; image content slides under it.';
}

export function wipeAxisLabel(axis: WipeAxis): string {
  return axis === 'vertical' ? 'V' : 'H';
}

export function wipeAxisDescription(axis: WipeAxis): string {
  if (axis === 'vertical') {
    return 'Vertical wipe: A left of the divider, B right. Position 0 = all B, 1 = all A.';
  }
  return 'Horizontal wipe: A above the divider, B below. Position 0 = all B, 1 = all A.';
}
