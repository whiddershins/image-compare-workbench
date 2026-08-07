<script lang="ts">
  interface Props {
    open: boolean;
    onclose: () => void;
  }
  let { open, onclose }: Props = $props();
  let dialogEl: HTMLDivElement | undefined = $state();

  $effect(() => {
    if (!open || !dialogEl) return;
    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    dialogEl.focus();
    return () => previousFocus?.focus();
  });

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') onclose();
  }
</script>

{#if open}
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
    bind:this={dialogEl}
    class="backdrop"
    role="dialog"
    aria-modal="true"
    aria-label="Keyboard shortcuts"
    tabindex="-1"
    onkeydown={onKey}
    onclick={(e) => {
      if (e.target === e.currentTarget) onclose();
    }}
  >
    <div class="panel">
      <header>
        <h2>Keyboard shortcuts</h2>
        <button type="button" class="close" onclick={onclose} aria-label="Close">
          ×
        </button>
      </header>
      <dl>
        <div><dt>A / B</dt><dd>Activate side A or B</dd></div>
        <div><dt>↑ / ↓</dt><dd>Previous / next image on active side</dd></div>
        <div><dt>S</dt><dd>Swap A and B</dd></div>
        <div><dt>Full A / Wipe</dt><dd>Sticky view (mutually exclusive)</dd></div>
        <div><dt>Hold V / Peek</dt><dd>Momentary full B; release restores</dd></div>
        <div><dt>F</dt><dd>Fit current pair</dd></div>
        <div><dt>0</dt><dd>100% zoom</dd></div>
        <div><dt>− / =</dt><dd>Zoom out / in</dd></div>
        <div><dt>Space + drag</dt><dd>Pan</dd></div>
        <div><dt>?</dt><dd>This help</dd></div>
        <div><dt>Wipe ← →</dt><dd>Adjust wipe when focused</dd></div>
      </dl>
      <h3>Size normalization</h3>
      <p class="note">
        Two orthogonal controls: <strong>basis</strong> (native / height / width /
        max edge) and <strong>reference</strong> (both-max / lock A / lock B).
        Lock A keeps A native and scales B to the chosen dimension — good when
        cycling B. Changing size refits the pair; selection does not move the camera.
      </p>
      <h3>Rails</h3>
      <p class="note">
        An image already selected on the other side appears muted (50%). Click it
        to <strong>swap A and B</strong>. Toolbar <strong>⇄ Swap</strong> does the
        same (shortcut S).
      </p>
      <h3>View mode</h3>
      <p class="note">
        <strong>Full A</strong> and <strong>Wipe</strong> are sticky and mutually
        exclusive. <strong>Peek</strong> (hold toolbar button or <strong>V</strong>)
        always shows full B while held, then returns to Full A or Wipe.
      </p>
      <h3>Wipe lock</h3>
      <p class="note">
        <strong>Wipe img</strong> (default): the divider tracks a fixed place on the
        images through pan and zoom.
        <strong>Wipe scr</strong>: the divider stays fixed in the viewport (content
        slides under it). Toggle on the toolbar.
      </p>
    </div>
  </div>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.55);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
  }

  .panel {
    background: var(--bg-elevated);
    border: 1px solid var(--border-strong);
    border-radius: 6px;
    padding: 16px 20px 20px;
    min-width: 320px;
    max-width: 90vw;
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
  }

  h2 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
  }

  .close {
    background: transparent;
    border: none;
    font-size: 20px;
    line-height: 1;
    color: var(--text-muted);
    padding: 0 4px;
  }

  dl {
    margin: 0;
    display: grid;
    gap: 8px;
  }

  dl div {
    display: grid;
    grid-template-columns: 110px 1fr;
    gap: 8px;
    font-size: 12px;
  }

  dt {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    color: var(--accent);
  }

  dd {
    margin: 0;
    color: var(--text-muted);
  }

  h3 {
    margin: 16px 0 8px;
    font-size: 12px;
    font-weight: 600;
    color: var(--text);
  }

  .note {
    margin: 0;
    font-size: 12px;
    color: var(--text-muted);
    line-height: 1.45;
  }
</style>
