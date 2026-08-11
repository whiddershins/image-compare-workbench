<script lang="ts">
  import type { Workspace } from '../../domain/model';
  import { getAsset } from '../../domain/workspaceTransitions';
  import { assetWorldScaleInWorkspace } from '../../domain/sizeNormalization';
  import {
    displayWipePosition,
    effectiveView as resolveView,
    presentationViewport,
  } from '../../domain/wipe';
  import { controller } from '../stores/workspaceStore';
  import ComparisonScene from './ComparisonScene.svelte';
  import WipeDivider from './WipeDivider.svelte';

  interface Props {
    workspace: Workspace;
    selectionLoadVersion: number;
    spaceHeld: boolean;
    /** Momentary opposite-of-focus full while A/B tap is held */
    sideTapping: boolean;
  }

  let { workspace, selectionLoadVersion, spaceHeld, sideTapping }: Props =
    $props();

  let hostEl: HTMLDivElement | undefined = $state();
  let viewport = $state({ width: 0, height: 0 });
  let panning = $state(false);
  let cursor = $derived(panning ? 'grabbing' : spaceHeld ? 'grab' : 'default');

  const camera = $derived(workspace.camera);
  /** Drawn view from presentation ⟂ focus, or opposite focus while tapping */
  const view = $derived(resolveView(workspace.comparison, sideTapping));
  const isSplit = $derived(view === 'split');
  const wipeAxis = $derived(workspace.comparison.axis);
  /** Hybrid/image-locked derive the fraction from camera + world anchor. */
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

  // Half-width viewport for side-by-side scene transform + zoom-at math.
  const paneViewport = $derived(
    presentationViewport('split', viewport),
  );

  // Keep both scenes mounted always — only CSS visibility/clip changes.
  // Remounting <img> on every A/B tap caused intermittent decode blinks.
  const showA = $derived(view === 'a' || view === 'wipe' || view === 'split');
  const showB = $derived(view === 'b' || view === 'wipe' || view === 'split');
  const showWipeChrome = $derived(view === 'wipe');
  // Full A: no clip (100% A). Wipe: live wipe %. Full B: A layer hidden.
  const wipePercent = $derived(view === 'wipe' ? wipe * 100 : 100);

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
    const shouldPan = spaceHeld || e.button === 0;
    if (!shouldPan) return;
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
      // Hybrid wipe: drag slides images under a fixed wipe divider.
      controller.pan(viewport, dx, dy, 'hold-divider');
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
    const hostX = e.clientX - rect.left;
    const hostY = e.clientY - rect.top;

    if (e.ctrlKey || e.metaKey) {
      const factor = Math.exp(-e.deltaY * 0.01);
      if (isSplit && paneViewport.width > 0) {
        // Zoom relative to the pane under the cursor (shared camera).
        const inRight = hostX >= paneViewport.width;
        const point = {
          x: hostX - (inRight ? paneViewport.width : 0),
          y: hostY,
        };
        controller.zoomAt(paneViewport, point, factor);
      } else {
        controller.zoomAt(viewport, { x: hostX, y: hostY }, factor);
      }
      return;
    }

    // Hybrid wipe: two-finger / wheel pan moves camera + wipe as one world.
    controller.pan(viewport, -e.deltaX, -e.deltaY, 'carry-divider');
  }
</script>

<div
  class="viewport"
  bind:this={hostEl}
  data-testid="compare-viewport"
  data-view={view}
  style:cursor
  onpointerdown={onPointerDown}
  onwheel={onWheel}
  role="application"
  aria-label="Comparison viewport"
>
  {#if camera && viewport.width > 0}
    {#if isSplit}
      <!-- Side-by-side: shared camera, half-width pane viewport each. -->
      <div class="split" data-testid="split-layout">
        <div class="pane pane-a" data-testid="split-pane-a">
          <ComparisonScene
            asset={assetA}
            imageUrl={sideA.url}
            {camera}
            viewport={paneViewport}
            worldScale={scaleA}
            loading={sideA.loading}
            error={sideA.error}
            label="A"
          />
          <span class="pane-label" data-testid="label-a"
            >A · {assetA?.name ?? '—'}</span
          >
        </div>
        <div class="split-gutter" aria-hidden="true"></div>
        <div class="pane pane-b" data-testid="split-pane-b">
          <ComparisonScene
            asset={assetB}
            imageUrl={sideB.url}
            {camera}
            viewport={paneViewport}
            worldScale={scaleB}
            loading={sideB.loading}
            error={sideB.error}
            label="B"
          />
          <span class="pane-label" data-testid="label-b"
            >B · {assetB?.name ?? '—'}</span
          >
        </div>
      </div>
    {:else}
      <!-- Wipe / full: stacked layers; toggle visibility only (no remount). -->
      <div class="layer layer-b" class:hidden={!showB} aria-hidden={!showB}>
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
      </div>

      <div
        class="layer layer-a"
        class:hidden={!showA}
        class:clip-active={showWipeChrome}
        class:axis-vertical={wipeAxis === 'vertical'}
        class:axis-horizontal={wipeAxis === 'horizontal'}
        class:full-unclipped={view === 'a'}
        style:--wipe-percent="{wipePercent}%"
        data-testid="clip-a"
        data-axis={wipeAxis}
        aria-hidden={!showA}
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

      {#if showWipeChrome}
        <WipeDivider position={wipe} axis={wipeAxis} {viewport} />
      {/if}

      <div class="labels" aria-hidden="true">
        {#if view === 'a'}
          <span class="label-a" data-testid="label-a"
            >A · {assetA?.name ?? '—'}{sideTapping ? ' · A tap' : ''}</span
          >
        {:else if view === 'b'}
          <span class="label-b" data-testid="label-b"
            >B · {assetB?.name ?? '—'}{sideTapping ? ' · B tap' : ''}</span
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
    {/if}
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

  .layer {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  .layer.hidden {
    visibility: hidden;
  }

  .layer-b {
    z-index: 1;
  }

  .layer-a {
    z-index: 2;
  }

  /* Wipe: A clipped to left (V) or top (H) of divider */
  .layer-a.clip-active.axis-vertical {
    clip-path: inset(0 calc(100% - var(--wipe-percent)) 0 0);
  }

  .layer-a.clip-active.axis-horizontal {
    clip-path: inset(0 0 calc(100% - var(--wipe-percent)) 0);
  }

  /* Full A: entire frame is A */
  .layer-a.full-unclipped {
    clip-path: none;
  }

  .split {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: row;
    min-width: 0;
    min-height: 0;
  }

  .pane {
    position: relative;
    flex: 1 1 0;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    pointer-events: none;
  }

  .split-gutter {
    flex: 0 0 1px;
    background: var(--border-strong, #3a4048);
    z-index: 4;
  }

  .pane-label {
    position: absolute;
    left: 8px;
    bottom: 8px;
    z-index: 6;
    font-size: 11px;
    color: var(--text);
    background: rgba(0, 0, 0, 0.55);
    padding: 2px 8px;
    border-radius: 3px;
    max-width: calc(100% - 16px);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
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
