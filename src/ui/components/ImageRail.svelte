<script lang="ts">
  import type { ImageAsset, Side, Workspace } from '../../domain/model';
  import { controller } from '../stores/workspaceStore';
  import ImageThumbnail from './ImageThumbnail.svelte';

  interface Props {
    side: Side;
    workspace: Workspace;
    /** Bumps when registry changes so URLs re-resolve */
    resourceVersion: number;
  }

  let { side, workspace, resourceVersion }: Props = $props();

  let railEl: HTMLElement | undefined = $state();

  const assets = $derived(workspace.imageSet.assets);
  const selectedId = $derived(workspace.selection[side]);
  const otherSide = $derived(side === 'a' ? 'b' : 'a');
  const otherSelectedId = $derived(workspace.selection[otherSide]);
  const isActive = $derived(workspace.selection.activeSide === side);
  const label = $derived(side === 'a' ? 'A' : 'B');

  function thumbUrl(asset: ImageAsset): string | null {
    void resourceVersion;
    const res = controller.registry.get(asset.id);
    return res.ok ? res.value.thumbnailUrl : null;
  }

  $effect(() => {
    const id = selectedId;
    if (!id || !railEl) return;
    const el = railEl.querySelector(`[data-asset-id="${CSS.escape(id)}"]`);
    if (el instanceof HTMLElement) {
      el.scrollIntoView({ block: 'nearest' });
    }
  });

  function onRailClick() {
    controller.setActive(side);
  }
</script>

<section
  class="rail"
  class:active={isActive}
  data-side={side}
  aria-label={`Side ${label} image list`}
  aria-current={isActive ? 'true' : undefined}
>
  <button
    type="button"
    class="rail-header"
    onclick={onRailClick}
    aria-pressed={isActive}
    aria-label={`Activate side ${label}`}
  >
    <span class="side-label">{label}</span>
    <span class="count">{assets.length}</span>
  </button>
  <div class="list" bind:this={railEl} role="listbox" aria-label={`Side ${label}`}>
    {#each assets as asset (asset.id)}
      <ImageThumbnail
        {asset}
        {side}
        selected={selectedId === asset.id}
        crossSelected={otherSelectedId === asset.id && selectedId !== asset.id}
        thumbnailUrl={thumbUrl(asset)}
      />
    {/each}
  </div>
</section>

<style>
  .rail {
    display: flex;
    flex-direction: column;
    min-height: 0;
    background: var(--bg-rail);
    border-top: 2px solid transparent;
  }

  .rail.active {
    border-top-color: var(--accent);
  }

  .rail-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 10px 6px;
    border: none;
    border-bottom: 1px solid var(--border);
    border-radius: 0;
    flex-shrink: 0;
    width: 100%;
    background: transparent;
    cursor: pointer;
  }

  .rail-header:hover {
    background: #1c2026;
  }

  .side-label {
    font-weight: 700;
    font-size: 12px;
    letter-spacing: 0.04em;
  }

  .rail.active .side-label {
    color: var(--accent);
  }

  .count {
    font-size: 11px;
    color: var(--text-faint);
  }

  .list {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 6px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
</style>
