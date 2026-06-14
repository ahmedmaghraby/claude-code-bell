# Changelog

## 0.1.5
- **Multi-window support**: opening multiple VS Code windows no longer crashes the server. The extension now automatically scans ports 3457–3467 and binds to the first available one, then updates `~/.claude/settings.json` to point to the actual port
- **All windows receive notifications**: every open VS Code window registers its own port so Claude Code broadcasts to all of them simultaneously
- **Auto-restart every 2 hours**: the hook server restarts itself silently every 2 hours to prevent silent failures; hooks and status bar are refreshed automatically
- Status bar now always shows the actual bound port (e.g. `:3458`) when a fallback port is used
- Fixed hook cleanup on window close to only remove that window's own port, leaving other windows' hooks intact

## 0.1.4
- Added dedicated plan-review notification: plays Hero.aiff (macOS) / Asterisk (Windows) and shows "Plan Ready" system notification when Claude Code finishes planning and needs approval
- Added `claudeCodeBell.sounds.plan` setting to override the plan-review sound
- Plan review is auto-detected from Elicitation hook payloads containing "plan", "approve", "review", or "accept"

## 0.1.3
- Renamed extension to **Claude Code Bell** to resolve VS Code Marketplace name conflict

## 0.1.2
- Minor stability fixes

## 0.1.1
- Minor stability fixes

## 0.1.0
- Initial release
- Auto-configures `~/.claude/settings.json` on first activation
- Plays distinct sounds for task complete, approval needed, clarification needed
- System notifications visible even when VS Code is out of focus (macOS + Windows)
- Auto-approve toggle for Claude Code permission requests
- Project name shown in every notification
