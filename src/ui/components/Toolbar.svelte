<script lang="ts">
  import type {
    SizeNormBasis,
    SizeNormReference,
    ViewportSize,
    WipeBehavior,
    Workspace,
  } from '../../domain/model';
  import {
    SIZE_NORM_BASES,
    SIZE_NORM_REFERENCES,
    WIPE_BEHAVIORS,
  } from '../../domain/model';
  import { zoomPercent } from '../../domain/camera';
  import {
    sizeNormBasisDescription,
    sizeNormBasisLabel,
    sizeNormReferenceDescription,
    sizeNormReferenceLabel,
    withSizeNormBasis,
    withSizeNormReference,
  } from '../../domain/sizeNormalization';
  import {
    fullButtonDescription,
    fullButtonLabel,
    tapButtonDescription,
    tapButtonLabel,
    WIPE_BUTTON_DESCRIPTION,
    wipeAxisDescription,
    wipeAxisLabel,
    wipeBehaviorDescription,
    wipeBehaviorLabel,
  } from '../../domain/wipe';
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
    sideTapping: boolean;
    onhelp: () => void;
  }

  let { workspace, viewport, sideTapping, onhelp }: Props = $props();

  let fileInput: HTMLInputElement | undefined = $state();
  let folderInput: HTMLInputElement | undefined = $state();
  let addOpen = $state(false);

  const pct = $derived(zoomPercent(workspace.camera));
  const canFolder = supportsDirectoryPicker() || supportsWebkitDirectory();
  const sizeNorm = $derived(workspace.sizeNormalization);
  const wipeBehavior = $derived(workspace.comparison.behavior);
  const wipeAxis = $derived(workspace.comparison.axis);
  const presentation = $derived(workspace.comparison.presentation);
  const focus = $derived(workspace.comparison.focus);
  const refDisabled = $derived(sizeNorm.basis === 'native');
  // Sticky radiogroup selection is presentation only; side-tap uses aria-pressed.
  const fullActive = $derived(presentation === 'full');
  const wipeActive = $derived(presentation === 'wipe');
  /** Wipe geometry controls only apply in wipe presentation. */
  const wipeChromeDisabled = $derived(presentation !== 'wipe');

  function fit() {
    controller.fit(viewport);
  }

  function onFullClick() {
    controller.cycleFullView();
  }

  function onWipeClick() {
    controller.setWipeView();
  }

  function onTapDown(e: PointerEvent) {
    if (e.button !== 0) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    controller.beginSideTap();
  }

  function onTapUp(e: PointerEvent) {
    // Only end on the primary button release; ignore stray leave/cancel noise
    // after capture so we don't flicker begin/end.
    if (e.type === 'pointerup' && e.button !== 0) return;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
    controller.endSideTap();
  }

  function onBasisChange(e: Event) {
    const basis = (e.currentTarget as HTMLSelectElement).value as SizeNormBasis;
    controller.setSizeNormalization(
      withSizeNormBasis(sizeNorm, basis),
      viewport,
    );
  }

  function onReferenceChange(e: Event) {
    const reference = (e.currentTarget as HTMLSelectElement)
      .value as SizeNormReference;
    controller.setSizeNormalization(
      withSizeNormReference(sizeNorm, reference),
      viewport,
    );
  }

  function onWipeBehaviorChange(e: Event) {
    const behavior = (e.currentTarget as HTMLSelectElement)
      .value as WipeBehavior;
    controller.setWipeBehavior(behavior, viewport);
  }

  function toggleWipeAxis() {
    const next = wipeAxis === 'vertical' ? 'horizontal' : 'vertical';
    controller.setWipeAxis(next, viewport);
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
        aria-expanded={addOpen}
        onclick={() => (addOpen = !addOpen)}
      >
        Add…
      </button>
      {#if addOpen}
        <div class="menu">
          <button
            type="button"
            onclick={() => {
              fileInput?.click();
              addOpen = false;
            }}
          >
            Add Images
          </button>
          {#if canFolder}
            <button type="button" onclick={addFolder}>
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
    <div
      class="seg"
      role="radiogroup"
      aria-label="View mode"
      data-testid="view-mode"
    >
      <button
        type="button"
        class="btn seg-btn"
        class:active={fullActive}
        role="radio"
        aria-checked={fullActive}
        data-testid="view-mode-full"
        title={fullButtonDescription(workspace.comparison)}
        onclick={onFullClick}
      >
        {fullButtonLabel(focus)}
      </button>
      <button
        type="button"
        class="btn seg-btn"
        class:active={wipeActive}
        role="radio"
        aria-checked={wipeActive}
        data-testid="view-mode-wipe"
        title={WIPE_BUTTON_DESCRIPTION}
        onclick={onWipeClick}
      >
        Wipe
      </button>
    </div>
    <button
      type="button"
      class="btn"
      class:active-toggle={sideTapping}
      data-testid="side-tap-btn"
      title={`${tapButtonDescription(focus)} (hold V)`}
      aria-label={`${tapButtonLabel(focus)} — hold`}
      aria-pressed={sideTapping}
      onpointerdown={onTapDown}
      onpointerup={onTapUp}
      onpointercancel={onTapUp}
      onlostpointercapture={() => controller.endSideTap()}
      oncontextmenu={(e) => e.preventDefault()}
    >
      {tapButtonLabel(focus)}
    </button>
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
      title="Swap A and B (S)"
      aria-label="Swap A and B"
    >
      ⇄ Swap
    </button>
    <label
      class="size-mode"
      title={sizeNormBasisDescription(sizeNorm.basis)}
    >
      <span class="sr-only">Size basis</span>
      <select
        data-testid="size-norm-basis"
        aria-label="Size basis"
        value={sizeNorm.basis}
        onchange={onBasisChange}
      >
        {#each SIZE_NORM_BASES as basis}
          <option value={basis}>{sizeNormBasisLabel(basis)}</option>
        {/each}
      </select>
    </label>
    <label
      class="size-mode"
      class:disabled={refDisabled}
      title={refDisabled
        ? 'Reference is unused when size basis is Native px'
        : sizeNormReferenceDescription(sizeNorm.reference)}
    >
      <span class="sr-only">Size reference</span>
      <select
        data-testid="size-norm-reference"
        aria-label="Size reference"
        value={sizeNorm.reference}
        disabled={refDisabled}
        onchange={onReferenceChange}
      >
        {#each SIZE_NORM_REFERENCES as ref}
          <option value={ref}>{sizeNormReferenceLabel(ref)}</option>
        {/each}
      </select>
    </label>
    <button
      type="button"
      class="btn"
      data-testid="wipe-axis-btn"
      title={wipeChromeDisabled
        ? 'Wipe axis applies in Wipe mode only'
        : wipeAxisDescription(wipeAxis)}
      aria-label={`Wipe axis: ${wipeAxis}`}
      disabled={wipeChromeDisabled}
      onclick={toggleWipeAxis}
    >
      {wipeAxisLabel(wipeAxis)}
    </button>
    <label
      class="size-mode"
      class:disabled={wipeChromeDisabled}
      title={wipeChromeDisabled
        ? 'Wipe behavior applies in Wipe mode only'
        : wipeBehaviorDescription(wipeBehavior)}
    >
      <span class="sr-only">Wipe behavior</span>
      <span id="wipe-behavior-description" class="sr-only">
        {wipeChromeDisabled
          ? 'Available in Wipe mode only.'
          : wipeBehaviorDescription(wipeBehavior)}
      </span>
      <select
        data-testid="wipe-behavior-select"
        aria-label="Wipe behavior"
        aria-describedby="wipe-behavior-description"
        value={wipeBehavior}
        disabled={wipeChromeDisabled}
        onchange={onWipeBehaviorChange}
      >
        {#each WIPE_BEHAVIORS as behavior}
          <option value={behavior}>{wipeBehaviorLabel(behavior)}</option>
        {/each}
      </select>
    </label>
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

  .btn.active-toggle {
    border-color: var(--accent-dim);
    color: var(--accent);
  }

  .seg {
    display: inline-flex;
    border: 1px solid var(--border);
    border-radius: 3px;
    overflow: hidden;
  }

  .seg-btn {
    border: none;
    border-radius: 0;
    border-right: 1px solid var(--border);
    min-width: 44px;
    padding-left: 8px;
    padding-right: 8px;
    background: var(--bg);
    white-space: nowrap;
  }

  .seg-btn:last-child {
    border-right: none;
  }

  .seg-btn.active {
    background: var(--selected);
    color: var(--accent);
  }

  .seg-btn:hover:not(.active) {
    background: #1c2026;
  }

  .zoom-pct {
    min-width: 48px;
    text-align: center;
    font-variant-numeric: tabular-nums;
    font-size: 12px;
    color: var(--text-muted);
  }

  .size-mode select {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 3px;
    color: var(--text);
    font: inherit;
    font-size: 12px;
    padding: 4px 6px;
    max-width: 110px;
    cursor: pointer;
  }

  .size-mode select:hover:not(:disabled) {
    border-color: var(--border-strong);
  }

  .size-mode.disabled select,
  .size-mode select:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
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
