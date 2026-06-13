# Claude Code Notifier

A VS Code extension that plays distinct sounds and shows system-level notifications when [Claude Code](https://claude.ai/code) finishes a task, needs your approval, or needs clarification — **even when VS Code is not in focus**.

## Features

- **Zero setup** — installs and auto-configures `~/.claude/settings.json` for you
- **System notifications** — appear in macOS Notification Center or Windows Action Center even when VS Code is minimized or in the background
- **Distinct sounds** per event type so you know what happened without looking
- **Project name in every notification** — know which task finished when you have multiple projects open
- **Auto-approve** — optionally bypass all Claude Code permission prompts automatically

## Event Types & Sounds

| Event | What it means | macOS Sound | Windows Sound |
|---|---|---|---|
| Task complete | Claude finished your request | Glass | Asterisk |
| Approval needed | Claude wants permission to run a command | Funk | Exclamation |
| Input needed | Claude needs clarification or more info | Ping | Beep |

## Installation

1. Install this extension from the VS Code Marketplace
2. **Reload VS Code** (`Cmd+Shift+P` → `Developer: Reload Window`)
3. That's it — `~/.claude/settings.json` is configured automatically

### Enable macOS System Notifications (important!)

macOS requires notification permission for the underlying notifier tool. To allow it:

1. Open **System Settings** → **Notifications**
2. Trigger a test notification first: `Cmd+Shift+P` → **Claude Code Notifier: Test Notification**
3. Find **terminal-notifier** (or **Script Editor**) in the list and set it to **Allow**

> **Apple Silicon (M1/M2/M3) users:** For best performance, install the native ARM64 binary:
> ```bash
> brew install terminal-notifier
> ```
> The extension auto-detects it at `/opt/homebrew/bin/terminal-notifier`. Without it, the bundled Intel binary runs via Rosetta 2 (still works).

### Enable Windows Notifications

1. Open **Settings** → **System** → **Notifications**
2. Make sure **Get notifications from apps** is turned on

## Settings

| Setting | Default | Description |
|---|---|---|
| `claudeCodeNotifier.enabled` | `true` | Master on/off switch |
| `claudeCodeNotifier.port` | `3457` | HTTP port for the hook server |
| `claudeCodeNotifier.soundEnabled` | `true` | Play sounds |
| `claudeCodeNotifier.systemNotificationsEnabled` | `true` | Show OS-level notifications |
| `claudeCodeNotifier.autoApprove` | `false` | ⚠️ Auto-approve all permission requests |
| `claudeCodeNotifier.sounds.stop` | *(default)* | Custom sound file for task complete |
| `claudeCodeNotifier.sounds.permission` | *(default)* | Custom sound file for approval needed |
| `claudeCodeNotifier.sounds.clarification` | *(default)* | Custom sound file for input needed |

### Custom sounds

Set any setting to a file path to override the default:
- macOS: `.aiff` or `.mp3` files work with `afplay`
- Windows: `.wav` files work with `SoundPlayer`

```json
"claudeCodeNotifier.sounds.stop": "/Users/you/sounds/done.mp3"
```

## Commands

Open the Command Palette (`Cmd+Shift+P`) and search for:

| Command | Description |
|---|---|
| `Claude Code Notifier: Show Server Status` | Shows port and auto-approve state |
| `Claude Code Notifier: Restart Hook Server` | Restart after changing the port |
| `Claude Code Notifier: Test Notification` | Fire a test sound + system notification |

## Auto-Approve

When **Auto Approve** is enabled, the extension:
- Responds to every Claude Code permission request with an automatic "allow"
- Sets `permissions.defaultMode: "bypassPermissions"` in `~/.claude/settings.json` so the permission panel never appears
- Still fires a notification so you know what was approved

> ⚠️ Only enable this if you trust the current project fully. Restart Claude Code after toggling for the setting to take full effect.

## How It Works

The extension starts a local HTTP server on `127.0.0.1:3457` (loopback only — never exposed externally). It automatically writes webhook entries to your `~/.claude/settings.json`:

```json
{
  "hooks": {
    "Stop":              [{ "hooks": [{ "type": "http", "url": "http://127.0.0.1:3457/hook/Stop" }] }],
    "PreToolUse":        [{ "hooks": [{ "type": "http", "url": "http://127.0.0.1:3457/hook/PreToolUse" }] }],
    "PermissionRequest": [{ "hooks": [{ "type": "http", "url": "http://127.0.0.1:3457/hook/PermissionRequest" }] }],
    "Notification":      [{ "hooks": [{ "type": "http", "url": "http://127.0.0.1:3457/hook/Notification" }] }],
    "Elicitation":       [{ "hooks": [{ "type": "http", "url": "http://127.0.0.1:3457/hook/Elicitation" }] }]
  }
}
```

When the extension is disabled or uninstalled, these entries are removed automatically.

## Troubleshooting

**No sound plays**
- Check `claudeCodeNotifier.soundEnabled` is `true`
- macOS: make sure your volume is on and not muted
- Try running in Terminal: `afplay /System/Library/Sounds/Glass.aiff`

**No system notification appears**
- Run `Claude Code Notifier: Test Notification` from the Command Palette
- macOS: grant notification permission in System Settings → Notifications
- Check `claudeCodeNotifier.systemNotificationsEnabled` is `true`

**Auto-approve panel still shows**
- Restart Claude Code (close and reopen the terminal / start a new session)
- `permissions.defaultMode: "bypassPermissions"` is read at session start

**Server not running / hooks not firing**
- Run `Claude Code Notifier: Show Server Status`
- If the port is in use, change `claudeCodeNotifier.port` and run `Restart Hook Server`
- Verify `~/.claude/settings.json` contains the hook entries

## Privacy

This extension collects anonymous usage telemetry (hook events fired, extension activated, errors) to help improve it. Telemetry is automatically disabled if you have turned off telemetry in VS Code (`telemetry.telemetryLevel: off`).

## License

MIT
