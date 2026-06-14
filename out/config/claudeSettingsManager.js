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
exports.ensureClaudeHooks = ensureClaudeHooks;
exports.syncPermissionMode = syncPermissionMode;
exports.removeClaudeHooks = removeClaudeHooks;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const CLAUDE_SETTINGS_PATH = path.join(os.homedir(), '.claude', 'settings.json');
function buildHookEntries(port) {
    return {
        Stop: { type: 'http', url: `http://127.0.0.1:${port}/hook/Stop`, timeout: 5 },
        PreToolUse: { type: 'http', url: `http://127.0.0.1:${port}/hook/PreToolUse`, timeout: 5 },
        PermissionRequest: { type: 'http', url: `http://127.0.0.1:${port}/hook/PermissionRequest`, timeout: 5 },
        Notification: { type: 'http', url: `http://127.0.0.1:${port}/hook/Notification`, timeout: 5 },
        Elicitation: { type: 'http', url: `http://127.0.0.1:${port}/hook/Elicitation`, timeout: 5 },
    };
}
/** Merges required hooks into ~/.claude/settings.json. Returns true if the file was changed. */
function ensureClaudeHooks(port) {
    const hooks = buildHookEntries(port);
    let raw = '{}';
    try {
        raw = fs.readFileSync(CLAUDE_SETTINGS_PATH, 'utf8');
    }
    catch { /* file missing */ }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let settings = {};
    try {
        settings = JSON.parse(raw);
    }
    catch { /* malformed — start fresh merge */ }
    if (!settings.hooks) {
        settings.hooks = {};
    }
    let changed = false;
    for (const [event, hookEntry] of Object.entries(hooks)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const existing = settings.hooks[event] ?? [];
        const targetUrl = `http://127.0.0.1:${port}/hook/${event}`;
        const alreadyPresent = existing.some((group) => group.hooks?.some((h) => h.url === targetUrl));
        if (!alreadyPresent) {
            settings.hooks[event] = [...existing, { hooks: [hookEntry] }];
            changed = true;
        }
    }
    if (changed) {
        fs.mkdirSync(path.dirname(CLAUDE_SETTINGS_PATH), { recursive: true });
        fs.writeFileSync(CLAUDE_SETTINGS_PATH, JSON.stringify(settings, null, 2), 'utf8');
    }
    return changed;
}
/**
 * Syncs permissions.defaultMode in ~/.claude/settings.json with the autoApprove setting.
 * bypassPermissions tells Claude Code to skip ALL permission dialogs at the session level,
 * which is the only reliable way to prevent the "Yes / Yes for project / No" panel from appearing.
 * Changes take effect on the next Claude Code session start.
 */
function syncPermissionMode(autoApprove) {
    let raw = '{}';
    try {
        raw = fs.readFileSync(CLAUDE_SETTINGS_PATH, 'utf8');
    }
    catch { /* missing */ }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let settings = {};
    try {
        settings = JSON.parse(raw);
    }
    catch { /* malformed */ }
    if (!settings.permissions) {
        settings.permissions = {};
    }
    if (autoApprove) {
        settings.permissions.defaultMode = 'bypassPermissions';
    }
    else {
        delete settings.permissions.defaultMode;
        if (Object.keys(settings.permissions).length === 0) {
            delete settings.permissions;
        }
    }
    fs.mkdirSync(path.dirname(CLAUDE_SETTINGS_PATH), { recursive: true });
    fs.writeFileSync(CLAUDE_SETTINGS_PATH, JSON.stringify(settings, null, 2), 'utf8');
}
/** Removes only the hooks this extension added. Safe to call on deactivate. */
function removeClaudeHooks(port) {
    let raw = '{}';
    try {
        raw = fs.readFileSync(CLAUDE_SETTINGS_PATH, 'utf8');
    }
    catch {
        return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let settings = {};
    try {
        settings = JSON.parse(raw);
    }
    catch {
        return;
    }
    if (!settings.hooks) {
        return;
    }
    for (const event of Object.keys(buildHookEntries(port))) {
        if (!settings.hooks[event]) {
            continue;
        }
        const exactUrl = `http://127.0.0.1:${port}/hook/${event}`;
        settings.hooks[event] = settings.hooks[event].filter((group) => !group.hooks?.some((h) => h.url === exactUrl));
        if (settings.hooks[event].length === 0) {
            delete settings.hooks[event];
        }
    }
    if (Object.keys(settings.hooks).length === 0) {
        delete settings.hooks;
    }
    fs.writeFileSync(CLAUDE_SETTINGS_PATH, JSON.stringify(settings, null, 2), 'utf8');
}
//# sourceMappingURL=claudeSettingsManager.js.map