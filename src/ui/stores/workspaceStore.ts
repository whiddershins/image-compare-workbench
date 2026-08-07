import { WorkspaceController } from '../../application/workspaceController';

/** Single app-wide controller instance. Domain logic lives in pure modules. */
export const controller = new WorkspaceController();
