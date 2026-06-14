"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateStatusBar = updateStatusBar;
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const hookServer_1 = require("./server/hookServer");
const settings_1 = require("./config/settings");
const claudeSettingsManager_1 = require("./config/claudeSettingsManager");
const soundPlayer_1 = require("./audio/soundPlayer");
const systemNotifier_1 = require("./notifications/systemNotifier");
const analytics_1 = require("./telemetry/analytics");
let hookServer = null;
let currentPort = 3457;
let statusBar;
/** Called by hookServer.ts to update the always-visible status bar on every event. */
function updateStatusBar(icon, text) {
    statusBar.text = `${icon} ${text}`;
    statusBar.tooltip = `Claude Code Bell — last event: ${text}`;
    statusBar.show();
}
async function startServer(port) {
    for (let p = port; p <= port + 10; p++) {
        const server = new hookServer_1.HookServer(p);
        try {
            await server.start();
            if (p !== port) {
                vscode.window.showInformationMessage(`Claude Code Bell: port ${port} in use, started on ${p}.`);
            }
            return server;
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            if (!msg.includes('EADDRINUSE') || p === port + 10) {
                (0, analytics_1.track)('server_start_failed', { port: p, error: msg });
                vscode.window.showErrorMessage(`Claude Code Bell: failed to start server. ${msg}`);
                return null;
            }
            // EADDRINUSE → try next port silently
        }
    }
    return null;
}
async function activate(context) {
    const config = (0, settings_1.getConfig)();
    currentPort = config.port;
    // Persistent status bar item — always visible, updated on every hook event
    statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBar.command = 'claudeCodeBell.showStatus';
    statusBar.text = '$(bell) Claude Notifier';
    statusBar.tooltip = 'Claude Code Bell — waiting for events';
    statusBar.show();
    context.subscriptions.push(statusBar);
    // Init analytics (respects VS Code telemetry setting)
    (0, analytics_1.initAnalytics)(context);
    (0, analytics_1.track)('extension_activated', { autoApprove: config.autoApprove, port: config.port });
    // Auto-configure ~/.claude/settings.json (hooks + permission mode)
    try {
        const changed = (0, claudeSettingsManager_1.ensureClaudeHooks)(config.port);
        (0, claudeSettingsManager_1.syncPermissionMode)(config.autoApprove);
        if (changed) {
            vscode.window.showInformationMessage('Claude Code Bell: Hooks added to ~/.claude/settings.json automatically.');
        }
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        vscode.window.showWarningMessage(`Claude Code Bell: Could not update ~/.claude/settings.json: ${msg}`);
    }
    // Start the hook server
    hookServer = await startServer(config.port);
    if (hookServer) {
        currentPort = hookServer.getPort();
        if (currentPort !== config.port) {
            try {
                (0, claudeSettingsManager_1.ensureClaudeHooks)(currentPort);
            }
            catch { /* non-fatal */ }
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
                try {
                    (0, claudeSettingsManager_1.ensureClaudeHooks)(currentPort);
                }
                catch { /* non-fatal */ }
                updateStatusBar('$(bell)', `Claude Notifier :${currentPort}`);
            }
        }
    }, RESTART_INTERVAL_MS);
    context.subscriptions.push({ dispose: () => clearInterval(restartTimer) });
    // Command: show server status
    context.subscriptions.push(vscode.commands.registerCommand('claudeCodeBell.showStatus', () => {
        const cfg = (0, settings_1.getConfig)();
        if (hookServer) {
            vscode.window.showInformationMessage(`Claude Code Bell running on port ${hookServer.getPort()}. Auto-approve: ${cfg.autoApprove ? 'ON ⚠️' : 'off'}.`);
        }
        else {
            vscode.window.showWarningMessage('Claude Code Bell server is not running.');
        }
    }));
    // Command: restart server (e.g. after port change)
    context.subscriptions.push(vscode.commands.registerCommand('claudeCodeBell.restartServer', async () => {
        await hookServer?.stop();
        const newConfig = (0, settings_1.getConfig)();
        hookServer = await startServer(newConfig.port);
        if (hookServer) {
            currentPort = hookServer.getPort();
            try {
                (0, claudeSettingsManager_1.ensureClaudeHooks)(currentPort);
            }
            catch { /* non-fatal */ }
            statusBar.text = `$(bell) Claude Notifier :${currentPort}`;
            vscode.window.showInformationMessage(`Claude Code Bell restarted on port ${currentPort}.`);
        }
    }));
    // Command: test notification
    context.subscriptions.push(vscode.commands.registerCommand('claudeCodeBell.testNotification', () => {
        const project = vscode.workspace.workspaceFolders?.[0]?.name ?? 'test-project';
        (0, soundPlayer_1.playSound)('stop');
        (0, systemNotifier_1.showSystemNotification)('Claude Code Bell — Test', `[${project}] System notifications are working!`);
        updateStatusBar('$(check)', `[${project}] Test fired`);
        (0, analytics_1.track)('test_notification_fired');
        vscode.window.showInformationMessage('Claude Code Bell: Test fired. Check status bar + Notification Center.');
    }));
    // React to setting changes
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('claudeCodeBell.port')) {
            vscode.commands.executeCommand('claudeCodeBell.restartServer');
        }
        if (e.affectsConfiguration('claudeCodeBell.autoApprove')) {
            const newCfg = (0, settings_1.getConfig)();
            try {
                (0, claudeSettingsManager_1.syncPermissionMode)(newCfg.autoApprove);
            }
            catch { /* non-fatal */ }
            (0, analytics_1.track)('auto_approve_toggled', { enabled: newCfg.autoApprove });
            if (newCfg.autoApprove) {
                vscode.window.showInformationMessage('Claude Code Bell: Auto-approve ON — restart Claude Code for full effect (permission dialogs suppressed at session level).');
            }
        }
    }));
    context.subscriptions.push({
        dispose: () => { hookServer?.stop(); },
    });
}
async function deactivate() {
    await hookServer?.stop();
    hookServer = null;
    try {
        (0, claudeSettingsManager_1.removeClaudeHooks)(currentPort);
    }
    catch { /* best-effort */ }
}
//# sourceMappingURL=extension.js.map