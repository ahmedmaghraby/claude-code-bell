import { execFile } from 'child_process';

export type SoundEvent = 'stop' | 'permission' | 'clarification';

const MAC_DEFAULTS: Record<SoundEvent, string> = {
  stop:          '/System/Library/Sounds/Glass.aiff',
  permission:    '/System/Library/Sounds/Funk.aiff',
  clarification: '/System/Library/Sounds/Ping.aiff',
};

const WIN_DEFAULTS: Record<SoundEvent, string> = {
  stop:          'Asterisk',
  permission:    'Exclamation',
  clarification: 'Beep',
};

export function playSound(eventType: SoundEvent, override?: string): void {
  if (process.platform === 'darwin') {
    const file = override || MAC_DEFAULTS[eventType];
    execFile('/usr/bin/afplay', [file], (err) => {
      if (err) { console.error(`[ClaudeCodeNotifier] afplay error: ${err.message}`); }
    });

  } else if (process.platform === 'win32') {
    let ps: string;
    if (override) {
      // User-supplied .wav file — use SoundPlayer
      const safe = override.replace(/'/g, "''");
      ps = `(New-Object Media.SoundPlayer '${safe}').PlaySync()`;
    } else {
      // Built-in Windows system sound — no file needed
      const name = WIN_DEFAULTS[eventType];
      ps = `[System.Media.SystemSounds]::${name}.Play()`;
    }
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], (err) => {
      if (err) { console.error(`[ClaudeCodeNotifier] powershell sound error: ${err.message}`); }
    });
  }
  // Linux: silent by default — no built-in sound mechanism assumed
}
