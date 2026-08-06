import type { ImageAsset, ImportIssue } from '../domain/model';
import { evaluateFileSupport, duplicateKey } from '../domain/importPolicy';
import {
  AssetResourceRegistry,
  type UrlAdapter,
  browserUrlAdapter,
} from '../infrastructure/browser/assetResourceRegistry';
import { decodeImageFile } from '../infrastructure/browser/decodeImage';
import { createThumbnailBlob } from '../infrastructure/browser/createThumbnail';
import type { DiscoveredFile } from '../infrastructure/browser/enumerateFiles';

const DECODE_CONCURRENCY = 4;

export interface PreparedAsset {
  readonly asset: ImageAsset;
  readonly file: File;
  readonly originalUrl: string;
  readonly thumbnailUrl: string;
}

export interface ImportBatchResult {
  readonly prepared: PreparedAsset[];
  readonly issues: ImportIssue[];
  readonly addedCount: number;
  readonly skippedDuplicateCount: number;
}

export interface ImportBatchOptions {
  readonly existingDuplicateKeys: ReadonlySet<string>;
  readonly startOrdinal: number;
  readonly idFactory?: () => string;
  readonly urlAdapter?: UrlAdapter;
  readonly concurrency?: number;
  /** Generation token; if changed mid-batch, skip registering further assets. */
  readonly isCancelled?: () => boolean;
}

function defaultIdFactory(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `asset-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Process discovered files: support check, duplicate skip, decode, thumbnail.
 * Partial success — valid assets are returned even if some fail.
 */
export async function processImportBatch(
  discovered: readonly DiscoveredFile[],
  preIssues: readonly ImportIssue[],
  options: ImportBatchOptions,
): Promise<ImportBatchResult> {
  const issues: ImportIssue[] = [...preIssues];
  const prepared: PreparedAsset[] = [];
  const seenKeys = new Set(options.existingDuplicateKeys);
  const idFactory = options.idFactory ?? defaultIdFactory;
  const urlAdapter = options.urlAdapter ?? browserUrlAdapter;
  const concurrency = options.concurrency ?? DECODE_CONCURRENCY;
  let ordinal = options.startOrdinal;
  let skippedDuplicateCount = 0;

  type Candidate = {
    file: File;
    relativePath: string;
    ordinal: number;
  };

  const candidates: Candidate[] = [];

  for (const item of discovered) {
    const support = evaluateFileSupport(item.relativePath, item.file.type || null);
    if (!support.ok) {
      issues.push(support.error);
      continue;
    }
    const key = duplicateKey(
      item.relativePath,
      item.file.size,
      item.file.lastModified,
    );
    if (seenKeys.has(key)) {
      skippedDuplicateCount += 1;
      issues.push({ kind: 'duplicate-file', path: item.relativePath });
      continue;
    }
    seenKeys.add(key);
    candidates.push({
      file: item.file,
      relativePath: item.relativePath,
      ordinal: ordinal++,
    });
  }

  let index = 0;

  async function worker(): Promise<void> {
    while (index < candidates.length) {
      if (options.isCancelled?.()) return;
      const current = candidates[index++]!;
      const result = await processOne(current, idFactory, urlAdapter);
      if (options.isCancelled?.()) {
        // Dispose any URL we just created if cancelled
        if (result.prepared) {
          urlAdapter.revokeObjectURL(result.prepared.originalUrl);
          if (result.prepared.thumbnailUrl !== result.prepared.originalUrl) {
            urlAdapter.revokeObjectURL(result.prepared.thumbnailUrl);
          }
        }
        return;
      }
      if (result.prepared) prepared.push(result.prepared);
      if (result.issue) issues.push(result.issue);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, Math.max(1, candidates.length)) },
    () => worker(),
  );
  await Promise.all(workers);

  return {
    prepared,
    issues,
    addedCount: prepared.length,
    skippedDuplicateCount,
  };
}

async function processOne(
  candidate: { file: File; relativePath: string; ordinal: number },
  idFactory: () => string,
  urlAdapter: UrlAdapter,
): Promise<{ prepared?: PreparedAsset; issue?: ImportIssue }> {
  const decode = await decodeImageFile(candidate.file);
  if (!decode.ok) {
    return {
      issue: {
        kind: 'decode-failed',
        path: candidate.relativePath,
        reason: decode.error.reason,
      },
    };
  }

  const { width, height, bitmap } = decode.value;
  const thumbSource = bitmap ?? candidate.file;
  const thumb = await createThumbnailBlob(thumbSource);
  if (bitmap) bitmap.close();

  if (!thumb.ok) {
    return {
      issue: {
        kind: 'thumbnail-failed',
        path: candidate.relativePath,
        reason: thumb.error.reason,
      },
    };
  }

  const originalUrl = urlAdapter.createObjectURL(candidate.file);
  const thumbnailUrl = urlAdapter.createObjectURL(thumb.value);
  const name =
    candidate.relativePath.split('/').pop() ?? candidate.relativePath;
  const id = idFactory();

  const asset: ImageAsset = {
    id,
    name,
    relativePath: candidate.relativePath,
    mediaType: candidate.file.type || null,
    byteSize: candidate.file.size,
    lastModified: candidate.file.lastModified,
    width,
    height,
    importOrdinal: candidate.ordinal,
  };

  return {
    prepared: {
      asset,
      file: candidate.file,
      originalUrl,
      thumbnailUrl,
    },
  };
}

/**
 * Register prepared assets into the resource registry.
 * Skips assets whose IDs were already disposed (stale generation).
 */
export function registerPreparedAssets(
  registry: AssetResourceRegistry,
  prepared: readonly PreparedAsset[],
): ImageAsset[] {
  const accepted: ImageAsset[] = [];
  for (const p of prepared) {
    if (registry.wasDisposed(p.asset.id)) {
      // Stale — revoke URLs we still hold
      URL.revokeObjectURL(p.originalUrl);
      if (p.thumbnailUrl !== p.originalUrl) {
        URL.revokeObjectURL(p.thumbnailUrl);
      }
      continue;
    }
    registry.register(p.asset.id, p.file, p.originalUrl, p.thumbnailUrl);
    accepted.push(p.asset);
  }
  return accepted;
}

export function buildDuplicateKeySet(
  assets: readonly ImageAsset[],
): Set<string> {
  const set = new Set<string>();
  for (const a of assets) {
    set.add(duplicateKey(a.relativePath, a.byteSize, a.lastModified));
  }
  return set;
}
