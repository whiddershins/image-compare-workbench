import { describe, expect, it } from 'vitest';
import type { Workspace } from '../../src/domain/model';
import {
  cycleFullView,
  displayWipePosition,
  effectiveView,
  fullButtonLabel,
  setWipeFromViewportPosition,
  setWipeLock,
  setWipeAxis,
  setViewMode,
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
      viewMode: 'wipe',
      axis: 'vertical',
      lock: 'world',
      position: 0.5,
      worldX: 0,
      worldY: 0,
    },
  };
}

const viewport = { width: 200, height: 100 };

describe('wipe lock', () => {
  it('defaults to vertical world lock at center and wipe view mode', () => {
    const c = defaultComparison();
    expect(c.lock).toBe('world');
    expect(c.axis).toBe('vertical');
    expect(c.viewMode).toBe('wipe');
    expect(c.position).toBe(0.5);
    expect(c.worldX).toBe(0);
    expect(c.worldY).toBe(0);
  });

  it('setViewMode keeps wipe geometry', () => {
    let w = workspaceWithCamera();
    w = setWipeFromViewportPosition(w, 0.3, viewport);
    const cam = w.camera;
    const pos = w.comparison.position;
    const worldX = w.comparison.worldX;
    w = setViewMode(w, 'a');
    expect(w.comparison.viewMode).toBe('a');
    expect(w.comparison.position).toBe(pos);
    expect(w.comparison.worldX).toBe(worldX);
    expect(w.camera).toBe(cam);
    w = setViewMode(w, 'wipe');
    expect(w.comparison.viewMode).toBe('wipe');
    expect(w.comparison.position).toBe(pos);
  });

  it('cycleFullView and tapTarget are simple ternaries', () => {
    expect(cycleFullView('wipe')).toBe('a');
    expect(cycleFullView('a')).toBe('b');
    expect(cycleFullView('b')).toBe('a');
    expect(tapTarget('wipe')).toBe('b');
    expect(tapTarget('a')).toBe('b');
    expect(tapTarget('b')).toBe('a');
    expect(effectiveView('a', false)).toBe('a');
    expect(effectiveView('a', true)).toBe('b');
    expect(effectiveView('b', true)).toBe('a');
    expect(effectiveView('wipe', true)).toBe('b');
    expect(fullButtonLabel('wipe')).toBe('Full A');
    expect(fullButtonLabel('a')).toBe('Full A');
    expect(fullButtonLabel('b')).toBe('Full B');
    expect(tapButtonLabel('a')).toBe('B tap');
    expect(tapButtonLabel('b')).toBe('A tap');
  });

  it('world lock: zoom preserves worldX; display position changes', () => {
    let w = workspaceWithCamera();
    // Place wipe at world X = 20 via viewport drag at x=120 when scale=1 center=0
    // screenX = vw/2 + (worldX - centerX) * scale => 100 + 20 = 120 => pos 0.6
    w = setWipeFromViewportPosition(w, 0.6, viewport);
    expect(w.comparison.worldX).toBeCloseTo(20);

    const beforeDisplay = displayWipePosition(
      w.comparison,
      w.camera,
      viewport,
    );
    expect(beforeDisplay).toBeCloseTo(0.6);

    // Zoom 2× about viewport center — world X under wipe should stay 20
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
    // screenX = 100 + (20 - 0) * 2 = 140 => 0.7
    expect(afterDisplay).toBeCloseTo(0.7);
    expect(afterDisplay).not.toBeCloseTo(beforeDisplay);
  });

  it('viewport lock: zoom preserves display position', () => {
    let w = workspaceWithCamera();
    w = setWipeFromViewportPosition(w, 0.6, viewport);
    w = setWipeLock(w, 'viewport', viewport);
    expect(w.comparison.lock).toBe('viewport');
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

  it('switching lock preserves on-screen wipe', () => {
    let w = workspaceWithCamera();
    w = setWipeFromViewportPosition(w, 0.25, viewport);
    const before = displayWipePosition(w.comparison, w.camera, viewport);

    w = setWipeLock(w, 'viewport', viewport);
    expect(displayWipePosition(w.comparison, w.camera, viewport)).toBeCloseTo(
      before,
    );

    w = setWipeLock(w, 'world', viewport);
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
    // pos 0.6 → screenY = 60; center 0 scale 1 → worldY = 60 - 50 = 10
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
    // screenY = 50 + 10 * 2 = 70 → 0.7
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
