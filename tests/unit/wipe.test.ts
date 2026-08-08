import { describe, expect, it } from 'vitest';
import type { ComparisonState, Workspace } from '../../src/domain/model';
import {
  applyCycleFull,
  applyWipePresentation,
  cycleFull,
  displayWipePosition,
  effectiveView,
  fullButtonLabel,
  setWipeFromViewportPosition,
  setWipeBehavior,
  setWipeAxis,
  stickySolo,
  tapButtonLabel,
  tapTarget,
  defaultComparison,
} from '../../src/domain/wipe';
import { emptyWorkspace } from '../../src/domain/workspaceTransitions';
import { zoomAtScreenPoint } from '../../src/domain/geometry';

function workspaceWithCamera(): Workspace {
  return {
    ...emptyWorkspace(),
    camera: { centerX: 0, centerY: 0, scale: 1 },
    comparison: {
      kind: 'wipe',
      presentation: 'wipe',
      focus: 'a',
      axis: 'vertical',
      behavior: 'world',
      position: 0.5,
      worldX: 0,
      worldY: 0,
    },
  };
}

const viewport = { width: 200, height: 100 };

function cmp(
  partial: Partial<ComparisonState> = {},
): ComparisonState {
  return { ...defaultComparison(), ...partial };
}

describe('view state machine (presentation ⟂ focus)', () => {
  it('defaults to wipe + focus a (B tap)', () => {
    const c = defaultComparison();
    expect(c.presentation).toBe('wipe');
    expect(c.focus).toBe('a');
    expect(tapTarget(c.focus)).toBe('b');
    expect(tapButtonLabel(c.focus)).toBe('B tap');
    expect(fullButtonLabel(c.focus)).toBe('Full A');
  });

  it('tapTarget depends only on focus, not presentation', () => {
    expect(tapTarget('a')).toBe('b');
    expect(tapTarget('b')).toBe('a');
    expect(effectiveView(cmp({ presentation: 'wipe', focus: 'a' }), true)).toBe(
      'b',
    );
    expect(effectiveView(cmp({ presentation: 'full', focus: 'a' }), true)).toBe(
      'b',
    );
    expect(effectiveView(cmp({ presentation: 'wipe', focus: 'b' }), true)).toBe(
      'a',
    );
    expect(effectiveView(cmp({ presentation: 'full', focus: 'b' }), true)).toBe(
      'a',
    );
  });

  it('cycleFull: wipe→full keeps focus; full flips focus', () => {
    expect(cycleFull(cmp({ presentation: 'wipe', focus: 'a' }))).toMatchObject({
      presentation: 'full',
      focus: 'a',
    });
    expect(cycleFull(cmp({ presentation: 'wipe', focus: 'b' }))).toMatchObject({
      presentation: 'full',
      focus: 'b',
    });
    expect(cycleFull(cmp({ presentation: 'full', focus: 'a' }))).toMatchObject({
      presentation: 'full',
      focus: 'b',
    });
    expect(cycleFull(cmp({ presentation: 'full', focus: 'b' }))).toMatchObject({
      presentation: 'full',
      focus: 'a',
    });
  });

  it('set wipe presentation does not change focus (side-tap stays put)', () => {
    let w = workspaceWithCamera();
    w = applyCycleFull(w); // full A
    w = applyCycleFull(w); // full B, focus b
    expect(w.comparison.focus).toBe('b');
    expect(tapButtonLabel(w.comparison.focus)).toBe('A tap');

    w = applyWipePresentation(w);
    expect(w.comparison.presentation).toBe('wipe');
    expect(w.comparison.focus).toBe('b');
    expect(tapButtonLabel(w.comparison.focus)).toBe('A tap');
    expect(stickySolo(w.comparison)).toBe('wipe');
    expect(effectiveView(w.comparison, true)).toBe('a');
  });

  it('stickySolo and effectiveView', () => {
    expect(stickySolo(cmp({ presentation: 'wipe', focus: 'b' }))).toBe('wipe');
    expect(stickySolo(cmp({ presentation: 'full', focus: 'b' }))).toBe('b');
    expect(effectiveView(cmp({ presentation: 'full', focus: 'a' }), false)).toBe(
      'a',
    );
  });

  it('presentation transitions preserve non-default camera and wipe geometry', () => {
    let w = workspaceWithCamera();
    w = {
      ...w,
      camera: { centerX: 42, centerY: -17, scale: 2.5 },
      comparison: {
        ...w.comparison,
        behavior: 'world',
        position: 0.33,
        worldX: 12,
        worldY: -4,
        axis: 'horizontal',
      },
    };
    const cameraBefore = w.camera;
    const wipeGeom = {
      behavior: w.comparison.behavior,
      position: w.comparison.position,
      worldX: w.comparison.worldX,
      worldY: w.comparison.worldY,
      axis: w.comparison.axis,
    };

    w = applyCycleFull(w); // wipe → full A
    expect(w.camera).toEqual(cameraBefore);
    expect(w.comparison).toMatchObject(wipeGeom);
    expect(w.comparison.presentation).toBe('full');
    expect(w.comparison.focus).toBe('a');

    w = applyCycleFull(w); // full A → full B
    expect(w.camera).toEqual(cameraBefore);
    expect(w.comparison).toMatchObject(wipeGeom);
    expect(w.comparison.focus).toBe('b');

    w = applyWipePresentation(w); // full B → wipe, focus stays b
    expect(w.camera).toEqual(cameraBefore);
    expect(w.comparison).toMatchObject(wipeGeom);
    expect(w.comparison.presentation).toBe('wipe');
    expect(w.comparison.focus).toBe('b');
  });
});

