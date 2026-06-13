export type HookEvent =
  | 'Stop'
  | 'StopFailure'
  | 'PermissionRequest'
  | 'Notification'
  | 'Elicitation';

export interface BaseHookPayload {
  event?: HookEvent;
  session_id?: string;
  cwd?: string;
  project_name?: string;
}

export interface StopPayload extends BaseHookPayload {
  event?: 'Stop';
  transcript_path?: string;
}

export interface PermissionRequestPayload extends BaseHookPayload {
  event?: 'PermissionRequest';
  tool_name?: string;
  tool_input?: Record<string, unknown>;
}

export interface NotificationPayload extends BaseHookPayload {
  event?: 'Notification';
  message?: string;
}

export interface ElicitationPayload extends BaseHookPayload {
  event?: 'Elicitation';
  message?: string;
  prompt?: string;
}

export type HookPayload =
  | StopPayload
  | PermissionRequestPayload
  | NotificationPayload
  | ElicitationPayload;
