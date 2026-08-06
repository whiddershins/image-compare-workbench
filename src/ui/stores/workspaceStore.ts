import { WorkspaceController } from '../../application/workspaceController';
import type { Workspace } from '../../domain/model';
import { emptyWorkspace } from '../../domain/workspaceTransitions';

/** Single app-wide controller instance. Domain logic lives in pure modules. */
export const controller = new WorkspaceController();

export type WorkspaceSnapshot = {
  workspace: Workspace;
  importing: boolean;
  summaryText: string | null;
  errorText: string | null;
  selectionLoadVersion: number;
};

export function createInitialSnapshot(): WorkspaceSnapshot {
  return {
    workspace: emptyWorkspace(),
    importing: false,
    summaryText: null,
    errorText: null,
    selectionLoadVersion: 0,
  };
}