describe('wipe navigation behavior', () => {
  it('defaults to vertical hybrid behavior at center and wipe view mode', () => {
    const c = defaultComparison();
    expect(c.behavior).toBe('hybrid');
    expect(c.axis).toBe('vertical');
    expect(c.presentation).toBe('wipe');
    expect(c.position).toBe(0.5);
    expect(c.worldX).toBe(0);
    expect(c.worldY).toBe(0);
  });

  it('hybrid derives display from its world anchor during zoom', () => {
    let w = workspaceWithCamera();
    w = setWipeFromViewportPosition(w, 0.6, viewport);
    w = setWipeBehavior(w, 'hybrid', viewport);
    const worldBefore = w.comparison.worldX;

    const zoomedCam = zoomAtScreenPoint(
      w.camera!,
      viewport,
      { x: 40, y: 25 },
      2,
    );
    w = { ...w, camera: zoomedCam };

    expect(w.comparison.worldX).toBe(worldBefore);
    expect(displayWipePosition(w.comparison, w.camera, viewport)).not.toBeCloseTo(
      0.6,
    );
  });

  it('image-locked zoom preserves worldX; display position changes', () => {
    let w = workspaceWithCamera();
    w = setWipeFromViewportPosition(w, 0.6, viewport);
    expect(w.comparison.worldX).toBeCloseTo(20);

    const beforeDisplay = displayWipePosition(
      w.comparison,
      w.camera,
      viewport,
    );
    expect(beforeDisplay).toBeCloseTo(0.6);

    const zoomedCam = zoomAtScreenPoint(
      w.camera!,
      viewport,
      { x: 100, y: 50 },
      2,
    );
    w = { ...w, camera: zoomedCam };

    expect(w.comparison.worldX).toBeCloseTo(20);
    const afterDisplay = displayWipePosition(
      w.comparison,
      w.camera,
      viewport,
    );
    expect(afterDisplay).toBeCloseTo(0.7);
    expect(afterDisplay).not.toBeCloseTo(beforeDisplay);
  });

  it('screen-locked zoom preserves display position', () => {
    let w = workspaceWithCamera();
    w = setWipeFromViewportPosition(w, 0.6, viewport);
    w = setWipeBehavior(w, 'viewport', viewport);
    expect(w.comparison.behavior).toBe('viewport');
    expect(w.comparison.position).toBeCloseTo(0.6);

    const zoomedCam = zoomAtScreenPoint(
      w.camera!,
      viewport,
      { x: 100, y: 50 },
      2,
    );
    w = { ...w, camera: zoomedCam };

    const display = displayWipePosition(w.comparison, w.camera, viewport);
    expect(display).toBeCloseTo(0.6);
  });

  it('switching among all behaviors preserves the on-screen wipe', () => {
    let w = workspaceWithCamera();
    w = setWipeFromViewportPosition(w, 0.25, viewport);
    const before = displayWipePosition(w.comparison, w.camera, viewport);

    w = setWipeBehavior(w, 'hybrid', viewport);
    expect(displayWipePosition(w.comparison, w.camera, viewport)).toBeCloseTo(
      before,
    );

    w = setWipeBehavior(w, 'viewport', viewport);
    expect(displayWipePosition(w.comparison, w.camera, viewport)).toBeCloseTo(
      before,
    );

    w = setWipeBehavior(w, 'world', viewport);
    expect(displayWipePosition(w.comparison, w.camera, viewport)).toBeCloseTo(
      before,
    );
  });

  it('setWipeFromViewportPosition clamps', () => {
    let w = workspaceWithCamera();
    w = setWipeFromViewportPosition(w, -1, viewport);
    expect(w.comparison.position).toBe(0);
    w = setWipeFromViewportPosition(w, 2, viewport);
    expect(w.comparison.position).toBe(1);
  });

  it('horizontal world lock preserves worldY across zoom', () => {
    let w = workspaceWithCamera();
    w = setWipeAxis(w, 'horizontal', viewport);
    w = setWipeFromViewportPosition(w, 0.6, viewport);
    expect(w.comparison.axis).toBe('horizontal');
    expect(w.comparison.worldY).toBeCloseTo(10);

    const zoomedCam = zoomAtScreenPoint(
      w.camera!,
      viewport,
      { x: 100, y: 50 },
      2,
    );
    w = { ...w, camera: zoomedCam };
    expect(w.comparison.worldY).toBeCloseTo(10);
    expect(
      displayWipePosition(w.comparison, w.camera, viewport),
    ).toBeCloseTo(0.7);
  });

  it('switching axis preserves on-screen fraction', () => {
    let w = workspaceWithCamera();
    w = setWipeFromViewportPosition(w, 0.3, viewport);
    const before = displayWipePosition(w.comparison, w.camera, viewport);
    w = setWipeAxis(w, 'horizontal', viewport);
    expect(displayWipePosition(w.comparison, w.camera, viewport)).toBeCloseTo(
      before,
    );
    expect(w.comparison.axis).toBe('horizontal');
  });
});
