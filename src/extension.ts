import * as vscode from 'vscode';
import { HookServer } from './server/hookServer';
import { getConfig } from './config/settings';
import { ensureClaudeHooks, removeClaudeHooks, syncPermissionMode } from './config/claudeSettingsManager';
import { playSound } from './audio/soundPlayer';
import { showSystemNotification } from './notifications/systemNotifier';
import { initAnalytics, track } from './telemetry/analytics';

let hookServer: HookServer | null = null;
let currentPort: number = 3457;
let statusBar: vscode.StatusBarItem;

/** Called by hookServer.ts to update the always-visible status bar on every event. */
export function updateStatusBar(icon: string, text: string): void {
  statusBar.text = `${icon} ${text}`;
  statusBar.tooltip = `Claude Code Notifier — last event: ${text}`;
  statusBar.show();
}

async function startServer(port: number): Promise<HookServer | null> {
  const server = new HookServer(port);
  try {
    await server.start();
    return server;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    track('server_start_failed', { port, error: msg });
    vscode.window.showErrorMessage(
      `Claude Code Notifier: failed to start server on port ${port}. ${msg}`
    );
    return null;
  }
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const config = getConfig();
  currentPort = config.port;

  // Persistent status bar item — always visible, updated on every hook event
  statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBar.command = 'claudeCodeNotifier.showStatus';
  statusBar.text = '$(bell) Claude Notifier';
  statusBar.tooltip = 'Claude Code Notifier — waiting for events';
  statusBar.show();
  context.subscriptions.push(statusBar);

  // Init analytics (respects VS Code telemetry setting)
  initAnalytics(context);
  track('extension_activated', { autoApprove: config.autoApprove, port: config.port });

  // Auto-configure ~/.claude/settings.json (hooks + permission mode)
  try {
    const changed = ensureClaudeHooks(config.port);
    syncPermissionMode(config.autoApprove);
    if (changed) {
      vscode.window.showInformationMessage(
        'Claude Code Notifier: Hooks added to ~/.claude/settings.json automatically.'
      );
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    vscode.window.showWarningMessage(
      `Claude Code Notifier: Could not update ~/.claude/settings.json: ${msg}`
    );
  }

  // Start the hook server
  hookServer = await startServer(config.port);
  if (hookServer) {
    statusBar.text = `$(bell) Claude Notifier :${config.port}`;
  }

  // Command: show server status
  context.subscriptions.push(
    vscode.commands.registerCommand('claudeCodeNotifier.showStatus', () => {
      const cfg = getConfig();
      if (hookServer) {
        vscode.window.showInformationMessage(
          `Claude Code Notifier running on port ${hookServer.getPort()}. Auto-approve: ${cfg.autoApprove ? 'ON ⚠️' : 'off'}.`
        );
      } else {
        vscode.window.showWarningMessage('Claude Code Notifier server is not running.');
      }
    })
  );

  // Command: restart server (e.g. after port change)
  context.subscriptions.push(
    vscode.commands.registerCommand('claudeCodeNotifier.restartServer', async () => {
      await hookServer?.stop();
      const newConfig = getConfig();
      currentPort = newConfig.port;
      try { ensureClaudeHooks(newConfig.port); } catch { /* non-fatal */ }
      hookServer = await startServer(newConfig.port);
      if (hookServer) {
        statusBar.text = `$(bell) Claude Notifier :${newConfig.port}`;
        vscode.window.showInformationMessage(
          `Claude Code Notifier restarted on port ${newConfig.port}.`
        );
      }
    })
  );

  // Command: test notification
  context.subscriptions.push(
    vscode.commands.registerCommand('claudeCodeNotifier.testNotification', () => {
      const project = vscode.workspace.workspaceFolders?.[0]?.name ?? 'test-project';
      playSound('stop');
      showSystemNotification('Claude Code Notifier — Test', `[${project}] System notifications are working!`);
      updateStatusBar('$(check)', `[${project}] Test fired`);
      track('test_notification_fired');
      vscode.window.showInformationMessage('Claude Code Notifier: Test fired. Check status bar + Notification Center.');
    })
  );

  // React to setting changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('claudeCodeNotifier.port')) {
        vscode.commands.executeCommand('claudeCodeNotifier.restartServer');
      }
      if (e.affectsConfiguration('claudeCodeNotifier.autoApprove')) {
        const newCfg = getConfig();
        try { syncPermissionMode(newCfg.autoApprove); } catch { /* non-fatal */ }
        track('auto_approve_toggled', { enabled: newCfg.autoApprove });
        if (newCfg.autoApprove) {
          vscode.window.showInformationMessage(
            'Claude Code Notifier: Auto-approve ON — restart Claude Code for full effect (permission dialogs suppressed at session level).'
          );
        }
      }
    })
  );

  context.subscriptions.push({
    dispose: () => { hookServer?.stop(); },
  });
}

export async function deactivate(): Promise<void> {
  await hookServer?.stop();
  hookServer = null;
  try { removeClaudeHooks(currentPort); } catch { /* best-effort */ }
}
