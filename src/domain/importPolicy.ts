import type { ImportIssue } from './model';
import { err, ok, type Result } from './result';

const SUPPORTED_EXTENSIONS = new Set([
  'jpg',
  'jpeg',
  'png',
  'webp',
  'gif',
  'avif',
]);

const SUPPORTED_MIME_PREFIXES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
];

export function extensionOf(path: string): string {
  const base = path.split(/[/\\]/).pop() ?? path;
  const dot = base.lastIndexOf('.');
  if (dot <= 0) return '';
  return base.slice(dot + 1).toLowerCase();
}

export function isSupportedImage(
  path: string,
  mediaType: string | null | undefined,
): boolean {
  const mime = (mediaType ?? '').toLowerCase().trim();
  if (mime.startsWith('image/svg')) return false;
  if (mime && SUPPORTED_MIME_PREFIXES.some((p) => mime === p || mime.startsWith(p + ';'))) {
    return true;
  }
  const ext = extensionOf(path);
  return SUPPORTED_EXTENSIONS.has(ext);
}

export function evaluateFileSupport(
  path: string,
  mediaType: string | null | undefined,
): Result<void, ImportIssue> {
  if (!isSupportedImage(path, mediaType)) {
    return err({ kind: 'unsupported-file', path });
  }
  return ok(undefined);
}

/**
 * Best-effort same-session duplicate key. Not the asset ID.
 */
export function duplicateKey(
  relativePath: string,
  byteSize: number,
  lastModified: number,
): string {
  const normalized = relativePath.replace(/\\/g, '/').normalize('NFC');
  return `${normalized}\0${byteSize}\0${lastModified}`;
}

export function summarizeImportIssues(issues: readonly ImportIssue[]): string {
  if (issues.length === 0) return '';
  const counts: Record<string, number> = {};
  for (const issue of issues) {
    counts[issue.kind] = (counts[issue.kind] ?? 0) + 1;
  }
  const labels: Record<string, string> = {
    'unsupported-file': 'unsupported',
    'duplicate-file': 'duplicate',
    'decode-failed': 'decode failed',
    'thumbnail-failed': 'thumbnail failed',
    'directory-unreadable': 'unreadable',
  };
  return Object.entries(counts)
    .map(([kind, n]) => `${n} ${labels[kind] ?? kind}`)
    .join(' · ');
}
