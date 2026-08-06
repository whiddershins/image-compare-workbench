import { err, ok, type Result } from '../../domain/result';
import type { AssetId } from '../../domain/model';

export type ResourceError = {
  readonly kind: 'missing-resource';
  readonly assetId: AssetId;
};

export interface UrlAdapter {
  createObjectURL(blob: Blob): string;
  revokeObjectURL(url: string): void;
}

export const browserUrlAdapter: UrlAdapter = {
  createObjectURL: (blob) => URL.createObjectURL(blob),
  revokeObjectURL: (url) => URL.revokeObjectURL(url),
};

export interface ImageAssetResources {
  readonly file: File;
  readonly originalUrl: string;
  readonly thumbnailUrl: string;
  dispose(): void;
}

export class AssetResourceRegistry {
  private readonly map = new Map<AssetId, ImageAssetResources>();
  private readonly urlAdapter: UrlAdapter;
  private disposedIds = new Set<AssetId>();

  constructor(urlAdapter: UrlAdapter = browserUrlAdapter) {
    this.urlAdapter = urlAdapter;
  }

  register(
    assetId: AssetId,
    file: File,
    originalUrl: string,
    thumbnailUrl: string,
  ): ImageAssetResources {
    // If re-registering same id (shouldn't happen), dispose old first
    const existing = this.map.get(assetId);
    if (existing) existing.dispose();

    let disposed = false;
    const resources: ImageAssetResources = {
      file,
      originalUrl,
      thumbnailUrl,
      dispose: () => {
        if (disposed) return;
        disposed = true;
        this.urlAdapter.revokeObjectURL(originalUrl);
        if (thumbnailUrl !== originalUrl) {
          this.urlAdapter.revokeObjectURL(thumbnailUrl);
        }
        this.map.delete(assetId);
        this.disposedIds.add(assetId);
      },
    };
    this.map.set(assetId, resources);
    this.disposedIds.delete(assetId);
    return resources;
  }

  get(assetId: AssetId): Result<ImageAssetResources, ResourceError> {
    const res = this.map.get(assetId);
    if (!res) return err({ kind: 'missing-resource', assetId });
    return ok(res);
  }

  has(assetId: AssetId): boolean {
    return this.map.has(assetId);
  }

  wasDisposed(assetId: AssetId): boolean {
    return this.disposedIds.has(assetId);
  }

  dispose(assetId: AssetId): void {
    this.map.get(assetId)?.dispose();
  }

  clear(): void {
    const ids = [...this.map.keys()];
    for (const id of ids) {
      this.map.get(id)?.dispose();
    }
    this.map.clear();
  }

  size(): number {
    return this.map.size;
  }
}
