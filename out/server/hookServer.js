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
exports.HookServer = void 0;
const http = __importStar(require("http"));
const vscode = __importStar(require("vscode"));
const settings_1 = require("../config/settings");
const soundPlayer_1 = require("../audio/soundPlayer");
const systemNotifier_1 = require("../notifications/systemNotifier");
const vscodeNotifier_1 = require("../notifications/vscodeNotifier");
const extension_1 = require("../extension");
const analytics_1 = require("../telemetry/analytics");
function deriveProjectName(payload) {
    if (payload.project_name) {
        return payload.project_name;
    }
    if (payload.cwd) {
        const parts = payload.cwd.replace(/\\/g, '/').split('/').filter(Boolean);
        if (parts.length > 0) {
            return parts[parts.length - 1];
        }
    }
    return vscode.workspace.workspaceFolders?.[0]?.name ?? 'Claude Code';
}
function handleEvent(eventType, payload, res) {
    const config = (0, settings_1.getConfig)();
    const project = deriveProjectName(payload);
    res.setHeader('Content-Type', 'application/json');
    if (!config.enabled) {
        res.writeHead(200);
        res.end(JSON.stringify({ ok: true }));
        return;
    }
    switch (eventType) {
        case 'Stop': {
            if (config.soundEnabled) {
                (0, soundPlayer_1.playSound)('stop', config.sounds.stop || undefined);
            }
            const msg = `[${project}] Task finished`;
            if (config.systemNotificationsEnabled) {
                (0, systemNotifier_1.showSystemNotification)('Claude Code — Done', msg);
            }
            (0, vscodeNotifier_1.showVSCodeNotification)('info', msg);
            (0, extension_1.updateStatusBar)('$(check)', msg);
            (0, analytics_1.track)('hook_fired', { eventType: 'Stop', project });
            res.writeHead(200);
            res.end(JSON.stringify({ ok: true }));
            break;
        }
        case 'PreToolUse': {
            // PreToolUse is the correct hook for permissionDecision (Claude Code changelog confirmed)
            if (config.autoApprove) {
                const pPayload = payload;
                const tool = pPayload.tool_name ?? 'unknown tool';
                const msg = `[${project}] Auto-approved: ${tool}`;
                if (config.soundEnabled) {
                    (0, soundPlayer_1.playSound)('permission', config.sounds.permission || undefined);
                }
                if (config.systemNotificationsEnabled) {
                    (0, systemNotifier_1.showSystemNotification)('Claude Code — Auto-Approved', msg);
                }
                (0, vscodeNotifier_1.showVSCodeNotification)('info', msg);
                (0, extension_1.updateStatusBar)('$(pass)', msg);
                (0, analytics_1.track)('hook_fired', { eventType: 'PreToolUse', tool, autoApproved: true, project });
                res.writeHead(200);
                res.end(JSON.stringify({ permissionDecision: 'allow' }));
            }
            else {
                res.writeHead(200);
                res.end(JSON.stringify({ ok: true }));
            }
            break;
        }
        case 'PermissionRequest': {
            // PermissionRequest fires when the "Yes / Yes for this project / No" panel would show.
            // Correct response schema: { decision: { behavior: "allow" | "deny" } }
            // (different from PreToolUse which uses permissionDecision)
            const pPayload = payload;
            const tool = pPayload.tool_name ?? 'unknown tool';
            if (config.autoApprove) {
                const msg = `[${project}] Auto-approved: ${tool}`;
                (0, extension_1.updateStatusBar)('$(pass)', msg);
                (0, analytics_1.track)('hook_fired', { eventType: 'PermissionRequest', tool, autoApproved: true, project });
                res.writeHead(200);
                res.end(JSON.stringify({ decision: { behavior: 'allow' } }));
            }
            else {
                if (config.soundEnabled) {
                    (0, soundPlayer_1.playSound)('permission', config.sounds.permission || undefined);
                }
                const msg = `[${project}] Approval needed: ${tool}`;
                if (config.systemNotificationsEnabled) {
                    (0, systemNotifier_1.showSystemNotification)('Claude Code — Approval Needed', msg);
                }
                (0, vscodeNotifier_1.showVSCodeNotification)('warning', msg);
                (0, extension_1.updateStatusBar)('$(warning)', msg);
                (0, analytics_1.track)('hook_fired', { eventType: 'PermissionRequest', tool, autoApproved: false, project });
                res.writeHead(200);
                res.end(JSON.stringify({ ok: true }));
            }
            break;
        }
        case 'Notification': {
            const nPayload = payload;
            const detail = nPayload.message ?? 'Notification';
            if (config.soundEnabled) {
                (0, soundPlayer_1.playSound)('clarification', config.sounds.clarification || undefined);
            }
            const msg = `[${project}] ${detail}`;
            if (config.systemNotificationsEnabled) {
                (0, systemNotifier_1.showSystemNotification)('Claude Code — Input Needed', msg);
            }
            (0, vscodeNotifier_1.showVSCodeNotification)('warning', msg);
            (0, extension_1.updateStatusBar)('$(comment)', msg);
            (0, analytics_1.track)('hook_fired', { eventType: 'Notification', project });
            res.writeHead(200);
            res.end(JSON.stringify({ ok: true }));
            break;
        }
        case 'Elicitation': {
            const ePayload = payload;
            const detail = ePayload.message ?? ePayload.prompt ?? 'Needs your input';
            const isPlan = /\bplan\b|\bapprove\b|\breview\b|\baccept\b/i.test(detail);
            if (isPlan) {
                if (config.soundEnabled) {
                    (0, soundPlayer_1.playSound)('plan', config.sounds.plan || undefined);
                }
                const msg = `[${project}] Plan ready for review`;
                if (config.systemNotificationsEnabled) {
                    (0, systemNotifier_1.showSystemNotification)('Claude Code — Plan Ready', msg);
                }
                (0, vscodeNotifier_1.showVSCodeNotification)('warning', `[${project}] Plan ready — open Claude Code to approve or reject`);
                (0, extension_1.updateStatusBar)('$(checklist)', msg);
                (0, analytics_1.track)('hook_fired', { eventType: 'Elicitation', subtype: 'plan', project });
            }
            else {
                if (config.soundEnabled) {
                    (0, soundPlayer_1.playSound)('clarification', config.sounds.clarification || undefined);
                }
                const msg = `[${project}] ${detail}`;
                if (config.systemNotificationsEnabled) {
                    (0, systemNotifier_1.showSystemNotification)('Claude Code — Input Needed', msg);
                }
                (0, vscodeNotifier_1.showVSCodeNotification)('warning', msg);
                (0, extension_1.updateStatusBar)('$(comment)', msg);
                (0, analytics_1.track)('hook_fired', { eventType: 'Elicitation', subtype: 'input', project });
            }
            res.writeHead(200);
            res.end(JSON.stringify({ ok: true }));
            break;
        }
        default:
            res.writeHead(200);
            res.end(JSON.stringify({ ok: true }));
    }
}
class HookServer {
    constructor(port) {
        this.server = null;
        this.port = port;
    }
    start() {
        return new Promise((resolve, reject) => {
            this.server = http.createServer((req, res) => {
                if (req.method !== 'POST' || !req.url?.startsWith('/hook/')) {
                    res.writeHead(404);
                    res.end();
                    return;
                }
                const eventType = req.url.split('/')[2] ?? '';
                let body = '';
                req.on('data', (chunk) => { body += chunk; });
                req.on('end', () => {
                    try {
                        const payload = JSON.parse(body || '{}');
                        handleEvent(eventType, payload, res);
                    }
                    catch {
                        res.writeHead(400);
                        res.end(JSON.stringify({ error: 'Invalid JSON' }));
                    }
                });
            });
            this.server.on('error', reject);
            this.server.listen(this.port, '127.0.0.1', () => {
                console.log(`[ClaudeCodeNotifier] Hook server listening on 127.0.0.1:${this.port}`);
                resolve();
            });
        });
    }
    stop() {
        return new Promise((resolve) => {
            if (this.server) {
                this.server.close(() => resolve());
                this.server = null;
            }
            else {
                resolve();
            }
        });
    }
    getPort() {
        return this.port;
    }
}
exports.HookServer = HookServer;
//# sourceMappingURL=hookServer.js.map