import * as http from 'http';
import * as path from 'path';
import * as vscode from 'vscode';
import { getConfig } from '../config/settings';
import { playSound } from '../audio/soundPlayer';
import { showSystemNotification } from '../notifications/systemNotifier';
import { showVSCodeNotification } from '../notifications/vscodeNotifier';
import { updateStatusBar } from '../extension';
import { track } from '../telemetry/analytics';
import type { HookPayload } from '../types/hookPayload';

function deriveProjectName(payload: HookPayload): string {
  if (payload.project_name) { return payload.project_name; }
  if (payload.cwd) {
    const parts = payload.cwd.replace(/\\/g, '/').split('/').filter(Boolean);
    if (parts.length > 0) { return parts[parts.length - 1]; }
  }
  return vscode.workspace.workspaceFolders?.[0]?.name ?? 'Claude Code';
}

function handleEvent(eventType: string, payload: HookPayload, res: http.ServerResponse): void {
  const config = getConfig();
  const project = deriveProjectName(payload);

  res.setHeader('Content-Type', 'application/json');

  if (!config.enabled) {
    res.writeHead(200);
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  switch (eventType) {

    case 'Stop': {
      if (config.soundEnabled) { playSound('stop', config.sounds.stop || undefined); }
      const msg = `[${project}] Task finished`;
      if (config.systemNotificationsEnabled) { showSystemNotification('Claude Code — Done', msg); }
      showVSCodeNotification('info', msg);
      updateStatusBar('$(check)', msg);
      track('hook_fired', { eventType: 'Stop', project });
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true }));
      break;
    }

    case 'PreToolUse': {
      // PreToolUse is the correct hook for permissionDecision (Claude Code changelog confirmed)
      if (config.autoApprove) {
        const pPayload = payload as { tool_name?: string };
        const tool = pPayload.tool_name ?? 'unknown tool';
        const msg = `[${project}] Auto-approved: ${tool}`;
        if (config.soundEnabled) { playSound('permission', config.sounds.permission || undefined); }
        if (config.systemNotificationsEnabled) { showSystemNotification('Claude Code — Auto-Approved', msg); }
        showVSCodeNotification('info', msg);
        updateStatusBar('$(pass)', msg);
        track('hook_fired', { eventType: 'PreToolUse', tool, autoApproved: true, project });
        res.writeHead(200);
        res.end(JSON.stringify({ permissionDecision: 'allow' }));
      } else {
        res.writeHead(200);
        res.end(JSON.stringify({ ok: true }));
      }
      break;
    }

    case 'PermissionRequest': {
      // PermissionRequest fires when the "Yes / Yes for this project / No" panel would show.
      // Correct response schema: { decision: { behavior: "allow" | "deny" } }
      // (different from PreToolUse which uses permissionDecision)
      const pPayload = payload as { tool_name?: string };
      const tool = pPayload.tool_name ?? 'unknown tool';

      if (config.autoApprove) {
        const msg = `[${project}] Auto-approved: ${tool}`;
        updateStatusBar('$(pass)', msg);
        track('hook_fired', { eventType: 'PermissionRequest', tool, autoApproved: true, project });
        res.writeHead(200);
        res.end(JSON.stringify({ decision: { behavior: 'allow' } }));
      } else {
        if (config.soundEnabled) { playSound('permission', config.sounds.permission || undefined); }
        const msg = `[${project}] Approval needed: ${tool}`;
        if (config.systemNotificationsEnabled) { showSystemNotification('Claude Code — Approval Needed', msg); }
        showVSCodeNotification('warning', msg);
        updateStatusBar('$(warning)', msg);
        track('hook_fired', { eventType: 'PermissionRequest', tool, autoApproved: false, project });
        res.writeHead(200);
        res.end(JSON.stringify({ ok: true }));
      }
      break;
    }

    case 'Notification':
    case 'Elicitation': {
      const nPayload = payload as { message?: string; prompt?: string };
      const detail = nPayload.message ?? nPayload.prompt ?? 'Needs your input';
      if (config.soundEnabled) { playSound('clarification', config.sounds.clarification || undefined); }
      const msg = `[${project}] ${detail}`;
      if (config.systemNotificationsEnabled) { showSystemNotification('Claude Code — Input Needed', msg); }
      showVSCodeNotification('warning', msg);
      updateStatusBar('$(comment)', msg);
      track('hook_fired', { eventType, project });
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true }));
      break;
    }

    default:
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true }));
  }
}

export class HookServer {
  private server: http.Server | null = null;
  private port: number;

  constructor(port: number) {
    this.port = port;
  }

  start(): Promise<void> {
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
            const payload = JSON.parse(body || '{}') as HookPayload;
            handleEvent(eventType, payload, res);
          } catch {
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

  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => resolve());
        this.server = null;
      } else {
        resolve();
      }
    });
  }

  getPort(): number {
    return this.port;
  }
}
