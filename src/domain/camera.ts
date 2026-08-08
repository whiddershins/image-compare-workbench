import {
  DEFAULT_WIPE,
  FIT_PADDING,
  type Bounds,
  type CameraState,
  type ViewportSize,
  type Workspace,
} from './model';
import {
  fitBounds,
  setScalePreserveCenter,
  unionBounds,
  zoomAboutCenter,
  zoomAtScreenPoint,
  panByScreenDelta,
} from './geometry';
import type { Point } from './model';
import {
  assetWorldScaleInWorkspace,
  placedBounds,
} from './sizeNormalization';
import { getAsset } from './workspaceTransitions';
import {
  displayWipePosition,
  setWipeFromViewportPosition,
} from './wipe';

/**
 * Union of selected A/B world bounds after size normalization.
 */
export function selectedPairBounds(workspace: Workspace): Bounds | null {
  const assetA = getAsset(workspace, workspace.selection.a);
  const assetB = getAsset(workspace, workspace.selection.b);
  if (!assetA && !assetB) return null;

  const boundsList: Bounds[] = [];
  if (assetA) {
    boundsList.push(
      placedBounds(assetA, assetWorldScaleInWorkspace(workspace, assetA)),
    );
  }
  if (assetB) {
    boundsList.push(
      placedBounds(assetB, assetWorldScaleInWorkspace(workspace, assetB)),
    );
  }
  if (boundsList.length === 1) return boundsList[0]!;
  return unionBounds(boundsList[0]!, boundsList[1]!);
}

export function fitCurrentPair(
  workspace: Workspace,
  viewport: ViewportSize,
  padding: number = FIT_PADDING,
): Workspace {
  const bounds = selectedPairBounds(workspace);
  if (!bounds || viewport.width <= 0 || viewport.height <= 0) {
    return workspace;
  }
  return {
    ...workspace,
    camera: fitBounds(bounds, viewport, padding),
  };
}

export function setCamera100Percent(workspace: Workspace): Workspace {
  if (!workspace.camera) return workspace;
  return {
    ...workspace,
    camera: setScalePreserveCenter(workspace.camera, 1),
  };
}

export function zoomWorkspaceAtPoint(
  workspace: Workspace,
  viewport: ViewportSize,
  screenPoint: Point,
  zoomFactor: number,
): Workspace {
  if (!workspace.camera) return workspace;
  return {
    ...workspace,
    camera: zoomAtScreenPoint(
      workspace.camera,
      viewport,
      screenPoint,
      zoomFactor,
    ),
  };
}

export function zoomWorkspaceCenter(
  workspace: Workspace,
  zoomFactor: number,
): Workspace {
  if (!workspace.camera) return workspace;
  return {
    ...workspace,
    camera: zoomAboutCenter(workspace.camera, zoomFactor),
  };
}

/**
 * How pan interacts with hybrid wipe behavior.
 * - drag: pointer click-hold / Space+drag — images slide under a fixed divider
 * - wheel: two-finger trackpad / mouse wheel pan — camera + wipe move as one world
 * Other wipe behaviors ignore this (world/viewport rules apply uniformly).
 */
export type PanSource = 'drag' | 'wheel';

export function panWorkspace(
  workspace: Workspace,
  viewport: ViewportSize,
  dx: number,
  dy: number,
  source: PanSource = 'drag',
): Workspace {
  if (!workspace.camera) return workspace;
  const wipeBeforePan = displayWipePosition(
    workspace.comparison,
    workspace.camera,
    viewport,
  );
  const next = {
    ...workspace,
    camera: panByScreenDelta(workspace.camera, dx, dy),
  };

  // Hybrid drag only: screen-fixed wipe (re-anchor world under fixed divider).
  // Hybrid wheel: world-locked — wipe rides with the image (no re-anchor).
  // Zoom never calls this path, so pointer-centered zoom stays image-attached.
  if (workspace.comparison.behavior !== 'hybrid' || source !== 'drag') {
    return next;
  }

  return setWipeFromViewportPosition(next, wipeBeforePan, viewport);
}

export function withCamera(
  workspace: Workspace,
  camera: CameraState | null,
): Workspace {
  return { ...workspace, camera };
}

export function zoomPercent(camera: CameraState | null): number {
  if (!camera) return 100;
  return Math.round(camera.scale * 100);
}

export { DEFAULT_WIPE, FIT_PADDING };
