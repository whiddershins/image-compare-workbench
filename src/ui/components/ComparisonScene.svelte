<script lang="ts">
  import type { CameraState, ImageAsset, ViewportSize } from '../../domain/model';
  import { cameraCssTransform } from '../../domain/geometry';

  interface Props {
    asset: ImageAsset | null;
    imageUrl: string | null;
    camera: CameraState;
    viewport: ViewportSize;
    loading?: boolean;
    error?: string | null;
    label: string;
  }

  let {
    asset,
    imageUrl,
    camera,
    viewport,
    loading = false,
    error = null,
    label,
  }: Props = $props();

  const transform = $derived(cameraCssTransform(camera, viewport));
  const w = $derived(asset?.width ?? 0);
  const h = $derived(asset?.height ?? 0);
</script>

<div class="scene" class:loading aria-label={`Side ${label}`}>
  {#if asset && imageUrl}
    <div class="world" style:transform style:transform-origin="0 0">
      <div
        class="image-plane"
        style:width="{w}px"
        style:height="{h}px"
        style:left="{-w / 2}px"
        style:top="{-h / 2}px"
      >
        <div class="checker" aria-hidden="true"></div>
        <img
          src={imageUrl}
          alt=""
          draggable="false"
          width={w}
          height={h}
          data-side={label.toLowerCase()}
        />
      </div>
    </div>
  {/if}
  {#if loading}
    <div class="overlay-msg" role="status">Loading…</div>
  {/if}
  {#if error}
    <div class="overlay-msg error" role="alert">{error}</div>
  {/if}
</div>

<style>
  .scene {
    position: absolute;
    inset: 0;
    overflow: hidden;
    background: #0e1013;
  }

  .scene.loading {
    opacity: 0.72;
  }

  .world {
    position: absolute;
    left: 0;
    top: 0;
    will-change: transform;
  }

  .image-plane {
    position: absolute;
  }

  .checker {
    position: absolute;
    inset: 0;
    background-color: var(--checker-a);
    background-image: linear-gradient(
        45deg,
        var(--checker-b) 25%,
        transparent 25%
      ),
      linear-gradient(-45deg, var(--checker-b) 25%, transparent 25%),
      linear-gradient(45deg, transparent 75%, var(--checker-b) 75%),
      linear-gradient(-45deg, transparent 75%, var(--checker-b) 75%);
    background-size: 16px 16px;
    background-position:
      0 0,
      0 8px,
      8px -8px,
      -8px 0;
  }

  img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    display: block;
    /* Preserve natural aspect; dimensions set via width/height attrs + CSS box */
    image-rendering: auto;
    pointer-events: none;
    user-select: none;
  }

  .overlay-msg {
    position: absolute;
    bottom: 28px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.65);
    padding: 4px 10px;
    border-radius: 3px;
    font-size: 11px;
    color: var(--text-muted);
    pointer-events: none;
  }

  .overlay-msg.error {
    color: #f0a0a0;
  }
</style>
