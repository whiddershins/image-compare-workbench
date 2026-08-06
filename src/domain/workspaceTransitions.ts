import {
  DEFAULT_SIZE_NORMALIZATION,
  type AssetId,
  type ImageAsset,
  type SelectionError,
  type Side,
  type SizeNormalization,
  type Workspace,
} from './model';
import { err, ok, type Result } from './result';
import { sortAssets } from './sorting';
import { defaultComparison } from './wipe';

export function emptyWorkspace(): Workspace {
  return {
    imageSet: { assets: [] },
    selection: { a: null, b: null, activeSide: 'b' },
    camera: null,
    comparison: defaultComparison(),
    sizeNormalization: DEFAULT_SIZE_NORMALIZATION,
  };
}

export function isEmpty(workspace: Workspace): boolean {
  return workspace.imageSet.assets.length === 0;
}

function assetExists(workspace: Workspace, id: AssetId): boolean {
  return workspace.imageSet.assets.some((a) => a.id === id);
}

/**
 * Append newly decoded assets, sort the full set.
 * Does not change selection, camera, or wipe when the workspace was nonempty.
 * When previously empty, applies initial selection (camera left null for shell to fit).
 */
export function appendAssets(
  workspace: Workspace,
  newAssets: readonly ImageAsset[],
): Workspace {
  if (newAssets.length === 0) return workspace;

  const wasEmpty = isEmpty(workspace);
  const merged = sortAssets([...workspace.imageSet.assets, ...newAssets]);
  const next: Workspace = {
    ...workspace,
    imageSet: { assets: merged },
  };

  if (!wasEmpty) {
    return next;
  }

  const first = merged[0]!;
  const second = merged[1] ?? first;
  return {
    ...next,
    selection: {
      a: first.id,
      b: second.id,
      activeSide: 'b',
    },
    camera: null,
    comparison: defaultComparison(),
  };
}

export function clearWorkspace(): Workspace {
  return emptyWorkspace();
}

export function selectAsset(
  workspace: Workspace,
  side: Side,
  assetId: AssetId,
): Result<Workspace, SelectionError> {
  if (workspace.imageSet.assets.length === 0) {
    return err({ kind: 'empty-set' });
  }
  if (!assetExists(workspace, assetId)) {
    return err({ kind: 'unknown-asset', assetId });
  }
  return ok({
    ...workspace,
    selection: {
      ...workspace.selection,
      [side]: assetId,
      activeSide: side,
    },
  });
}

export function setActiveSide(workspace: Workspace, side: Side): Workspace {
  return {
    ...workspace,
    selection: {
      ...workspace.selection,
      activeSide: side,
    },
  };
}

export function cycleSelection(
  workspace: Workspace,
  side: Side,
  delta: number,
): Workspace {
  const assets = workspace.imageSet.assets;
  if (assets.length === 0) return workspace;

  const currentId = workspace.selection[side];
  let index = currentId
    ? assets.findIndex((a) => a.id === currentId)
    : -1;
  if (index < 0) index = 0;

  const len = assets.length;
  const nextIndex = ((index + delta) % len + len) % len;
  const nextId = assets[nextIndex]!.id;

  return {
    ...workspace,
    selection: {
      ...workspace.selection,
      [side]: nextId,
      activeSide: side,
    },
  };
}

export function swapSelections(workspace: Workspace): Workspace {
  return {
    ...workspace,
    selection: {
      a: workspace.selection.b,
      b: workspace.selection.a,
      activeSide: workspace.selection.activeSide,
    },
  };
}

/**
 * Set wipe by viewport fraction without camera context.
 * Prefer setWipeFromViewportPosition when viewport+camera are available
 * so worldX stays in sync.
 */
export function setWipePosition(
  workspace: Workspace,
  position: number,
): Workspace {
  const clamped = Math.min(1, Math.max(0, position));
  return {
    ...workspace,
    comparison: {
      ...workspace.comparison,
      kind: 'wipe',
      position: clamped,
    },
  };
}

/**
 * Change size normalization. Does not modify camera, wipe, or selection.
 * Callers may optionally run Fit afterward.
 */
export function setSizeNormalization(
  workspace: Workspace,
  next: SizeNormalization,
): Workspace {
  if (
    workspace.sizeNormalization.basis === next.basis &&
    workspace.sizeNormalization.reference === next.reference
  ) {
    return workspace;
  }
  return {
    ...workspace,
    sizeNormalization: next,
  };
}

export function getAsset(
  workspace: Workspace,
  id: AssetId | null,
): ImageAsset | null {
  if (!id) return null;
  return workspace.imageSet.assets.find((a) => a.id === id) ?? null;
}
