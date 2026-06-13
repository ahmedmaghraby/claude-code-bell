import { NotificationCenter } from 'node-notifier';
import { existsSync } from 'fs';

// Prefer native ARM64 binary from Homebrew; fall back to bundled Intel (runs via Rosetta 2)
const HOMEBREW_PATHS = [
  '/opt/homebrew/bin/terminal-notifier', // Apple Silicon Homebrew
  '/usr/local/bin/terminal-notifier',    // Intel Homebrew
];

function resolveTerminalNotifier(): string | undefined {
  return HOMEBREW_PATHS.find(existsSync);
}

export function showSystemNotification(title: string, message: string): void {
  if (process.platform === 'darwin') {
    const customPath = resolveTerminalNotifier(); // undefined → bundled binary
    const nc = new NotificationCenter({ customPath });
    nc.notify({ title, message, sound: false });
  } else {
    // Windows / Linux: use the default notifier (Toaster / notify-send)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { default: notifier } = require('node-notifier');
    notifier.notify({ title, message, sound: false });
  }
}
