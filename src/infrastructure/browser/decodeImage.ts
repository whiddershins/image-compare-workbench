import { err, ok, type Result } from '../../domain/result';

export type DecodeSuccess = {
  readonly width: number;
  readonly height: number;
  readonly bitmap: ImageBitmap | null;
};

export type DecodeFailure = {
  readonly kind: 'decode-failed';
  readonly reason: string;
};

/**
 * Decode image dimensions (and optionally keep a bitmap for thumbnails).
 */
export async function decodeImageFile(
  file: File,
): Promise<Result<DecodeSuccess, DecodeFailure>> {
  try {
    if (typeof createImageBitmap === 'function') {
      const bitmap = await createImageBitmap(file);
      return ok({
        width: bitmap.width,
        height: bitmap.height,
        bitmap,
      });
    }
  } catch {
    // fall through to HTMLImageElement path
  }

  return decodeViaImageElement(file);
}

function decodeViaImageElement(
  file: File,
): Promise<Result<DecodeSuccess, DecodeFailure>> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const width = img.naturalWidth;
      const height = img.naturalHeight;
      URL.revokeObjectURL(url);
      if (width <= 0 || height <= 0) {
        resolve(err({ kind: 'decode-failed', reason: 'zero dimensions' }));
        return;
      }
      resolve(ok({ width, height, bitmap: null }));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(err({ kind: 'decode-failed', reason: 'image load failed' }));
    };
    img.src = url;
  });
}

export async function loadImageElement(
  url: string,
): Promise<Result<HTMLImageElement, DecodeFailure>> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(ok(img));
    img.onerror = () =>
      resolve(err({ kind: 'decode-failed', reason: 'image load failed' }));
    img.src = url;
  });
}
