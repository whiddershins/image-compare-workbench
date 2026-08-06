<script lang="ts">
  import type { ViewportSize, Workspace } from '../../domain/model';
  import { zoomPercent } from '../../domain/camera';
  import {
    enumerateFromFileList,
    pickDirectoryFiles,
    supportsDirectoryPicker,
    supportsWebkitDirectory,
  } from '../../infrastructure/browser/enumerateFiles';
  import { controller } from '../stores/workspaceStore';

  interface Props {
    workspace: Workspace;
    viewport: ViewportSize;
    onhelp: () => void;
  }

  let { workspace, viewport, onhelp }: Props = $props();

  let fileInput: HTMLInputElement | undefined = $state();
  let folderInput: HTMLInputElement | undefined = $state();
  let addOpen = $state(false);

  const pct = $derived(zoomPercent(workspace.camera));
  const canFolder = supportsDirectoryPicker() || supportsWebkitDirectory();

  function fit() {
    controller.fit(viewport);
  }

  async function onFilesSelected(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    if (!input.files?.length) return;
    const result = enumerateFromFileList(input.files);
    await controller.importDiscovered(result.files, result.issues);
    input.value = '';
    addOpen = false;
  }

  async function addFolder() {
    if (supportsDirectoryPicker()) {
      const result = await pickDirectoryFiles();
      await controller.importDiscovered(result.files, result.issues);
    } else {
      folderInput?.click();
    }
    addOpen = false;
  }
</script>

<div class="toolbar" role="toolbar" aria-label="Comparison tools">
  <div class="group">
    <div class="add-wrap">
      <button
        type="button"
        class="btn"
        aria-haspopup="menu"
        aria-expanded={addOpen}
        onclick={() => (addOpen = !addOpen)}
      >
        Add…
      </button>
      {#if addOpen}
        <div class="menu" role="menu">
          <button
            type="button"
            role="menuitem"
            onclick={() => {
              fileInput?.click();
              addOpen = false;
            }}
          >
            Add Images
          </button>
          {#if canFolder}
            <button type="button" role="menuitem" onclick={addFolder}>
              Add Folder
            </button>
          {/if}
        </div>
      {/if}
    </div>
    <button
      type="button"
      class="btn danger"
      onclick={() => controller.clear()}
      data-testid="clear-btn"
    >
      Clear
    </button>
  </div>

  <div class="group">
    <button
      type="button"
      class="btn"
      aria-label="Zoom out"
      onclick={() => controller.zoomOut()}
    >
      −
    </button>
    <button
      type="button"
      class="btn"
      aria-label="Zoom in"
      onclick={() => controller.zoomIn()}
    >
      +
    </button>
    <button type="button" class="btn" onclick={fit} data-testid="fit-btn">
      Fit
    </button>
    <button
      type="button"
      class="btn"
      onclick={() => controller.zoom100()}
      data-testid="zoom-100-btn"
    >
      100%
    </button>
    <button
      type="button"
      class="btn"
      onclick={() => controller.swap()}
      data-testid="swap-btn"
    >
      Swap
    </button>
    <span class="zoom-pct" data-testid="zoom-pct" aria-live="polite"
      >{pct}%</span
    >
  </div>

  <div class="group">
    <button type="button" class="btn" onclick={onhelp} aria-label="Keyboard shortcuts">
      ?
    </button>
  </div>

  <input
    bind:this={fileInput}
    type="file"
    accept="image/jpeg,image/png,image/webp,image/gif,image/avif,.jpg,.jpeg,.png,.webp,.gif,.avif"
    multiple
    hidden
    onchange={onFilesSelected}
  />
  <input
    bind:this={folderInput}
    type="file"
    multiple
    hidden
    webkitdirectory={true}
    onchange={onFilesSelected}
  />
</div>

<style>
  .toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    height: var(--toolbar-h);
    padding: 0 8px;
    background: var(--bg-elevated);
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
    user-select: none;
  }

  .group {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .btn {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 3px;
    padding: 4px 10px;
    font-size: 12px;
    min-width: 28px;
  }

  .btn:hover {
    border-color: var(--border-strong);
  }

  .btn.danger {
    color: #e0a0a0;
    border-color: #4a3030;
  }

  .zoom-pct {
    min-width: 48px;
    text-align: center;
    font-variant-numeric: tabular-nums;
    font-size: 12px;
    color: var(--text-muted);
  }

  .add-wrap {
    position: relative;
  }

  .menu {
    position: absolute;
    top: 100%;
    left: 0;
    margin-top: 2px;
    background: var(--bg-elevated);
    border: 1px solid var(--border-strong);
    border-radius: 4px;
    z-index: 20;
    min-width: 140px;
    padding: 4px;
    display: flex;
    flex-direction: column;
  }

  .menu button {
    background: transparent;
    border: none;
    text-align: left;
    padding: 6px 10px;
    border-radius: 3px;
    font-size: 12px;
  }

  .menu button:hover {
    background: var(--selected);
  }
</style>
