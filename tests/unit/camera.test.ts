import { describe, expect, it } from 'vitest';
import {
  fitBounds,
  panByScreenDelta,
  screenToWorld,
  setScalePreserveCenter,
  worldToScreen,
  zoomAtScreenPoint,
  imageBounds,
  unionBounds,
} from '../../src/domain/geometry';
import {
  fitCurrentPair,
  panWorkspace,
  setCamera100Percent,
  zoomWorkspaceAtPoint,
} from '../../src/domain/camera';
import type {
  WipeAxis,
  WipeBehavior,
  Workspace,
} from '../../src/domain/model';
import {
  displayWipePosition,
  setWipeFromViewportPosition,
} from '../../src/domain/wipe';
import { appendAssets, emptyWorkspace } from '../../src/domain/workspaceTransitions';

const viewport = { width: 200, height: 100 };

describe('camera geometry', () => {
  const camera = { centerX: 0, centerY: 0, scale: 2 };

  it('world-to-screen and screen-to-world round-trip', () => {
    const world = { x: 10, y: -5 };
    const screen = worldToScreen(camera, viewport, world);
    const back = screenToWorld(camera, viewport, screen);
    expect(back.x).toBeCloseTo(world.x);
    expect(back.y).toBeCloseTo(world.y);
  });

  it('fit contains both selected image bounds', () => {
    const b = unionBounds(imageBounds(100, 50), imageBounds(200, 100));
    const fitted = fitBounds(b, { width: 400, height: 300 }, 0.08);
    // Scale should fit the larger image
    expect(fitted.scale).toBeGreaterThan(0);
    expect(fitted.centerX).toBeCloseTo(0);
    expect(fitted.centerY).toBeCloseTo(0);
    // World width 200 at scale should fit with padding
    const screenW = 200 * fitted.scale;
    expect(screenW).toBeLessThanOrEqual(400);
  });

  it('100% sets scale to 1 preserving center', () => {
    const cam = { centerX: 12, centerY: -3, scale: 4 };
    const next = setScalePreserveCenter(cam, 1);
    expect(next.scale).toBe(1);
    expect(next.centerX).toBe(12);
    expect(next.centerY).toBe(-3);
  });

  it('pointer-centered zoom preserves world under pointer', () => {
    const screen = { x: 50, y: 40 };
    const worldBefore = screenToWorld(camera, viewport, screen);
    const zoomed = zoomAtScreenPoint(camera, viewport, screen, 2);
    const worldAfter = screenToWorld(zoomed, viewport, screen);
    expect(worldAfter.x).toBeCloseTo(worldBefore.x);
    expect(worldAfter.y).toBeCloseTo(worldBefore.y);
  });

  it('pan uses world-coordinate units correctly', () => {
    // Pan screen +20 px right → camera center moves left by 20/scale
    const next = panByScreenDelta(camera, 20, 0);
    expect(next.centerX).toBeCloseTo(camera.centerX - 20 / camera.scale);
    expect(next.scale).toBe(camera.scale);
  });

  it.each([
    {
      axis: 'vertical',
      dx: 20,
      dy: 7,
      worldKey: 'worldX',
      inactiveKey: 'worldY',
      axisDelta: 20,
    },
    {
      axis: 'horizontal',
      dx: 7,
      dy: 20,
      worldKey: 'worldY',
      inactiveKey: 'worldX',
      axisDelta: 20,
    },
  ] as const)(
    'hybrid $axis pan keeps the divider screen-fixed and reanchors $worldKey',
    ({ axis, dx, dy, worldKey, inactiveKey, axisDelta }) => {
      const workspace = workspaceWithWipe('hybrid', axis, 0.65);
      const displayBefore = displayWipePosition(
        workspace.comparison,
        workspace.camera,
        viewport,
      );
      const worldBefore = workspace.comparison[worldKey];
      const inactiveBefore = workspace.comparison[inactiveKey];

      const next = panWorkspace(workspace, viewport, dx, dy);

      expect(
        displayWipePosition(next.comparison, next.camera, viewport),
      ).toBeCloseTo(displayBefore);
      expect(next.comparison[worldKey]).toBeCloseTo(
        worldBefore - axisDelta / workspace.camera!.scale,
      );
      expect(next.comparison[inactiveKey]).toBe(inactiveBefore);
    },
  );

  it('image-locked pan keeps the world anchor and moves the divider on screen', () => {
    const workspace = workspaceWithWipe('world', 'vertical', 0.65);
    const displayBefore = displayWipePosition(
      workspace.comparison,
      workspace.camera,
      viewport,
    );
    const worldBefore = workspace.comparison.worldX;

    const next = panWorkspace(workspace, viewport, 20, 0);

    expect(next.comparison.worldX).toBe(worldBefore);
    expect(
      displayWipePosition(next.comparison, next.camera, viewport),
    ).not.toBeCloseTo(displayBefore);
  });

  it('screen-locked pan keeps the divider screen-fixed without reanchoring it', () => {
    const workspace = workspaceWithWipe('viewport', 'vertical', 0.65);
    const comparisonBefore = workspace.comparison;

    const next = panWorkspace(workspace, viewport, 20, 0);

    expect(next.comparison).toBe(comparisonBefore);
    expect(
      displayWipePosition(next.comparison, next.camera, viewport),
    ).toBeCloseTo(0.65);
  });

  it.each([
    { behavior: 'hybrid', axis: 'vertical', worldKey: 'worldX' },
    { behavior: 'hybrid', axis: 'horizontal', worldKey: 'worldY' },
    { behavior: 'world', axis: 'vertical', worldKey: 'worldX' },
    { behavior: 'world', axis: 'horizontal', worldKey: 'worldY' },
  ] as const)(
    '$behavior $axis zoom preserves pointer intent and the world anchor',
    ({ behavior, axis, worldKey }) => {
      const workspace = workspaceWithWipe(behavior, axis, 0.65);
      const pointer = { x: 40, y: 25 };
      const pointerWorldBefore = screenToWorld(
        workspace.camera!,
        viewport,
        pointer,
      );
      const expectedCamera = zoomAtScreenPoint(
        workspace.camera!,
        viewport,
        pointer,
        2,
      );
      const worldBefore = workspace.comparison[worldKey];

      const next = zoomWorkspaceAtPoint(workspace, viewport, pointer, 2);
      const pointerWorldAfter = screenToWorld(next.camera!, viewport, pointer);

      expect(next.camera).toEqual(expectedCamera);
      expect(pointerWorldAfter.x).toBeCloseTo(pointerWorldBefore.x);
      expect(pointerWorldAfter.y).toBeCloseTo(pointerWorldBefore.y);
      expect(next.comparison[worldKey]).toBe(worldBefore);
      expect(
        displayWipePosition(next.comparison, next.camera, viewport),
      ).not.toBeCloseTo(0.65);
    },
  );

  it('screen-locked zoom preserves native pointer-centered camera intent and screen position', () => {
    const workspace = workspaceWithWipe('viewport', 'vertical', 0.65);
    const pointer = { x: 40, y: 25 };
    const expectedCamera = zoomAtScreenPoint(
      workspace.camera!,
      viewport,
      pointer,
      2,
    );

    const next = zoomWorkspaceAtPoint(workspace, viewport, pointer, 2);

    expect(next.camera).toEqual(expectedCamera);
    expect(next.comparison).toBe(workspace.comparison);
    expect(
      displayWipePosition(next.comparison, next.camera, viewport),
    ).toBeCloseTo(0.65);
  });

  it('setCamera100Percent on workspace', () => {
    let w: Workspace = appendAssets(emptyWorkspace(), [
      {
        id: '1',
        name: 'a.png',
        relativePath: 'a.png',
        mediaType: 'image/png',
        byteSize: 1,
        lastModified: 0,
        width: 100,
        height: 100,
        importOrdinal: 0,
      },
    ]);
    w = { ...w, camera: { centerX: 0, centerY: 0, scale: 2.5 } };
    const next = setCamera100Percent(w);
    expect(next.camera?.scale).toBe(1);
    expect(next.comparison).toBe(w.comparison);
  });

  it('fitCurrentPair does not alter wipe', () => {
    let w: Workspace = appendAssets(emptyWorkspace(), [
      {
        id: '1',
        name: 'a.png',
        relativePath: 'a.png',
        mediaType: 'image/png',
        byteSize: 1,
        lastModified: 0,
        width: 100,
        height: 50,
        importOrdinal: 0,
      },
      {
        id: '2',
        name: 'b.png',
        relativePath: 'b.png',
        mediaType: 'image/png',
        byteSize: 1,
        lastModified: 0,
        width: 200,
        height: 100,
        importOrdinal: 1,
      },
    ]);
    w = setWipePositionPreserve(w, 0.25);
    const fitted = fitCurrentPair(w, { width: 800, height: 600 });
    expect(fitted.comparison.position).toBe(0.25);
    expect(fitted.camera).not.toBeNull();
  });
});

function setWipePositionPreserve(w: Workspace, position: number): Workspace {
  return {
    ...w,
    comparison: {
      kind: 'wipe',
      presentation: 'wipe',
      focus: 'a',
      axis: 'vertical',
      behavior: 'world',
      position,
      worldX: 0,
      worldY: 0,
    },
  };
}

function workspaceWithWipe(
  behavior: WipeBehavior,
  axis: WipeAxis,
  position: number,
): Workspace {
  const workspace: Workspace = {
    ...emptyWorkspace(),
    camera: { centerX: 0, centerY: 0, scale: 2.5 },
    comparison: {
      ...emptyWorkspace().comparison,
      axis,
      behavior,
    },
  };
  return setWipeFromViewportPosition(workspace, position, viewport);
}
