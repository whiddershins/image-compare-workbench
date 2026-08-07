<script lang="ts">
  import type { ViewportSize, WipeAxis } from '../../domain/model';
  import { controller } from '../stores/workspaceStore';

  interface Props {
    position: number;
    axis: WipeAxis;
    viewport: ViewportSize;
  }

  let { position, axis, viewport }: Props = $props();

  const SMALL_STEP = 0.01;
  const LARGE_STEP = 0.05;
  const vertical = $derived(axis === 'vertical');

  function positionFromPointer(
    clientX: number,
    clientY: number,
    rect: DOMRect,
  ): number {
    if (vertical) {
      if (rect.width <= 0) return position;
      return (clientX - rect.left) / rect.width;
    }
    if (rect.height <= 0) return position;
    return (clientY - rect.top) / rect.height;
  }

  function applyWipe(pos: number) {
    controller.setWipe(pos, viewport);
  }

  function onPointerDown(e: PointerEvent) {
    e.preventDefault();
    e.stopPropagation();
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    const host = target.closest('.viewport') as HTMLElement | null;
    if (!host) return;
    const rect = host.getBoundingClientRect();
    applyWipe(positionFromPointer(e.clientX, e.clientY, rect));

    function onMove(ev: PointerEvent) {
      applyWipe(positionFromPointer(ev.clientX, ev.clientY, rect));
    }
    function onUp(ev: PointerEvent) {
      target.releasePointerCapture(ev.pointerId);
      target.removeEventListener('pointermove', onMove);
      target.removeEventListener('pointerup', onUp);
      target.removeEventListener('pointercancel', onUp);
    }
    target.addEventListener('pointermove', onMove);
    target.addEventListener('pointerup', onUp);
    target.addEventListener('pointercancel', onUp);
  }

  function onKeydown(e: KeyboardEvent) {
    let next: number | null = null;
    const step = e.shiftKey ? LARGE_STEP : SMALL_STEP;
    if (vertical) {
      switch (e.key) {
        case 'ArrowLeft':
          next = position - step;
          break;
        case 'ArrowRight':
          next = position + step;
          break;
        case 'Home':
          next = 0;
          break;
        case 'End':
          next = 1;
          break;
        default:
          return;
      }
    } else {
      switch (e.key) {
        case 'ArrowUp':
          next = position - step;
          break;
        case 'ArrowDown':
          next = position + step;
          break;
        case 'Home':
          next = 0;
          break;
        case 'End':
          next = 1;
          break;
        default:
          return;
      }
    }
    e.preventDefault();
    e.stopPropagation();
    applyWipe(next);
  }

  const offsetPx = $derived(
    vertical
      ? position * viewport.width
      : position * viewport.height,
  );
</script>

<div
  class="wipe"
  class:vertical
  class:horizontal={!vertical}
  style:left={vertical ? `${offsetPx}px` : '0'}
  style:top={vertical ? '0' : `${offsetPx}px`}
  role="slider"
  tabindex="0"
  aria-label={vertical ? 'Vertical comparison wipe' : 'Horizontal comparison wipe'}
  aria-orientation={vertical ? 'horizontal' : 'vertical'}
  aria-valuemin={0}
  aria-valuemax={100}
  aria-valuenow={Math.round(position * 100)}
  aria-valuetext={`${Math.round(position * 100)}% A`}
  data-testid="wipe-divider"
  data-axis={axis}
  onpointerdown={onPointerDown}
  onkeydown={onKeydown}
>
  <div class="line" aria-hidden="true"></div>
  <div class="handle" aria-hidden="true"></div>
</div>

<style>
  .wipe {
    position: absolute;
    z-index: 5;
    touch-action: none;
    user-select: none;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .wipe.vertical {
    top: 0;
    bottom: 0;
    width: 20px;
    margin-left: -10px;
    cursor: ew-resize;
  }

  .wipe.horizontal {
    left: 0;
    right: 0;
    height: 20px;
    margin-top: -10px;
    cursor: ns-resize;
  }

  .wipe.vertical .line {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 2px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--wipe);
    box-shadow:
      -1px 0 0 var(--wipe-edge),
      1px 0 0 var(--wipe-edge);
  }

  .wipe.horizontal .line {
    position: absolute;
    left: 0;
    right: 0;
    height: 2px;
    top: 50%;
    transform: translateY(-50%);
    background: var(--wipe);
    box-shadow:
      0 -1px 0 var(--wipe-edge),
      0 1px 0 var(--wipe-edge);
  }

  .handle {
    border-radius: 3px;
    background: var(--wipe);
    border: 1px solid var(--wipe-edge);
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.45);
    z-index: 1;
  }

  .wipe.vertical .handle {
    width: 14px;
    height: 36px;
  }

  .wipe.horizontal .handle {
    width: 36px;
    height: 14px;
  }
</style>
