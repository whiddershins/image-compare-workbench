import { err, ok, type Result } from '../../domain/result';

export const THUMBNAIL_MAX_EDGE = 256;

export type ThumbnailFailure = {
  readonly kind: 'thumbnail-failed';
  readonly reason: string;
};

/**
 * Create a bounded thumbnail blob preserving aspect ratio.
 */
export async function createThumbnailBlob(
  source: ImageBitmap | HTMLImageElement | File,
  maxEdge: number = THUMBNAIL_MAX_EDGE,
): Promise<Result<Blob, ThumbnailFailure>> {
  try {
    let width: number;
    let height: number;
    let drawSource: CanvasImageSource;

    if (source instanceof File) {
      if (typeof createImageBitmap === 'function') {
        const bitmap = await createImageBitmap(source);
        width = bitmap.width;
        height = bitmap.height;
        drawSource = bitmap;
        const result = await renderThumbnail(drawSource, width, height, maxEdge);
        bitmap.close();
        return result;
      }
      const url = URL.createObjectURL(source);
      try {
        const img = await loadImg(url);
        return await renderThumbnail(img, img.naturalWidth, img.naturalHeight, maxEdge);
      } finally {
        URL.revokeObjectURL(url);
      }
    }

    if (typeof ImageBitmap !== 'undefined' && source instanceof ImageBitmap) {
      width = source.width;
      height = source.height;
      drawSource = source;
    } else {
      const img = source as HTMLImageElement;
      width = img.naturalWidth || img.width;
      height = img.naturalHeight || img.height;
      drawSource = img;
    }

    return await renderThumbnail(drawSource, width, height, maxEdge);
  } catch (e) {
    const reason = e instanceof Error ? e.message : 'thumbnail failed';
    return err({ kind: 'thumbnail-failed', reason });
  }
}

async function renderThumbnail(
  source: CanvasImageSource,
  width: number,
  height: number,
  maxEdge: number,
): Promise<Result<Blob, ThumbnailFailure>> {
  if (width <= 0 || height <= 0) {
    return err({ kind: 'thumbnail-failed', reason: 'invalid dimensions' });
  }

  const scale = Math.min(1, maxEdge / Math.max(width, height));
  const tw = Math.max(1, Math.round(width * scale));
  const th = Math.max(1, Math.round(height * scale));

  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(tw, th);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return err({ kind: 'thumbnail-failed', reason: 'no 2d context' });
    }
    ctx.drawImage(source, 0, 0, tw, th);
    const blob = await canvas.convertToBlob({ type: 'image/webp', quality: 0.82 });
    return ok(blob);
  }

  const canvas = document.createElement('canvas');
  canvas.width = tw;
  canvas.height = th;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return err({ kind: 'thumbnail-failed', reason: 'no 2d context' });
  }
  ctx.drawImage(source, 0, 0, tw, th);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), 'image/webp', 0.82),
  );
  if (!blob) {
    // Safari sometimes rejects webp; fall back to png
    const png = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/png'),
    );
    if (!png) return err({ kind: 'thumbnail-failed', reason: 'toBlob failed' });
    return ok(png);
  }
  return ok(blob);
}

function loadImg(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image load failed'));
    img.src = url;
  });
}
