import type {
  AssetId,
  ImportIssue,
  Side,
  SizeNormalizationMode,
  ViewportSize,
  WipeLock,
  Workspace,
} from '../domain/model';
import { emptyWorkspace, isEmpty } from '../domain/workspaceTransitions';
import {
  appendAssets,
  clearWorkspace as clearDomain,
  cycleSelection,
  selectAsset,
  setActiveSide,
  setSizeNormalization,
  swapSelections,
} from '../domain/workspaceTransitions';
import { setWipeFromViewportPosition, setWipeLock } from '../domain/wipe';
import {
  fitCurrentPair,
  panWorkspace,
  setCamera100Percent,
  zoomWorkspaceAtPoint,
  zoomWorkspaceCenter,
} from '../domain/camera';
import type { Point } from '../domain/model';
import { summarizeImportIssues } from '../domain/importPolicy';
import { AssetResourceRegistry } from '../infrastructure/browser/assetResourceRegistry';
import {
  buildDuplicateKeySet,
  processImportBatch,
  registerPreparedAssets,
} from './importBatch';
import type { DiscoveredFile } from '../infrastructure/browser/enumerateFiles';
import { SelectionLoader } from './selectionLoader';

export type AppError =
  | { readonly kind: 'selection'; readonly message: string }
  | { readonly kind: 'import'; readonly message: string }
  | { readonly kind: 'unexpected'; readonly message: string };

export interface ImportSummary {
  readonly added: number;
  readonly issues: readonly ImportIssue[];
  readonly text: string;
}

export type WorkspaceListener = (workspace: Workspace) => void;
export type SummaryListener = (summary: ImportSummary | null) => void;
export type ErrorListener = (error: AppError | null) => void;
export type LoadingListener = (loading: boolean) => void;
export type SelectionLoadListener = () => void;

/**
 * Effectful application controller: owns resource registry, selection loader,
 * and applies pure domain transitions.
 */
export class WorkspaceController {
  private workspace: Workspace = emptyWorkspace();
  private generation = 0;
  readonly registry = new AssetResourceRegistry();
  readonly selectionLoader = new SelectionLoader();
  private importSummary: ImportSummary | null = null;
  private appError: AppError | null = null;
  private importing = false;
  private needsInitialFit = false;

  private workspaceListeners = new Set<WorkspaceListener>();
  private summaryListeners = new Set<SummaryListener>();
  private errorListeners = new Set<ErrorListener>();
  private loadingListeners = new Set<LoadingListener>();
  private selectionLoadListeners = new Set<SelectionLoadListener>();

  getWorkspace(): Workspace {
    return this.workspace;
  }

  getImportSummary(): ImportSummary | null {
    return this.importSummary;
  }

  getAppError(): AppError | null {
    return this.appError;
  }

  isImporting(): boolean {
    return this.importing;
  }

  consumeNeedsInitialFit(): boolean {
    const v = this.needsInitialFit;
    this.needsInitialFit = false;
    return v;
  }

  peekNeedsInitialFit(): boolean {
    return this.needsInitialFit;
  }

  subscribe(listener: WorkspaceListener): () => void {
    this.workspaceListeners.add(listener);
    return () => this.workspaceListeners.delete(listener);
  }

  subscribeSummary(listener: SummaryListener): () => void {
    this.summaryListeners.add(listener);
    return () => this.summaryListeners.delete(listener);
  }

  subscribeError(listener: ErrorListener): () => void {
    this.errorListeners.add(listener);
    return () => this.errorListeners.delete(listener);
  }

  subscribeLoading(listener: LoadingListener): () => void {
    this.loadingListeners.add(listener);
    return () => this.loadingListeners.delete(listener);
  }

  subscribeSelectionLoad(listener: SelectionLoadListener): () => void {
    this.selectionLoadListeners.add(listener);
    return () => this.selectionLoadListeners.delete(listener);
  }

  private emitWorkspace(): void {
    for (const l of this.workspaceListeners) l(this.workspace);
  }

