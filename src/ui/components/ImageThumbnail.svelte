<script lang="ts">
  import type { ImageAsset, Side } from '../../domain/model';
  import { controller } from '../stores/workspaceStore';

  interface Props {
    asset: ImageAsset;
    side: Side;
    selected: boolean;
    /** Selected on the opposite rail — muted; click swaps A↔B */
    crossSelected: boolean;
    thumbnailUrl: string | null;
  }

  let { asset, side, selected, crossSelected, thumbnailUrl }: Props = $props();

  function onClick() {
    if (crossSelected) {
      controller.swap();
      return;
    }
    controller.select(side, asset.id);
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  }

  const otherLabel = $derived(side === 'a' ? 'B' : 'A');
  const ariaLabel = $derived(
    crossSelected
      ? `${asset.relativePath} — selected as ${otherLabel}; click to swap A and B`
      : `${asset.relativePath}, ${asset.width}×${asset.height}`,
  );
  const title = $derived(
    crossSelected
      ? `${asset.relativePath}\nSelected as ${otherLabel} — click to swap`
      : asset.relativePath,
  );
</script>

<button
  type="button"
  class="thumb"
  class:selected
  class:cross-selected={crossSelected}
  data-asset-id={asset.id}
  data-side={side}
  aria-pressed={selected}
  aria-label={ariaLabel}
  {title}
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
    {:else if crossSelected}
      <span class="badge swap-badge" aria-hidden="true" title="Swap A and B">⇄</span>
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

  /* Opposite side already has this image — look disabled; click swaps */
  .thumb.cross-selected {
    opacity: 0.5;
  }

  .thumb.cross-selected:hover {
    opacity: 0.85;
    background: #1c2026;
    border-color: var(--border-strong);
  }

  .thumb.cross-selected:hover .swap-badge {
    background: var(--accent);
    color: #0b0d10;
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

  .swap-badge {
    background: var(--border-strong);
    color: var(--text-muted);
    font-size: 12px;
    font-weight: 600;
    padding: 1px 5px;
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
