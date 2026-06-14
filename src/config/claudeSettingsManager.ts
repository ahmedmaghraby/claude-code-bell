import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const CLAUDE_SETTINGS_PATH = path.join(os.homedir(), '.claude', 'settings.json');

function buildHookEntries(port: number): Record<string, object> {
  return {
    Stop:              { type: 'http', url: `http://127.0.0.1:${port}/hook/Stop`,              timeout: 5 },
    PreToolUse:        { type: 'http', url: `http://127.0.0.1:${port}/hook/PreToolUse`,        timeout: 5 },
    PermissionRequest: { type: 'http', url: `http://127.0.0.1:${port}/hook/PermissionRequest`, timeout: 5 },
    Notification:      { type: 'http', url: `http://127.0.0.1:${port}/hook/Notification`,      timeout: 5 },
    Elicitation:       { type: 'http', url: `http://127.0.0.1:${port}/hook/Elicitation`,       timeout: 5 },
  };
}


/** Merges required hooks into ~/.claude/settings.json. Returns true if the file was changed. */
export function ensureClaudeHooks(port: number): boolean {
  const hooks = buildHookEntries(port);

  let raw = '{}';
  try { raw = fs.readFileSync(CLAUDE_SETTINGS_PATH, 'utf8'); } catch { /* file missing */ }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let settings: any = {};
  try { settings = JSON.parse(raw); } catch { /* malformed — start fresh merge */ }

  if (!settings.hooks) { settings.hooks = {}; }

  let changed = false;
  for (const [event, hookEntry] of Object.entries(hooks)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existing: any[] = settings.hooks[event] ?? [];
    const targetUrl = `http://127.0.0.1:${port}/hook/${event}`;
    const alreadyPresent = existing.some((group: any) =>
      group.hooks?.some((h: any) => h.url === targetUrl)
    );
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
export function syncPermissionMode(autoApprove: boolean): void {
  let raw = '{}';
  try { raw = fs.readFileSync(CLAUDE_SETTINGS_PATH, 'utf8'); } catch { /* missing */ }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let settings: any = {};
  try { settings = JSON.parse(raw); } catch { /* malformed */ }

  if (!settings.permissions) { settings.permissions = {}; }

  if (autoApprove) {
    settings.permissions.defaultMode = 'bypassPermissions';
  } else {
    delete settings.permissions.defaultMode;
    if (Object.keys(settings.permissions).length === 0) {
      delete settings.permissions;
    }
  }

  fs.mkdirSync(path.dirname(CLAUDE_SETTINGS_PATH), { recursive: true });
  fs.writeFileSync(CLAUDE_SETTINGS_PATH, JSON.stringify(settings, null, 2), 'utf8');
}

/** Removes only the hooks this extension added. Safe to call on deactivate. */
export function removeClaudeHooks(port: number): void {
  let raw = '{}';
  try { raw = fs.readFileSync(CLAUDE_SETTINGS_PATH, 'utf8'); } catch { return; }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let settings: any = {};
  try { settings = JSON.parse(raw); } catch { return; }

  if (!settings.hooks) { return; }

  for (const event of Object.keys(buildHookEntries(port))) {
    if (!settings.hooks[event]) { continue; }
    const exactUrl = `http://127.0.0.1:${port}/hook/${event}`;
    settings.hooks[event] = settings.hooks[event].filter((group: any) =>
      !group.hooks?.some((h: any) => h.url === exactUrl)
    );
    if (settings.hooks[event].length === 0) { delete settings.hooks[event]; }
  }

  if (Object.keys(settings.hooks).length === 0) { delete settings.hooks; }
  fs.writeFileSync(CLAUDE_SETTINGS_PATH, JSON.stringify(settings, null, 2), 'utf8');
}
