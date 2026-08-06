<script lang="ts">
  import type { ImageAsset, Side } from '../../domain/model';
  import { controller } from '../stores/workspaceStore';

  interface Props {
    asset: ImageAsset;
    side: Side;
    selected: boolean;
    thumbnailUrl: string | null;
  }

  let { asset, side, selected, thumbnailUrl }: Props = $props();

  function onClick() {
    controller.select(side, asset.id);
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      controller.select(side, asset.id);
    }
  }
</script>

<button
  type="button"
  class="thumb"
  class:selected
  data-asset-id={asset.id}
  data-side={side}
  aria-pressed={selected}
  aria-label={`${asset.relativePath}, ${asset.width}×${asset.height}`}
  title={asset.relativePath}
  onclick={onClick}
  onkeydown={onKeydown}
>
  <div class="frame">
    {#if thumbnailUrl}
      <img src={thumbnailUrl} alt="" draggable="false" />
    {:else}
      <div class="placeholder"></div>
    {/if}
    {#if selected}
      <span class="badge" aria-hidden="true">{side.toUpperCase()}</span>
    {/if}
  </div>
  <span class="name">{asset.name}</span>
  <span class="dims">{asset.width}×{asset.height}</span>
</button>

<style>
  .thumb {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 3px;
    width: 100%;
    padding: 6px;
    border: 1px solid transparent;
    border-radius: 4px;
    background: transparent;
    text-align: left;
  }

  .thumb:hover {
    background: #1c2026;
  }

  .thumb.selected {
    background: var(--selected);
    border-color: var(--selected-border);
  }

  .frame {
    position: relative;
    width: 100%;
    aspect-ratio: 1;
    background: var(--bg);
    border-radius: 2px;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    display: block;
  }

  .placeholder {
    width: 100%;
    height: 100%;
    background: var(--border);
  }

  .badge {
    position: absolute;
    top: 3px;
    left: 3px;
    font-size: 10px;
    font-weight: 700;
    background: var(--accent);
    color: #0b0d10;
    padding: 1px 4px;
    border-radius: 2px;
    line-height: 1.2;
  }

  .name {
    font-size: 11px;
    color: var(--text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .dims {
    font-size: 10px;
    color: var(--text-faint);
  }
</style>
