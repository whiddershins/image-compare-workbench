<script lang="ts">
  import {
    enumerateFromFileList,
    pickDirectoryFiles,
    supportsDirectoryPicker,
    supportsWebkitDirectory,
  } from '../../infrastructure/browser/enumerateFiles';
  import { controller } from '../stores/workspaceStore';

  interface Props {
    /** Parent owns global drop; highlight empty state when files are dragged. */
    dragOver?: boolean;
  }

  let { dragOver = false }: Props = $props();

  let fileInput: HTMLInputElement | undefined = $state();
  let folderInput: HTMLInputElement | undefined = $state();

  const canFolderPicker = supportsDirectoryPicker() || supportsWebkitDirectory();

  async function onFilesSelected(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    if (!input.files?.length) return;
    const result = enumerateFromFileList(input.files);
    await controller.importDiscovered(result.files, result.issues);
    input.value = '';
  }

  async function onFolderPickerClick() {
    if (supportsDirectoryPicker()) {
      await controller.importDiscovery(pickDirectoryFiles());
      return;
    }
    folderInput?.click();
  }
</script>

<div
  class="drop-zone"
  class:drag-over={dragOver}
  role="region"
  aria-label="Import images"
>
  <div class="panel">
    <p class="headline">Drop images or a folder here</p>
    <div class="actions">
      <button type="button" class="primary" onclick={() => fileInput?.click()}>
        Choose Images
      </button>
      {#if canFolderPicker}
        <button type="button" onclick={onFolderPickerClick}>
          Choose Folder
        </button>
      {/if}
    </div>
    <p class="privacy">Images stay in your browser.<br />Nothing is uploaded.</p>
    <p class="colophon">
      <a href="https://github.com/whiddershins/image-compare-workbench">GitHub</a>
      · <a href="https://sarth.net">sarth.net</a>
      · <a href="https://contraptions.bookofsarth.com">Contraptions</a>
      · Hosted on Cloudflare Workers
    </p>
  </div>

  <input
    bind:this={fileInput}
    type="file"
    accept="image/jpeg,image/png,image/webp,image/gif,image/avif,.jpg,.jpeg,.png,.webp,.gif,.avif"
    multiple
    hidden
    onchange={onFilesSelected}
  />
  {#if supportsWebkitDirectory()}
    <input
      bind:this={folderInput}
      type="file"
      multiple
      hidden
      webkitdirectory={true}
      onchange={onFilesSelected}
    />
  {/if}
</div>

<style>
  .drop-zone {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    background: var(--bg);
    border: 1px dashed transparent;
  }

  .drop-zone.drag-over {
    border-color: var(--accent);
    background: #161a20;
  }

  .panel {
    text-align: center;
    max-width: 360px;
    padding: 32px 24px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--bg-elevated);
  }

  .headline {
    margin: 0 0 20px;
    font-size: 16px;
    font-weight: 500;
    color: var(--text);
  }

  .actions {
    display: flex;
    gap: 8px;
    justify-content: center;
    flex-wrap: wrap;
    margin-bottom: 20px;
  }

  button {
    background: var(--bg);
    border: 1px solid var(--border-strong);
    border-radius: 4px;
    padding: 8px 14px;
  }

  button:hover {
    border-color: var(--text-muted);
  }

  button.primary {
    background: #243044;
    border-color: var(--accent-dim);
    color: var(--text);
  }

  button.primary:hover {
    border-color: var(--accent);
  }

  .privacy {
    margin: 0;
    font-size: 12px;
    color: var(--text-faint);
    line-height: 1.5;
  }

  .colophon {
    margin: 16px 0 0;
    font-size: 11px;
    color: var(--text-faint);
    line-height: 1.6;
  }

  .colophon a {
    color: var(--text-muted);
    text-decoration: none;
  }

  .colophon a:hover {
    color: var(--text);
  }
</style>
