<script lang="ts">
  import type { Workspace } from '../../domain/model';
  import { getAsset } from '../../domain/workspaceTransitions';
  import { assetWorldScaleInWorkspace } from '../../domain/sizeNormalization';
  import { displayWipePosition } from '../../domain/wipe';
  import { controller } from '../stores/workspaceStore';
  import ComparisonScene from './ComparisonScene.svelte';
  import WipeDivider from './WipeDivider.svelte';

  interface Props {
    workspace: Workspace;
    selectionLoadVersion: number;
    spaceHeld: boolean;
  }

  let { workspace, selectionLoadVersion, spaceHeld }: Props = $props();

  let hostEl: HTMLDivElement | undefined = $state();
  let viewport = $state({ width: 0, height: 0 });
  let panning = $state(false);
  let cursor = $derived(panning ? 'grabbing' : spaceHeld ? 'grab' : 'default');

  const camera = $derived(workspace.camera);
  const viewMode = $derived(workspace.comparison.viewMode);
  const showWipeUi = $derived(viewMode === 'wipe');
  /** On-screen wipe fraction (world-lock derives from camera each frame). */
  const wipe = $derived(
    displayWipePosition(workspace.comparison, workspace.camera, viewport),
  );
  const assetA = $derived(getAsset(workspace, workspace.selection.a));
  const assetB = $derived(getAsset(workspace, workspace.selection.b));
  const scaleA = $derived(
    assetA ? assetWorldScaleInWorkspace(workspace, assetA) : 1,
  );
  const scaleB = $derived(
    assetB ? assetWorldScaleInWorkspace(workspace, assetB) : 1,
  );

  function resolveUrl(
    side: 'a' | 'b',
    assetId: string | null,
  ): { url: string | null; loading: boolean; error: string | null } {
    void selectionLoadVersion;
    if (!assetId) return { url: null, loading: false, error: null };
    const state = controller.selectionLoader.getState(side);
    if (state.status === 'ready' && state.assetId === assetId) {
      return { url: state.url, loading: false, error: null };
    }
    if (state.status === 'loading' && state.assetId === assetId) {
      // Keep previous ready URL if any via registry for display
      const res = controller.registry.get(assetId);
      return {
        url: res.ok ? res.value.originalUrl : null,
        loading: true,
        error: null,
      };
    }
    if (state.status === 'error' && state.assetId === assetId) {
      return { url: null, loading: false, error: state.message };
    }
    const res = controller.registry.get(assetId);
    return {
      url: res.ok ? res.value.originalUrl : null,
      loading: false,
      error: res.ok ? null : 'Missing image',
    };
  }

  const sideA = $derived(resolveUrl('a', workspace.selection.a));
  const sideB = $derived(resolveUrl('b', workspace.selection.b));

  // Wipe clip: position 0 = all B (A clipped to 0 width), 1 = all A
  const wipePercent = $derived(wipe * 100);

  $effect(() => {
    if (!hostEl) return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      viewport = { width, height };
      controller.applyInitialFitIfNeeded({ width, height });
    });
    ro.observe(hostEl);
    return () => ro.disconnect();
  });

  function onPointerDown(e: PointerEvent) {
    if (!camera) return;
    if (e.button !== 0) return;
    // Wipe handle stops propagation; space or middle-ish pan
    const shouldPan = spaceHeld || e.button === 0;
    if (!shouldPan) return;

    // Don't pan if target is wipe (only present in wipe mode)
    if ((e.target as HTMLElement).closest('.wipe')) return;

    e.preventDefault();
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    panning = true;
    let lastX = e.clientX;
    let lastY = e.clientY;

    function onMove(ev: PointerEvent) {
      const dx = ev.clientX - lastX;
      const dy = ev.clientY - lastY;
      lastX = ev.clientX;
      lastY = ev.clientY;
      controller.pan(dx, dy);
    }
    function onUp(ev: PointerEvent) {
      panning = false;
      target.releasePointerCapture(ev.pointerId);
      target.removeEventListener('pointermove', onMove);
      target.removeEventListener('pointerup', onUp);
      target.removeEventListener('pointercancel', onUp);
    }
    target.addEventListener('pointermove', onMove);
    target.addEventListener('pointerup', onUp);
    target.addEventListener('pointercancel', onUp);
  }

  function onWheel(e: WheelEvent) {
    if (!camera || !hostEl) return;
    e.preventDefault();
    const rect = hostEl.getBoundingClientRect();
    const point = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };

    // Ctrl/Meta + wheel or pinch (ctrlKey on trackpad pinch)
    if (e.ctrlKey || e.metaKey) {
      const factor = Math.exp(-e.deltaY * 0.01);
      controller.zoomAt(viewport, point, factor);
      return;
    }

    // Two-axis pan
    controller.pan(-e.deltaX, -e.deltaY);
  }
