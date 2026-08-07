import { describe, expect, it } from 'vitest';
import {
  WorkspaceController,
  type ImportBatchProcessor,
} from '../../src/application/workspaceController';
import { duplicateKey } from '../../src/domain/importPolicy';
import type { ImageAsset } from '../../src/domain/model';
import type { PreparedAsset } from '../../src/application/importBatch';
import type { DiscoveredFile } from '../../src/infrastructure/browser/enumerateFiles';

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

describe('WorkspaceController import queue', () => {
  it('serializes concurrent imports so duplicate checks see prior commits', async () => {
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
      if (calls === 1) await firstGate;

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
    await Promise.resolve();
    expect(calls).toBe(1);

    releaseFirst();
    await Promise.all([first, second]);

    expect(calls).toBe(2);
    expect(controller.getWorkspace().imageSet.assets).toHaveLength(1);
    expect(controller.getImportSummary()?.issues[0]?.kind).toBe('duplicate-file');
    expect(controller.isImporting()).toBe(false);
    controller.destroy();
  });

  it('clear cancels active and queued imports without leaving loading stale', async () => {
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
      await gate;
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
    await Promise.resolve();

    controller.clear();
    expect(controller.isImporting()).toBe(false);

    release();
    await Promise.all([active, queued]);
    expect(calls).toBe(1);
    expect(controller.getWorkspace().imageSet.assets).toHaveLength(0);

    await controller.importDiscovered([discoveredFile('after-clear.png')]);
    expect(calls).toBe(2);
    expect(controller.getWorkspace().imageSet.assets).toHaveLength(1);
    expect(controller.isImporting()).toBe(false);
    controller.destroy();
  });
});
