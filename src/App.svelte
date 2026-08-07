<script lang="ts">
  import { onMount } from 'svelte';
  import type { Workspace } from './domain/model';
  import { emptyWorkspace } from './domain/workspaceTransitions';
  import { isEmpty } from './domain/workspaceTransitions';
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
  let peekingB = $state(false);
  let viewportSize = $state({ width: 800, height: 600 });

  const loaded = $derived(!isEmpty(workspace));

  onMount(() => {
    workspace = controller.getWorkspace();
    peekingB = controller.isPeekingB();
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
      controller.subscribePeek((v) => {
        peekingB = v;
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

      // Hold V = momentary full B (B tap)
      if ((e.key === 'v' || e.key === 'V') && !e.repeat) {
        e.preventDefault();
        controller.beginPeekB();
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
      if (e.key === 'v' || e.key === 'V') controller.endPeekB();
    }

    function onBlur() {
      controller.endPeekB();
      spaceHeld = false;
    }

    // Prevent browser navigating on file drop at window level
    function preventNav(e: DragEvent) {
      e.preventDefault();
    }

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    window.addEventListener('dragover', preventNav);
    window.addEventListener('drop', preventNav);

    return () => {
      for (const u of unsubs) u();
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('dragover', preventNav);
      window.removeEventListener('drop', preventNav);
      controller.destroy();
    };
  });

</script>

<div class="app-root">
  {#if !loaded}
    <DropZone />
  {:else}
    <div class="workbench">
      <ImageRail side="a" {workspace} {resourceVersion} />
      <div class="center-column">
        <Toolbar
          {workspace}
          viewport={viewportSize}
          {peekingB}
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
            {peekingB}
          />
        </div>
      </div>
      <ImageRail side="b" {workspace} {resourceVersion} />
    </div>
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
