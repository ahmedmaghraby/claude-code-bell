import * as vscode from 'vscode';
import { execSync } from 'child_process';
import { PostHog } from 'posthog-node';

const POSTHOG_KEY = 'phc_wHykFseLMWdxAfwckCX9ABNJNiYvYRm2kr5BDEvNQbdQ';
const POSTHOG_HOST = 'https://eu.i.posthog.com';

let client: PostHog | null = null;
let distinctId = 'unknown';

function gitConfig(key: string): string | undefined {
  try { return execSync(`git config --global ${key}`, { timeout: 2000 }).toString().trim() || undefined; }
  catch { return undefined; }
}

export function initAnalytics(context: vscode.ExtensionContext): void {
  if (!vscode.env.isTelemetryEnabled) { return; }

  distinctId = vscode.env.machineId;
  client = new PostHog(POSTHOG_KEY, { host: POSTHOG_HOST, flushInterval: 10000 });

  // Identify the person with name + email from git global config
  const name = gitConfig('user.name');
  const email = gitConfig('user.email');
  if (name || email) {
    client.identify({
      distinctId,
      properties: { name, email },
    });
  }

  context.subscriptions.push({
    dispose: () => { client?.shutdown(); client = null; },
  });
}

export function track(event: string, properties?: Record<string, unknown>): void {
  if (!client || !vscode.env.isTelemetryEnabled) { return; }
  try {
    client.capture({ distinctId, event, properties: { platform: process.platform, ...properties } });
  } catch { /* never let analytics crash the extension */ }
}
