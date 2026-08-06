<script lang="ts">
  import { controller } from '../stores/workspaceStore';

  interface Props {
    position: number;
    viewportWidth: number;
  }

  let { position, viewportWidth }: Props = $props();

  const SMALL_STEP = 0.01;
  const LARGE_STEP = 0.05;

  function positionFromClientX(clientX: number, rect: DOMRect): number {
    if (rect.width <= 0) return position;
    return (clientX - rect.left) / rect.width;
  }

  function onPointerDown(e: PointerEvent) {
    e.preventDefault();
    e.stopPropagation();
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    const host = target.closest('.viewport') as HTMLElement | null;
    if (!host) return;
    const rect = host.getBoundingClientRect();
    controller.setWipe(positionFromClientX(e.clientX, rect));

    function onMove(ev: PointerEvent) {
      controller.setWipe(positionFromClientX(ev.clientX, rect));
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
    e.preventDefault();
    e.stopPropagation();
    controller.setWipe(next);
  }

  const leftPx = $derived(position * viewportWidth);
</script>

<div
  class="wipe"
  style:left="{leftPx}px"
  role="slider"
  tabindex="0"
  aria-label="Comparison wipe"
  aria-valuemin={0}
  aria-valuemax={100}
  aria-valuenow={Math.round(position * 100)}
  aria-valuetext={`${Math.round(position * 100)}% A`}
  data-testid="wipe-divider"
  onpointerdown={onPointerDown}
  onkeydown={onKeydown}
>
  <div class="line" aria-hidden="true"></div>
  <div class="handle" aria-hidden="true"></div>
</div>

<style>
  .wipe {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 20px;
    margin-left: -10px;
    z-index: 5;
    cursor: ew-resize;
    touch-action: none;
    user-select: none;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .line {
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

  .handle {
    width: 14px;
    height: 36px;
    border-radius: 3px;
    background: var(--wipe);
    border: 1px solid var(--wipe-edge);
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.45);
    z-index: 1;
  }

  .handle::before,
  .handle::after {
    content: '';
    position: absolute;
    /* visual ticks via box on handle - keep simple */
  }
</style>
