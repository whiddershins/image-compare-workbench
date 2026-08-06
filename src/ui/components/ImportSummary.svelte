<script lang="ts">
  interface Props {
    text: string | null;
  }
  let { text }: Props = $props();
</script>

{#if text}
  <span class="summary" role="status">{text}</span>
{/if}

<style>
  .summary {
    color: var(--text-muted);
  }
</style>
