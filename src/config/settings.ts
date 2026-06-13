import * as vscode from 'vscode';

export interface NotifierConfig {
  enabled: boolean;
  port: number;
  soundEnabled: boolean;
  systemNotificationsEnabled: boolean;
  autoApprove: boolean;
  sounds: {
    stop: string;
    permission: string;
    clarification: string;
  };
}

export function getConfig(): NotifierConfig {
  const cfg = vscode.workspace.getConfiguration('claudeCodeNotifier');
  return {
    enabled: cfg.get<boolean>('enabled', true),
    port: cfg.get<number>('port', 3457),
    soundEnabled: cfg.get<boolean>('soundEnabled', true),
    systemNotificationsEnabled: cfg.get<boolean>('systemNotificationsEnabled', true),
    autoApprove: cfg.get<boolean>('autoApprove', false),
    sounds: {
      stop: cfg.get<string>('sounds.stop', ''),
      permission: cfg.get<string>('sounds.permission', ''),
      clarification: cfg.get<string>('sounds.clarification', ''),
    },
  };
}