</script>

<div
  class="viewport"
  bind:this={hostEl}
  data-testid="compare-viewport"
  style:cursor
  onpointerdown={onPointerDown}
  onwheel={onWheel}
  role="application"
  aria-label="Comparison viewport"
>
  {#if camera && viewport.width > 0}
    {#if viewMode === 'full-a'}
      <ComparisonScene
        asset={assetA}
        imageUrl={sideA.url}
        {camera}
        {viewport}
        worldScale={scaleA}
        loading={sideA.loading}
        error={sideA.error}
        label="A"
      />
    {:else if viewMode === 'full-b'}
      <ComparisonScene
        asset={assetB}
        imageUrl={sideB.url}
        {camera}
        {viewport}
        worldScale={scaleB}
        loading={sideB.loading}
        error={sideB.error}
        label="B"
      />
    {:else}
      <!-- Wipe: B full, A clipped over B -->
      <ComparisonScene
        asset={assetB}
        imageUrl={sideB.url}
        {camera}
        {viewport}
        worldScale={scaleB}
        loading={sideB.loading}
        error={sideB.error}
        label="B"
      />

      <div
        class="clip-a"
        style:--wipe-percent="{wipePercent}%"
        data-testid="clip-a"
      >
        <ComparisonScene
          asset={assetA}
          imageUrl={sideA.url}
          {camera}
          {viewport}
          worldScale={scaleA}
          loading={sideA.loading}
          error={sideA.error}
          label="A"
        />
      </div>

      <WipeDivider
        position={wipe}
        viewportWidth={viewport.width}
        {viewport}
      />
    {/if}

    <div class="labels" aria-hidden="true">
      {#if viewMode === 'full-a'}
        <span class="label-a" data-testid="label-a"
          >A · {assetA?.name ?? '—'}</span
        >
      {:else if viewMode === 'full-b'}
        <span class="label-b" data-testid="label-b"
          >B · {assetB?.name ?? '—'}</span
        >
      {:else}
        <span class="label-a" data-testid="label-a"
          >A · {assetA?.name ?? '—'}</span
        >
        <span class="label-b" data-testid="label-b"
          >B · {assetB?.name ?? '—'}</span
        >
      {/if}
    </div>
  {:else}
    <div class="empty-vp">Measuring viewport…</div>
  {/if}
</div>

<style>
  .viewport {
    position: relative;
    flex: 1;
    min-height: 0;
    min-width: 0;
    overflow: hidden;
    background: #0e1013;
    touch-action: none;
  }

  .clip-a {
    position: absolute;
    inset: 0;
    /* position 0 → all B (clip A to nothing on the right); position 1 → all A */
    clip-path: inset(0 calc(100% - var(--wipe-percent)) 0 0);
    z-index: 2;
    pointer-events: none;
  }

  .clip-a :global(.scene) {
    pointer-events: none;
  }

  .labels {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 8px;
    display: flex;
    justify-content: space-between;
    padding: 0 12px;
    z-index: 6;
    pointer-events: none;
  }

  .label-a,
  .label-b {
    font-size: 11px;
    color: var(--text);
    background: rgba(0, 0, 0, 0.55);
    padding: 2px 8px;
    border-radius: 3px;
    max-width: 40%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .empty-vp {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--text-faint);
  }
</style>
