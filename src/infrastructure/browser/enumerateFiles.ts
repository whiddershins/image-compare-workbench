import type { ImportIssue } from '../../domain/model';

export interface DiscoveredFile {
  readonly file: File;
  readonly relativePath: string;
}

export interface EnumerationResult {
  readonly files: DiscoveredFile[];
  readonly issues: ImportIssue[];
}

/**
 * Normalize to slash-separated relative paths without leading slash.
 */
export function normalizeRelativePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\/+/, '');
}

/**
 * Enumerate files from a FileList or File[] (file picker / multi-file drop).
 * Uses webkitRelativePath when present (folder picker).
 */
export function enumerateFromFileList(
  list: ArrayLike<File>,
): EnumerationResult {
  const files: DiscoveredFile[] = [];
  for (let i = 0; i < list.length; i++) {
    const file = list[i]!;
    const rel =
      (file as File & { webkitRelativePath?: string }).webkitRelativePath ||
      file.name;
    files.push({
      file,
      relativePath: normalizeRelativePath(rel),
    });
  }
  return { files, issues: [] };
}

/**
 * Enumerate from a DataTransfer (drag-and-drop), including folders where supported.
 */
export async function enumerateFromDataTransfer(
  dataTransfer: DataTransfer,
): Promise<EnumerationResult> {
  const items = dataTransfer.items;
  if (items && items.length > 0) {
    const hasEntries = typeof items[0]?.webkitGetAsEntry === 'function';
    if (hasEntries) {
      return enumerateFromDataTransferItems(items);
    }
  }
  return enumerateFromFileList(dataTransfer.files);
}

async function enumerateFromDataTransferItems(
  items: DataTransferItemList,
): Promise<EnumerationResult> {
  const files: DiscoveredFile[] = [];
  const issues: ImportIssue[] = [];
  const entryPromises: Promise<void>[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
    const entry = item.webkitGetAsEntry?.() ?? null;
    if (entry) {
      entryPromises.push(traverseEntry(entry, '', files, issues));
    } else {
      const file = item.getAsFile();
      if (file) {
        files.push({
          file,
          relativePath: normalizeRelativePath(file.name),
        });
      }
    }
  }

  await Promise.all(entryPromises);
  return { files, issues };
}

async function traverseEntry(
  entry: FileSystemEntry,
  parentPath: string,
  out: DiscoveredFile[],
  issues: ImportIssue[],
): Promise<void> {
  const path = parentPath
    ? `${parentPath}/${entry.name}`
    : entry.name;

  if (entry.isFile) {
    try {
      const file = await readFileEntry(entry as FileSystemFileEntry);
      out.push({
        file,
        relativePath: normalizeRelativePath(path),
      });
    } catch (e) {
      issues.push({
        kind: 'directory-unreadable',
        path,
        reason: e instanceof Error ? e.message : 'unreadable file',
      });
    }
    return;
  }

  if (entry.isDirectory) {
    try {
      const dir = entry as FileSystemDirectoryEntry;
      const reader = dir.createReader();
      // Read until empty batch (spec requirement)
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const batch = await readEntriesBatch(reader);
        if (batch.length === 0) break;
        await Promise.all(
          batch.map((child) => traverseEntry(child, path, out, issues)),
        );
      }
    } catch (e) {
      issues.push({
        kind: 'directory-unreadable',
        path,
        reason: e instanceof Error ? e.message : 'unreadable directory',
      });
    }
  }
}

function readFileEntry(entry: FileSystemFileEntry): Promise<File> {
  return new Promise((resolve, reject) => {
    entry.file(resolve, reject);
  });
}

function readEntriesBatch(
  reader: FileSystemDirectoryReader,
): Promise<FileSystemEntry[]> {
  return new Promise((resolve, reject) => {
    reader.readEntries(resolve, reject);
  });
}

export function supportsDirectoryPicker(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

export function supportsWebkitDirectory(): boolean {
  if (typeof document === 'undefined') return false;
  const input = document.createElement('input');
  return 'webkitdirectory' in input;
}

export async function pickDirectoryFiles(): Promise<EnumerationResult> {
  if (supportsDirectoryPicker()) {
    try {
      // File System Access API
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handle = await (window as any).showDirectoryPicker();
      const files: DiscoveredFile[] = [];
      const issues: ImportIssue[] = [];
      await walkHandle(handle, handle.name, files, issues);
      return { files, issues };
    } catch (e) {
      // User cancel is not an error
      if (e instanceof DOMException && e.name === 'AbortError') {
        return { files: [], issues: [] };
      }
      return {
        files: [],
        issues: [
          {
            kind: 'directory-unreadable',
            path: '',
            reason: e instanceof Error ? e.message : 'directory picker failed',
          },
        ],
      };
    }
  }
  return { files: [], issues: [] };
}

async function walkHandle(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dirHandle: any,
  basePath: string,
  out: DiscoveredFile[],
  issues: ImportIssue[],
): Promise<void> {
  try {
    for await (const [name, handle] of dirHandle.entries()) {
      const path = `${basePath}/${name}`;
      if (handle.kind === 'file') {
        try {
          const file = await handle.getFile();
          out.push({ file, relativePath: normalizeRelativePath(path) });
        } catch (e) {
          issues.push({
            kind: 'directory-unreadable',
            path,
            reason: e instanceof Error ? e.message : 'unreadable file',
          });
        }
      } else if (handle.kind === 'directory') {
        await walkHandle(handle, path, out, issues);
      }
    }
  } catch (e) {
    issues.push({
      kind: 'directory-unreadable',
      path: basePath,
      reason: e instanceof Error ? e.message : 'unreadable directory',
    });
  }
}