  private emitSummary(): void {
    for (const l of this.summaryListeners) l(this.importSummary);
  }

  private emitError(): void {
    for (const l of this.errorListeners) l(this.appError);
  }

  private emitLoading(): void {
    for (const l of this.loadingListeners) l(this.importing);
  }

  private emitSelectionLoad(): void {
    for (const l of this.selectionLoadListeners) l();
  }

  private setWorkspace(next: Workspace): void {
    this.workspace = next;
    this.emitWorkspace();
  }

  private setError(error: AppError | null): void {
    this.appError = error;
    this.emitError();
  }

  async importDiscovered(
    discovered: readonly DiscoveredFile[],
    preIssues: readonly ImportIssue[] = [],
  ): Promise<void> {
    if (discovered.length === 0 && preIssues.length === 0) return;

    const gen = this.generation;
    const wasEmpty = isEmpty(this.workspace);
    this.importing = true;
    this.emitLoading();
    this.setError(null);

    try {
      const existingKeys = buildDuplicateKeySet(this.workspace.imageSet.assets);
      const startOrdinal =
        this.workspace.imageSet.assets.reduce(
          (m, a) => Math.max(m, a.importOrdinal),
          -1,
        ) + 1;

      const batch = await processImportBatch(discovered, preIssues, {
        existingDuplicateKeys: existingKeys,
        startOrdinal,
        isCancelled: () => this.generation !== gen,
      });

      if (this.generation !== gen) {
        // Dispose any prepared URLs
        for (const p of batch.prepared) {
          URL.revokeObjectURL(p.originalUrl);
          if (p.thumbnailUrl !== p.originalUrl) {
            URL.revokeObjectURL(p.thumbnailUrl);
          }
        }
        return;
      }

      const assets = registerPreparedAssets(this.registry, batch.prepared);
      if (assets.length > 0) {
        const next = appendAssets(this.workspace, assets);
        this.setWorkspace(next);
        if (wasEmpty) {
          this.needsInitialFit = true;
          this.syncSelectionLoads();
        }
      }

      const parts: string[] = [];
      if (batch.addedCount > 0) parts.push(`${batch.addedCount} added`);
      const issueText = summarizeImportIssues(batch.issues);
      if (issueText) parts.push(issueText);
      this.importSummary =
        parts.length > 0
          ? {
              added: batch.addedCount,
              issues: batch.issues,
              text: parts.join(' · '),
            }
          : null;
      this.emitSummary();
    } catch (e) {
      this.setError({
        kind: 'unexpected',
        message: e instanceof Error ? e.message : 'Import failed',
      });
    } finally {
      if (this.generation === gen) {
        this.importing = false;
        this.emitLoading();
      }
    }
  }

  clear(): void {
    this.generation += 1;
    this.selectionLoader.reset();
    this.setWorkspace(clearDomain());
    this.registry.clear();
    this.needsInitialFit = false;
    this.importSummary = null;
    this.emitSummary();
    this.setError(null);
    this.emitSelectionLoad();
  }

  select(side: Side, assetId: AssetId): void {
    const result = selectAsset(this.workspace, side, assetId);
    if (!result.ok) {
      this.setError({
        kind: 'selection',
        message:
          result.error.kind === 'unknown-asset'
            ? 'Unknown image'
            : 'No images loaded',
      });
      return;
    }
    this.setWorkspace(result.value);
    this.beginSideLoad(side, assetId);
  }

  setActive(side: Side): void {
    this.setWorkspace(setActiveSide(this.workspace, side));
  }

  cycle(side: Side, delta: number): void {
    const next = cycleSelection(this.workspace, side, delta);
    const prevId = this.workspace.selection[side];
    const nextId = next.selection[side];
    this.setWorkspace(next);
    if (nextId && nextId !== prevId) {
      this.beginSideLoad(side, nextId);
    }
  }

