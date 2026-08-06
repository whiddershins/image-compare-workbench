<script lang="ts">
  interface Props {
    open: boolean;
    onclose: () => void;
  }
  let { open, onclose }: Props = $props();

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') onclose();
  }
</script>

{#if open}
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
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
        <div><dt>F</dt><dd>Fit current pair</dd></div>
        <div><dt>0</dt><dd>100% zoom</dd></div>
        <div><dt>− / =</dt><dd>Zoom out / in</dd></div>
        <div><dt>Space + drag</dt><dd>Pan</dd></div>
        <div><dt>?</dt><dd>This help</dd></div>
        <div><dt>Wipe ← →</dt><dd>Adjust wipe when focused</dd></div>
      </dl>
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
</style>
