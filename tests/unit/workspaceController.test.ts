import { describe, expect, it } from 'vitest';
import {
  WorkspaceController,
  type ImportBatchProcessor,
} from '../../src/application/workspaceController';
import { duplicateKey } from '../../src/domain/importPolicy';
import type { ImageAsset } from '../../src/domain/model';
import type { PreparedAsset } from '../../src/application/importBatch';
import type {
  DiscoveredFile,
  EnumerationResult,
} from '../../src/infrastructure/browser/enumerateFiles';

interface Deferred<T> {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function discoveredFile(name: string): DiscoveredFile {
  return {
    file: new File([new Uint8Array([1])], name, {
      type: 'image/png',
      lastModified: 1,
    }),
    relativePath: name,
  };
}

function preparedAsset(
  item: DiscoveredFile,
  id: string,
  ordinal: number,
): PreparedAsset {
  const asset: ImageAsset = {
    id,
    name: item.file.name,
    relativePath: item.relativePath,
    mediaType: item.file.type,
    byteSize: item.file.size,
    lastModified: item.file.lastModified,
    width: 10,
    height: 10,
    importOrdinal: ordinal,
  };
  return {
    asset,
    file: item.file,
    originalUrl: `blob:${id}:original`,
    thumbnailUrl: `blob:${id}:thumbnail`,
  };
}

function discovery(name: string): EnumerationResult {
  return { files: [discoveredFile(name)], issues: [] };
}

function acceptingProcessor(processed: string[] = []): ImportBatchProcessor {
  return async (discovered, preIssues, options) => {
    processed.push(...discovered.map((item) => item.relativePath));
    return {
      prepared: discovered.map((item, index) =>
        preparedAsset(
          item,
          item.relativePath,
          options.startOrdinal + index,
        ),
      ),
      issues: [...preIssues],
      addedCount: discovered.length,
      skippedDuplicateCount: 0,
    };
  };
}

describe('WorkspaceController import queue', () => {
  it('serializes concurrent imports so duplicate checks see prior commits', async () => {
    const firstStarted = deferred<void>();
    let releaseFirst!: () => void;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    let calls = 0;

    const processor: ImportBatchProcessor = async (
      discovered,
      preIssues,
      options,
    ) => {
      calls += 1;
      if (calls === 1) {
        firstStarted.resolve(undefined);
        await firstGate;
      }

      const item = discovered[0]!;
      const key = duplicateKey(
        item.relativePath,
        item.file.size,
        item.file.lastModified,
      );
      if (options.existingDuplicateKeys.has(key)) {
        return {
          prepared: [],
          issues: [
            ...preIssues,
            { kind: 'duplicate-file', path: item.relativePath },
          ],
          addedCount: 0,
          skippedDuplicateCount: 1,
        };
      }

      return {
        prepared: [preparedAsset(item, `asset-${calls}`, options.startOrdinal)],
        issues: [...preIssues],
        addedCount: 1,
        skippedDuplicateCount: 0,
      };
    };

    const controller = new WorkspaceController(processor);
    const item = discoveredFile('same.png');
    const first = controller.importDiscovered([item]);
    const second = controller.importDiscovered([item]);

    expect(controller.isImporting()).toBe(true);
    await firstStarted.promise;
    expect(calls).toBe(1);

    releaseFirst();
    await Promise.all([first, second]);

    expect(calls).toBe(2);
    expect(controller.getWorkspace().imageSet.assets).toHaveLength(1);
    expect(controller.getImportSummary()?.issues[0]?.kind).toBe('duplicate-file');
    expect(controller.isImporting()).toBe(false);
    controller.destroy();
  });

  it('commits async discoveries in request order, not completion order', async () => {
    const processed: string[] = [];
    const controller = new WorkspaceController(acceptingProcessor(processed));
    const firstDiscovery = deferred<EnumerationResult>();
    const secondDiscovery = deferred<EnumerationResult>();

    const first = controller.importDiscovery(firstDiscovery.promise);
    const second = controller.importDiscovery(secondDiscovery.promise);

    secondDiscovery.resolve(discovery('a-second.png'));
    await Promise.resolve();
    expect(processed).toEqual([]);

    firstDiscovery.resolve(discovery('z-first.png'));
    await Promise.all([first, second]);

    expect(processed).toEqual(['z-first.png', 'a-second.png']);
    const assets = controller.getWorkspace().imageSet.assets;
    expect(
      Object.fromEntries(
        assets.map((asset) => [asset.relativePath, asset.importOrdinal]),
      ),
    ).toEqual({ 'z-first.png': 0, 'a-second.png': 1 });
    expect(controller.getWorkspace().selection.a).toBe('z-first.png');
    expect(controller.getWorkspace().selection.b).toBe('z-first.png');
    expect(controller.isImporting()).toBe(false);
    controller.destroy();
  });

  it('clear invalidates pending discovery and lets a fresh import proceed', async () => {
    const processed: string[] = [];
    const controller = new WorkspaceController(acceptingProcessor(processed));
    const staleDiscovery = deferred<EnumerationResult>();
    const stale = controller.importDiscovery(staleDiscovery.promise);

    expect(controller.isImporting()).toBe(true);
    // Let the queued job reach its discovery await before invalidating it.
    await Promise.resolve();
    controller.clear();
    expect(controller.isImporting()).toBe(false);

    await controller.importDiscovered([discoveredFile('after-clear.png')]);
    expect(processed).toEqual(['after-clear.png']);
    expect(controller.getWorkspace().selection.a).toBe('after-clear.png');

    staleDiscovery.resolve(discovery('stale.png'));
    await stale;
    expect(processed).toEqual(['after-clear.png']);
    expect(controller.getWorkspace().imageSet.assets).toHaveLength(1);
    expect(controller.getImportSummary()?.text).toBe('1 added');
    expect(controller.getAppError()).toBeNull();
    expect(controller.isImporting()).toBe(false);
    controller.destroy();
  });

  it('reports discovery failure without poisoning the import queue', async () => {
    const controller = new WorkspaceController(acceptingProcessor());

    await controller.importDiscovery(
      Promise.reject(new Error('Folder traversal failed')),
    );

    expect(controller.getAppError()).toEqual({
      kind: 'import',
      message: 'Folder traversal failed',
    });
    expect(controller.isImporting()).toBe(false);

    await controller.importDiscovered([discoveredFile('recovered.png')]);
    expect(controller.getWorkspace().imageSet.assets).toHaveLength(1);
    expect(controller.getAppError()).toBeNull();
    expect(controller.isImporting()).toBe(false);
    controller.destroy();
  });

  it('clear ends active side-tap', () => {
    const controller = new WorkspaceController();
    controller.beginSideTap();
    expect(controller.isSideTapping()).toBe(true);
    controller.clear();
    expect(controller.isSideTapping()).toBe(false);
    controller.destroy();
  });

  it('clear detaches active and queued imports from the next generation', async () => {
    const firstStarted = deferred<void>();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let calls = 0;

    const processor: ImportBatchProcessor = async (
      discovered,
      preIssues,
      options,
    ) => {
      calls += 1;
      if (calls === 1) {
        firstStarted.resolve(undefined);
        await gate;
      }
      return {
        prepared: [
          preparedAsset(discovered[0]!, `asset-${calls}`, options.startOrdinal),
        ],
        issues: [...preIssues],
        addedCount: 1,
        skippedDuplicateCount: 0,
      };
    };

    const controller = new WorkspaceController(processor);
    const active = controller.importDiscovered([discoveredFile('first.png')]);
    const queued = controller.importDiscovered([discoveredFile('second.png')]);
    await firstStarted.promise;

    controller.clear();
    expect(controller.isImporting()).toBe(false);

    await controller.importDiscovered([discoveredFile('after-clear.png')]);
    expect(calls).toBe(2);
    expect(controller.getWorkspace().imageSet.assets).toHaveLength(1);
    expect(controller.isImporting()).toBe(false);

    release();
    await Promise.all([active, queued]);
    expect(calls).toBe(2);
    expect(controller.getWorkspace().imageSet.assets).toHaveLength(1);
    expect(controller.getWorkspace().selection.a).toBe('asset-2');
    expect(controller.getAppError()).toBeNull();
    controller.destroy();
  });

  it('does not surface a stale processor failure after clear', async () => {
    const firstStarted = deferred<void>();
    const releaseFirst = deferred<void>();
    let calls = 0;
    const processor: ImportBatchProcessor = async (
      discovered,
      preIssues,
      options,
    ) => {
      calls += 1;
      if (calls === 1) {
        firstStarted.resolve(undefined);
        await releaseFirst.promise;
        throw new Error('stale failure');
      }
      return {
        prepared: [
          preparedAsset(discovered[0]!, 'fresh', options.startOrdinal),
        ],
        issues: [...preIssues],
        addedCount: 1,
        skippedDuplicateCount: 0,
      };
    };
    const controller = new WorkspaceController(processor);
    const stale = controller.importDiscovered([discoveredFile('stale.png')]);
    await firstStarted.promise;

    controller.clear();
    await controller.importDiscovered([discoveredFile('fresh.png')]);
    expect(controller.getAppError()).toBeNull();

    releaseFirst.resolve(undefined);
    await stale;
    expect(controller.getWorkspace().selection.a).toBe('fresh');
    expect(controller.getAppError()).toBeNull();
    controller.destroy();
  });
});
