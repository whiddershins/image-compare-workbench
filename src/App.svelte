<script lang="ts">
  import { onMount } from 'svelte';
  import type { Workspace } from './domain/model';
  import { emptyWorkspace } from './domain/workspaceTransitions';
  import { isEmpty } from './domain/workspaceTransitions';
  import { enumerateFromDataTransfer } from './infrastructure/browser/enumerateFiles';
  import { controller } from './ui/stores/workspaceStore';
  import DropZone from './ui/components/DropZone.svelte';
  import ImageRail from './ui/components/ImageRail.svelte';
  import Toolbar from './ui/components/Toolbar.svelte';
  import CompareViewport from './ui/components/CompareViewport.svelte';
  import ShortcutHelp from './ui/components/ShortcutHelp.svelte';
  import ImportSummary from './ui/components/ImportSummary.svelte';

  let workspace = $state<Workspace>(emptyWorkspace());
  let importing = $state(false);
  let summaryText = $state<string | null>(null);
  let errorText = $state<string | null>(null);
  let selectionLoadVersion = $state(0);
  let resourceVersion = $state(0);
  let helpOpen = $state(false);
  let spaceHeld = $state(false);
  let sideTapping = $state(false);
  let viewportSize = $state({ width: 800, height: 600 });
  /** File drag-over highlight (empty or loaded session). */
  let fileDragOver = $state(false);
  let fileDragDepth = 0;

  const loaded = $derived(!isEmpty(workspace));

  function isFileDrag(e: DragEvent): boolean {
    return !!e.dataTransfer?.types?.includes('Files');
  }

  function onRootDragEnter(e: DragEvent) {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    fileDragDepth += 1;
    fileDragOver = true;
  }

  function onRootDragOver(e: DragEvent) {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
  }

  function onRootDragLeave(e: DragEvent) {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    fileDragDepth = Math.max(0, fileDragDepth - 1);
    if (fileDragDepth === 0) fileDragOver = false;
  }

  async function onRootDrop(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    fileDragDepth = 0;
    fileDragOver = false;
    if (!e.dataTransfer || !isFileDrag(e)) return;
    try {
      // Appends when workspace already has images; creates set when empty.
      const result = await enumerateFromDataTransfer(e.dataTransfer);
      await controller.importDiscovered(result.files, result.issues);
    } catch (err) {
      console.error(err);
    }
  }

  onMount(() => {
    workspace = controller.getWorkspace();
    sideTapping = controller.isSideTapping();
    const unsubs = [
      controller.subscribe((w) => {
        const resourcesChanged = w.imageSet.assets !== workspace.imageSet.assets;
        workspace = w;
        if (resourcesChanged) resourceVersion += 1;
      }),
      controller.subscribeLoading((v) => {
        importing = v;
      }),
      controller.subscribeSummary((s) => {
        summaryText = s?.text ?? null;
      }),
      controller.subscribeError((e) => {
        errorText = e?.message ?? null;
      }),
      controller.subscribeSelectionLoad(() => {
        selectionLoadVersion += 1;
      }),
      controller.subscribeSideTap((v) => {
        sideTapping = v;
      }),
    ];

    function isInteractiveTarget(t: EventTarget | null): boolean {
      if (!(t instanceof HTMLElement)) return false;
      return (
        t.isContentEditable ||
        t.matches('button, a[href], input, textarea, select, [role="slider"]')
      );
    }

    function onKeyDown(e: KeyboardEvent) {
      if (helpOpen) {
        if (e.key === 'Escape') {
          e.preventDefault();
          helpOpen = false;
        }
        return;
      }

      if (
        e.metaKey ||
        e.ctrlKey ||
        e.altKey ||
        isInteractiveTarget(e.target)
      ) {
        return;
      }

      if (e.key === ' ' && !e.repeat) {
        spaceHeld = true;
        // Prevent page scroll
        if (loaded) e.preventDefault();
      }

      if (!loaded) {
        if (e.key === '?' || (e.shiftKey && e.key === '/')) {
          e.preventDefault();
          helpOpen = true;
        }
        return;
      }

      // Hold V = momentary opposite full (A tap / B tap)
      if ((e.key === 'v' || e.key === 'V') && !e.repeat) {
        e.preventDefault();
        controller.beginSideTap();
        return;
      }

      switch (e.key) {
        case 'a':
        case 'A':
          e.preventDefault();
          controller.setActive('a');
          break;
        case 'b':
        case 'B':
          e.preventDefault();
          controller.setActive('b');
          break;
        case 'ArrowUp':
          e.preventDefault();
          controller.cycle(workspace.selection.activeSide, -1);
          break;
        case 'ArrowDown':
          e.preventDefault();
          controller.cycle(workspace.selection.activeSide, 1);
          break;
        case 's':
        case 'S':
          e.preventDefault();
          controller.swap();
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          controller.fit(viewportSize);
          break;
        case '0':
          e.preventDefault();
          controller.zoom100();
          break;
        case '-':
        case '_':
          e.preventDefault();
          controller.zoomOut();
          break;
        case '=':
        case '+':
          e.preventDefault();
          controller.zoomIn();
          break;
        case '?':
          e.preventDefault();
          helpOpen = true;
          break;
        default:
          break;
      }
    }

    function onKeyUp(e: KeyboardEvent) {
      if (e.key === ' ') spaceHeld = false;
      if (e.key === 'v' || e.key === 'V') controller.endSideTap();
    }

    function onBlur() {
      controller.endSideTap();
      spaceHeld = false;
    }

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);

    return () => {
      for (const u of unsubs) u();
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      controller.destroy();
    };
  });

</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="app-root"
  class:file-drag-over={fileDragOver && loaded}
  ondragenter={onRootDragEnter}
  ondragover={onRootDragOver}
  ondragleave={onRootDragLeave}
  ondrop={onRootDrop}
>
  {#if !loaded}
    <DropZone dragOver={fileDragOver} />
  {:else}
    <div class="workbench">
      <ImageRail side="a" {workspace} {resourceVersion} />
      <div class="center-column">
        <Toolbar
          {workspace}
          viewport={viewportSize}
          {sideTapping}
          onhelp={() => (helpOpen = true)}
        />
        <div
          class="vp-host"
          style="flex:1;min-height:0;display:flex;flex-direction:column;"
          bind:clientWidth={viewportSize.width}
          bind:clientHeight={viewportSize.height}
        >
          <CompareViewport
            {workspace}
            {selectionLoadVersion}
            {spaceHeld}
            {sideTapping}
          />
        </div>
      </div>
      <ImageRail side="b" {workspace} {resourceVersion} />
    </div>
    {#if fileDragOver}
      <div class="drop-overlay" aria-hidden="true">
        <span>Drop to add images</span>
      </div>
    {/if}
  {/if}

  {#if loaded || importing || summaryText || errorText}
    <div class="status-bar">
      <ImportSummary text={summaryText} />
      {#if importing}
        <span class="importing" role="status">Importing…</span>
      {/if}
      {#if errorText}
        <span class="error" role="alert">{errorText}</span>
      {/if}
      {#if loaded}
        <span style="margin-left:auto;color:var(--text-faint)">
          Active: {workspace.selection.activeSide.toUpperCase()} · {workspace
            .imageSet.assets.length} images
        </span>
      {/if}
    </div>
  {/if}

  <ShortcutHelp open={helpOpen} onclose={() => (helpOpen = false)} />
</div>
