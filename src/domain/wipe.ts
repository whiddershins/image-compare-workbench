import type {
  CameraState,
  ComparisonState,
  DrawnView,
  ViewportSize,
  ViewFocus,
  ViewPresentation,
  WipeAxis,
  WipeLock,
  Workspace,
} from './model';
import {
  DEFAULT_VIEW_FOCUS,
  DEFAULT_VIEW_PRESENTATION,
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
    presentation: DEFAULT_VIEW_PRESENTATION,
    focus: DEFAULT_VIEW_FOCUS,
    axis: DEFAULT_WIPE_AXIS,
    lock: DEFAULT_WIPE_LOCK,
    position: DEFAULT_WIPE,
    worldX: 0,
    worldY: 0,
  };
}

// ── View state machine (presentation ⟂ focus) ──────────────────────────

/** Solo side shown when presentation is full. */
export function stickySolo(c: ComparisonState): DrawnView {
  return c.presentation === 'wipe' ? 'wipe' : c.focus;
}

/**
 * Side-tap hold shows the opposite of focus (independent of wipe/full).
 * focus a → B tap; focus b → A tap.
 */
export function tapTarget(focus: ViewFocus): ViewFocus {
  return focus === 'b' ? 'a' : 'b';
}

/** What to draw: sticky view, or opposite focus while side-tapping. */
export function effectiveView(
  c: ComparisonState,
  tapping: boolean,
): DrawnView {
  return tapping ? tapTarget(c.focus) : stickySolo(c);
}

/** Full control: enter full if on wipe; if already full, flip focus a↔b. */
export function cycleFull(c: ComparisonState): ComparisonState {
  if (c.presentation === 'wipe') {
    return { ...c, presentation: 'full' }; // focus unchanged
  }
  return {
    ...c,
    presentation: 'full',
    focus: c.focus === 'a' ? 'b' : 'a',
  };
}

/** Wipe control: presentation only — never touches focus (or side-tap labels). */
export function setWipePresentation(c: ComparisonState): ComparisonState {
  if (c.presentation === 'wipe') return c;
  return { ...c, presentation: 'wipe' };
}

export function setPresentation(
  workspace: Workspace,
  presentation: ViewPresentation,
): Workspace {
  if (workspace.comparison.presentation === presentation) return workspace;
  return {
    ...workspace,
    comparison: {
      ...workspace.comparison,
      presentation,
      // never rewrite focus here
    },
  };
}

export function applyCycleFull(workspace: Workspace): Workspace {
  return {
    ...workspace,
    comparison: cycleFull(workspace.comparison),
  };
}

export function applyWipePresentation(workspace: Workspace): Workspace {
  return {
    ...workspace,
    comparison: setWipePresentation(workspace.comparison),
  };
}

export function fullButtonLabel(focus: ViewFocus): string {
  return focus === 'b' ? 'Full B' : 'Full A';
}

export function tapButtonLabel(focus: ViewFocus): string {
  return tapTarget(focus) === 'a' ? 'A tap' : 'B tap';
}

export function fullButtonDescription(c: ComparisonState): string {
  if (c.presentation === 'wipe') {
    return `Show full ${c.focus.toUpperCase()} (focus). Press again to flip A/B.`;
  }
  return c.focus === 'a'
    ? 'Full A (active). Press again for full B.'
    : 'Full B (active). Press again for full A.';
}

export const WIPE_BUTTON_DESCRIPTION =
  'A/B wipe composite. Does not change Full A/B focus or side-tap.';

export function tapButtonDescription(focus: ViewFocus): string {
  const t = tapTarget(focus);
  return `Hold to show full ${t.toUpperCase()}. Release restores Wipe or Full ${focus.toUpperCase()}.`;
}

// ── Wipe geometry ──────────────────────────────────────────────────────

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
