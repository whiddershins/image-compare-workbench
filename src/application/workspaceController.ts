import type {
  AssetId,
  ImportIssue,
  Side,
  SizeNormalization,
  ViewportSize,
  DrawnView,
  WipeAxis,
  WipeBehavior,
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
import {
  applyCycleFull,
  applySplitPresentation,
  applyWipePresentation,
  effectiveView,
  setWipeAxis,
  setWipeFromViewportPosition,
  setWipeBehavior,
  tapTarget,
} from '../domain/wipe';
import {
  fitCurrentPair,
  panWorkspace,
  setCamera100Percent,
  zoomWorkspaceAtPoint,
  zoomWorkspaceCenter,
  type HybridPanMode,
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

export interface ImportDiscoveryResult {
  readonly files: readonly DiscoveredFile[];
  readonly issues: readonly ImportIssue[];
}

type ImportDiscoveryOutcome =
  | { readonly ok: true; readonly value: ImportDiscoveryResult }
  | { readonly ok: false; readonly error: unknown };

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
export type SideTapListener = (tapping: boolean) => void;
export type ImportBatchProcessor = typeof processImportBatch;

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
  private importTail: Promise<void> = Promise.resolve();
  private pendingImports = 0;
  private readonly importBatchProcessor: ImportBatchProcessor;
  /** Momentary opposite-full overlay (A tap / B tap); not domain state. */
  private sideTapping = false;

  private workspaceListeners = new Set<WorkspaceListener>();
  private summaryListeners = new Set<SummaryListener>();
  private errorListeners = new Set<ErrorListener>();
  private loadingListeners = new Set<LoadingListener>();
  private selectionLoadListeners = new Set<SelectionLoadListener>();
  private sideTapListeners = new Set<SideTapListener>();

  constructor(importBatchProcessor: ImportBatchProcessor = processImportBatch) {
    this.importBatchProcessor = importBatchProcessor;
  }

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

  subscribeSideTap(listener: SideTapListener): () => void {
    this.sideTapListeners.add(listener);
    return () => this.sideTapListeners.delete(listener);
  }

  isSideTapping(): boolean {
    return this.sideTapping;
  }

  /** Sticky draw (wipe|a|b), or opposite focus while side-tapping. */
  getEffectiveView(): DrawnView {
    return effectiveView(this.workspace.comparison, this.sideTapping);
  }

  /** Which solo side the hold-tap shows (depends on focus only). */
  getTapTarget(): 'a' | 'b' {
    return tapTarget(this.workspace.comparison.focus);
  }

  beginSideTap(): void {
    if (this.sideTapping) return;
    this.sideTapping = true;
    this.emitSideTap();
  }

  endSideTap(): void {
    if (!this.sideTapping) return;
    this.sideTapping = false;
    this.emitSideTap();
  }

  /** Full control: show full(focus); if already full, flip focus a↔b. */
  cycleFullView(): void {
    this.setWorkspace(applyCycleFull(this.workspace));
  }

  /** Wipe control: presentation only — focus (and side-tap) unchanged. */
  setWipeView(): void {
    this.setWorkspace(applyWipePresentation(this.workspace));
  }

  /** Side-by-side control: presentation only — focus unchanged. */
  setSplitView(): void {
    this.setWorkspace(applySplitPresentation(this.workspace));
  }

  private emitWorkspace(): void {
    for (const l of this.workspaceListeners) l(this.workspace);
  }

  private emitSideTap(): void {
    for (const l of this.sideTapListeners) l(this.sideTapping);
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

  private setImporting(importing: boolean): void {
    if (this.importing === importing) return;
    this.importing = importing;
    this.emitLoading();
  }

  importDiscovered(
    discovered: readonly DiscoveredFile[],
    preIssues: readonly ImportIssue[] = [],
  ): Promise<void> {
    if (discovered.length === 0 && preIssues.length === 0) {
      return Promise.resolve();
    }

    return this.importDiscovery(
      Promise.resolve({ files: discovered, issues: preIssues }),
    );
  }

  /**
   * Reserve import order and generation before asynchronous discovery settles.
   * Callers start browser discovery while creating the supplied promise.
   */
  importDiscovery(
    discovery: PromiseLike<ImportDiscoveryResult>,
  ): Promise<void> {
    const queuedGeneration = this.generation;
    // Observe rejection immediately even when this request is queued behind
    // another import. The resulting promise never rejects.
    const outcome: Promise<ImportDiscoveryOutcome> = Promise.resolve(
      discovery,
    ).then(
      (value) => ({ ok: true, value }),
      (error: unknown) => ({ ok: false, error }),
    );

    return this.enqueueImport(outcome, queuedGeneration);
  }

  private enqueueImport(
    discovery: Promise<ImportDiscoveryOutcome>,
    queuedGeneration: number,
  ): Promise<void> {
    this.pendingImports += 1;
    this.setImporting(true);

    const job = this.importTail.then(async () => {
      if (this.generation !== queuedGeneration) return;
      const outcome = await discovery;
      if (this.generation !== queuedGeneration) return;
      if (!outcome.ok) {
        this.setError({
          kind: 'import',
          message:
            outcome.error instanceof Error
              ? outcome.error.message
              : 'Import discovery failed',
        });
        return;
      }

      const { files, issues } = outcome.value;
      if (files.length === 0 && issues.length === 0) return;
      await this.runImport(files, issues, queuedGeneration);
    });

    // One unexpected failure must not prevent later imports from running.
    this.importTail = job.catch(() => {});

    return job.finally(() => {
      if (this.generation !== queuedGeneration) return;
      this.pendingImports -= 1;
      if (this.pendingImports === 0) this.setImporting(false);
    });
  }

  private async runImport(
    discovered: readonly DiscoveredFile[],
    preIssues: readonly ImportIssue[],
    generation: number,
  ): Promise<void> {
    const wasEmpty = isEmpty(this.workspace);
    this.setError(null);

    try {
      const existingKeys = buildDuplicateKeySet(this.workspace.imageSet.assets);
      const startOrdinal =
        this.workspace.imageSet.assets.reduce(
          (m, a) => Math.max(m, a.importOrdinal),
          -1,
        ) + 1;

      const batch = await this.importBatchProcessor(discovered, preIssues, {
        existingDuplicateKeys: existingKeys,
        startOrdinal,
        isCancelled: () => this.generation !== generation,
      });

      if (this.generation !== generation) {
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
      if (this.generation !== generation) return;
      this.setError({
        kind: 'unexpected',
        message: e instanceof Error ? e.message : 'Import failed',
      });
    }
  }

  clear(): void {
    this.generation += 1;
    // Browser folder traversal may be unabortable. Detach its old queue so a
    // new session can import immediately; generation checks discard its result.
    this.importTail = Promise.resolve();
    this.pendingImports = 0;
    this.setImporting(false);
    this.endSideTap(); // full interaction reset
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

  setWipeBehavior(behavior: WipeBehavior, viewport: ViewportSize): void {
    this.setWorkspace(setWipeBehavior(this.workspace, behavior, viewport));
  }

  setWipeAxis(axis: WipeAxis, viewport: ViewportSize): void {
    this.setWorkspace(setWipeAxis(this.workspace, axis, viewport));
  }

  /**
   * Change size normalization. Optionally refit the pair so the new
   * placement is visible (recommended after an explicit mode change).
   */
  setSizeNormalization(
    norm: SizeNormalization,
    viewport?: ViewportSize,
  ): void {
    let next = setSizeNormalization(this.workspace, norm);
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

  pan(
    viewport: ViewportSize,
    dx: number,
    dy: number,
    hybridPan: HybridPanMode,
  ): void {
    this.setWorkspace(
      panWorkspace(this.workspace, viewport, dx, dy, hybridPan),
    );
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
    this.importTail = Promise.resolve();
    this.pendingImports = 0;
    this.importing = false;
    this.sideTapping = false;
    this.registry.clear();
    this.workspaceListeners.clear();
    this.summaryListeners.clear();
    this.errorListeners.clear();
    this.loadingListeners.clear();
    this.selectionLoadListeners.clear();
    this.sideTapListeners.clear();
  }
}