  swap(): void {
    this.setWorkspace(swapSelections(this.workspace));
    // Both sides may need to show the other's URL — sync loads from registry
    this.syncSelectionLoads();
  }

  /**
   * Set wipe from a viewport-normalized position (0–1).
   * Updates both screen cache and worldX when camera+viewport are known.
   */
  setWipe(position: number, viewport?: ViewportSize): void {
    const vp =
      viewport ??
      ({ width: 0, height: 0 } satisfies ViewportSize);
    this.setWorkspace(setWipeFromViewportPosition(this.workspace, position, vp));
  }

  setWipeLock(lock: WipeLock, viewport: ViewportSize): void {
    this.setWorkspace(setWipeLock(this.workspace, lock, viewport));
  }

  /**
   * Change size normalization. Optionally refit the pair so the new
   * placement is visible (recommended after an explicit mode change).
   */
  setSizeNormalization(
    mode: SizeNormalizationMode,
    viewport?: ViewportSize,
  ): void {
    let next = setSizeNormalization(this.workspace, mode);
    if (
      viewport &&
      viewport.width > 0 &&
      viewport.height > 0 &&
      next.imageSet.assets.length > 0
    ) {
      next = fitCurrentPair(next, viewport);
    }
    this.setWorkspace(next);
  }

  fit(viewport: ViewportSize): void {
    this.setWorkspace(fitCurrentPair(this.workspace, viewport));
  }

  applyInitialFitIfNeeded(viewport: ViewportSize): void {
    if (!this.needsInitialFit) return;
    if (viewport.width <= 0 || viewport.height <= 0) return;
    this.needsInitialFit = false;
    this.setWorkspace(fitCurrentPair(this.workspace, viewport));
  }

  zoom100(): void {
    this.setWorkspace(setCamera100Percent(this.workspace));
  }

  zoomIn(viewport?: ViewportSize, point?: Point): void {
    if (viewport && point) {
      this.setWorkspace(
        zoomWorkspaceAtPoint(this.workspace, viewport, point, 1.25),
      );
    } else {
      this.setWorkspace(zoomWorkspaceCenter(this.workspace, 1.25));
    }
  }

  zoomOut(viewport?: ViewportSize, point?: Point): void {
    if (viewport && point) {
      this.setWorkspace(
        zoomWorkspaceAtPoint(this.workspace, viewport, point, 1 / 1.25),
      );
    } else {
      this.setWorkspace(zoomWorkspaceCenter(this.workspace, 1 / 1.25));
    }
  }

  zoomAt(viewport: ViewportSize, point: Point, factor: number): void {
    this.setWorkspace(
      zoomWorkspaceAtPoint(this.workspace, viewport, point, factor),
    );
  }

  pan(dx: number, dy: number): void {
    this.setWorkspace(panWorkspace(this.workspace, dx, dy));
  }

  private beginSideLoad(side: Side, assetId: AssetId): void {
    const token = this.selectionLoader.begin(side, assetId);
    this.emitSelectionLoad();
    const res = this.registry.get(assetId);
    if (!res.ok) {
      this.selectionLoader.fail(side, token, assetId, 'Missing image resource');
      this.emitSelectionLoad();
      return;
    }
    // Object URLs are immediately available; still go through token check
    // for race-safety when cycling faster than paint.
    queueMicrotask(() => {
      if (!this.selectionLoader.isCurrent(side, token)) return;
      this.selectionLoader.complete(side, token, assetId, res.value.originalUrl);
      this.emitSelectionLoad();
    });
  }

  syncSelectionLoads(): void {
    const { a, b } = this.workspace.selection;
    if (a) this.beginSideLoad('a', a);
    if (b) this.beginSideLoad('b', b);
  }

  destroy(): void {
    this.generation += 1;
    this.registry.clear();
    this.workspaceListeners.clear();
    this.summaryListeners.clear();
    this.errorListeners.clear();
    this.loadingListeners.clear();
    this.selectionLoadListeners.clear();
  }
}
