import { describe, expect, it } from 'vitest';
import {
  duplicateKey,
  evaluateFileSupport,
  isSupportedImage,
  summarizeImportIssues,
} from '../../src/domain/importPolicy';
import type { ImportIssue } from '../../src/domain/model';

describe('import policy', () => {
  it('matches extensions case-insensitively', () => {
    expect(isSupportedImage('Photo.JPG', '')).toBe(true);
    expect(isSupportedImage('x.PnG', null)).toBe(true);
    expect(isSupportedImage('x.WEBP', undefined)).toBe(true);
  });

  it('empty MIME falls back to extension', () => {
    expect(isSupportedImage('a.gif', '')).toBe(true);
    expect(isSupportedImage('a.txt', '')).toBe(false);
  });

  it('rejects SVG and unsupported types', () => {
    expect(isSupportedImage('a.svg', 'image/svg+xml')).toBe(false);
    expect(evaluateFileSupport('a.pdf', 'application/pdf').ok).toBe(false);
  });

  it('accepts known MIME types', () => {
    expect(isSupportedImage('x', 'image/png')).toBe(true);
    expect(isSupportedImage('x', 'image/jpeg')).toBe(true);
  });

  it('duplicate key is distinct from asset identity', () => {
    const k1 = duplicateKey('shot/a.png', 100, 50);
    const k2 = duplicateKey('shot/a.png', 100, 50);
    const k3 = duplicateKey('shot/a.png', 101, 50);
    expect(k1).toBe(k2);
    expect(k1).not.toBe(k3);
  });

  it('summarizes partial import issues', () => {
    const issues: ImportIssue[] = [
      { kind: 'unsupported-file', path: 'a.txt' },
      { kind: 'duplicate-file', path: 'b.png' },
      { kind: 'unsupported-file', path: 'c.doc' },
    ];
    const text = summarizeImportIssues(issues);
    expect(text).toContain('2 unsupported');
    expect(text).toContain('1 duplicate');
  });
});
