# Changelog

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
