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
  statusBar.tooltip = `Claude Code Bell — last event: ${text}`;
  statusBar.show();
}

async function startServer(port: number): Promise<HookServer | null> {
  for (let p = port; p <= port + 10; p++) {
    const server = new HookServer(p);
    try {
      await server.start();
      if (p !== port) {
        vscode.window.showInformationMessage(
          `Claude Code Bell: port ${port} in use, started on ${p}.`
        );
      }
      return server;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes('EADDRINUSE') || p === port + 10) {
        track('server_start_failed', { port: p, error: msg });
        vscode.window.showErrorMessage(`Claude Code Bell: failed to start server. ${msg}`);
        return null;
      }
      // EADDRINUSE → try next port silently
    }
  }
  return null;
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const config = getConfig();
  currentPort = config.port;

  // Persistent status bar item — always visible, updated on every hook event
  statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBar.command = 'claudeCodeBell.showStatus';
  statusBar.text = '$(bell) Claude Notifier';
  statusBar.tooltip = 'Claude Code Bell — waiting for events';
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
        'Claude Code Bell: Hooks added to ~/.claude/settings.json automatically.'
      );
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    vscode.window.showWarningMessage(
      `Claude Code Bell: Could not update ~/.claude/settings.json: ${msg}`
    );
  }

  // Start the hook server
  hookServer = await startServer(config.port);
  if (hookServer) {
    currentPort = hookServer.getPort();
    if (currentPort !== config.port) {
      try { ensureClaudeHooks(currentPort); } catch { /* non-fatal */ }
    }
    statusBar.text = `$(bell) Claude Notifier :${currentPort}`;
  }

  // Auto-restart every 2 hours to prevent silent server failures
  const RESTART_INTERVAL_MS = 2 * 60 * 60 * 1000;
  const restartTimer = setInterval(async () => {
    if (hookServer) {
      await hookServer.stop();
      hookServer = await startServer(config.port);
      if (hookServer) {
        currentPort = hookServer.getPort();
        try { ensureClaudeHooks(currentPort); } catch { /* non-fatal */ }
        updateStatusBar('$(bell)', `Claude Notifier :${currentPort}`);
      }
    }
  }, RESTART_INTERVAL_MS);
  context.subscriptions.push({ dispose: () => clearInterval(restartTimer) });

  // Command: show server status
  context.subscriptions.push(
    vscode.commands.registerCommand('claudeCodeBell.showStatus', () => {
      const cfg = getConfig();
      if (hookServer) {
        vscode.window.showInformationMessage(
          `Claude Code Bell running on port ${hookServer.getPort()}. Auto-approve: ${cfg.autoApprove ? 'ON ⚠️' : 'off'}.`
        );
      } else {
        vscode.window.showWarningMessage('Claude Code Bell server is not running.');
      }
    })
  );

  // Command: restart server (e.g. after port change)
  context.subscriptions.push(
    vscode.commands.registerCommand('claudeCodeBell.restartServer', async () => {
      await hookServer?.stop();
      const newConfig = getConfig();
      hookServer = await startServer(newConfig.port);
      if (hookServer) {
        currentPort = hookServer.getPort();
        try { ensureClaudeHooks(currentPort); } catch { /* non-fatal */ }
        statusBar.text = `$(bell) Claude Notifier :${currentPort}`;
        vscode.window.showInformationMessage(
          `Claude Code Bell restarted on port ${currentPort}.`
        );
      }
    })
  );

  // Command: test notification
  context.subscriptions.push(
    vscode.commands.registerCommand('claudeCodeBell.testNotification', () => {
      const project = vscode.workspace.workspaceFolders?.[0]?.name ?? 'test-project';
      playSound('stop');
      showSystemNotification('Claude Code Bell — Test', `[${project}] System notifications are working!`);
      updateStatusBar('$(check)', `[${project}] Test fired`);
      track('test_notification_fired');
      vscode.window.showInformationMessage('Claude Code Bell: Test fired. Check status bar + Notification Center.');
    })
  );

  // React to setting changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('claudeCodeBell.port')) {
        vscode.commands.executeCommand('claudeCodeBell.restartServer');
      }
      if (e.affectsConfiguration('claudeCodeBell.autoApprove')) {
        const newCfg = getConfig();
        try { syncPermissionMode(newCfg.autoApprove); } catch { /* non-fatal */ }
        track('auto_approve_toggled', { enabled: newCfg.autoApprove });
        if (newCfg.autoApprove) {
          vscode.window.showInformationMessage(
            'Claude Code Bell: Auto-approve ON — restart Claude Code for full effect (permission dialogs suppressed at session level).'
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
