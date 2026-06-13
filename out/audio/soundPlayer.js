"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.playSound = playSound;
const child_process_1 = require("child_process");
const MAC_DEFAULTS = {
    stop: '/System/Library/Sounds/Glass.aiff',
    permission: '/System/Library/Sounds/Funk.aiff',
    clarification: '/System/Library/Sounds/Ping.aiff',
};
const WIN_DEFAULTS = {
    stop: 'Asterisk',
    permission: 'Exclamation',
    clarification: 'Beep',
};
function playSound(eventType, override) {
    if (process.platform === 'darwin') {
        const file = override || MAC_DEFAULTS[eventType];
        (0, child_process_1.execFile)('/usr/bin/afplay', [file], (err) => {
            if (err) {
                console.error(`[ClaudeCodeNotifier] afplay error: ${err.message}`);
            }
        });
    }
    else if (process.platform === 'win32') {
        let ps;
        if (override) {
            // User-supplied .wav file — use SoundPlayer
            const safe = override.replace(/'/g, "''");
            ps = `(New-Object Media.SoundPlayer '${safe}').PlaySync()`;
        }
        else {
            // Built-in Windows system sound — no file needed
            const name = WIN_DEFAULTS[eventType];
            ps = `[System.Media.SystemSounds]::${name}.Play()`;
        }
        (0, child_process_1.execFile)('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], (err) => {
            if (err) {
                console.error(`[ClaudeCodeNotifier] powershell sound error: ${err.message}`);
            }
        });
    }
    // Linux: silent by default — no built-in sound mechanism assumed
}
//# sourceMappingURL=soundPlayer.js.map