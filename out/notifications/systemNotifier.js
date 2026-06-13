"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.showSystemNotification = showSystemNotification;
const node_notifier_1 = require("node-notifier");
const fs_1 = require("fs");
// Prefer native ARM64 binary from Homebrew; fall back to bundled Intel (runs via Rosetta 2)
const HOMEBREW_PATHS = [
    '/opt/homebrew/bin/terminal-notifier', // Apple Silicon Homebrew
    '/usr/local/bin/terminal-notifier', // Intel Homebrew
];
function resolveTerminalNotifier() {
    return HOMEBREW_PATHS.find(fs_1.existsSync);
}
function showSystemNotification(title, message) {
    if (process.platform === 'darwin') {
        const customPath = resolveTerminalNotifier(); // undefined → bundled binary
        const nc = new node_notifier_1.NotificationCenter({ customPath });
        nc.notify({ title, message, sound: false });
    }
    else {
        // Windows / Linux: use the default notifier (Toaster / notify-send)
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { default: notifier } = require('node-notifier');
        notifier.notify({ title, message, sound: false });
    }
}
//# sourceMappingURL=systemNotifier.js.map