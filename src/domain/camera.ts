import {
  DEFAULT_WIPE,
  FIT_PADDING,
  type Bounds,
  type CameraState,
  type ImageAsset,
  type ViewportSize,
  type Workspace,
} from './model';
import {
  fitBounds,
  imageBounds,
  setScalePreserveCenter,
  unionBounds,
  zoomAboutCenter,
  zoomAtScreenPoint,
  panByScreenDelta,
} from './geometry';
import type { Point } from './model';

export function selectedPairBounds(workspace: Workspace): Bounds | null {
  const { a, b } = workspace.selection;
  const assets = workspace.imageSet.assets;
  const assetA = a ? assets.find((x) => x.id === a) : undefined;
  const assetB = b ? assets.find((x) => x.id === b) : undefined;
  if (!assetA && !assetB) return null;
  if (assetA && !assetB) return imageBounds(assetA.width, assetA.height);
  if (!assetA && assetB) return imageBounds(assetB.width, assetB.height);
  return unionBounds(
    imageBounds(assetA!.width, assetA!.height),
    imageBounds(assetB!.width, assetB!.height),
  );
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

export function panWorkspace(
  workspace: Workspace,
  dx: number,
  dy: number,
): Workspace {
  if (!workspace.camera) return workspace;
  return {
    ...workspace,
    camera: panByScreenDelta(workspace.camera, dx, dy),
  };
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
