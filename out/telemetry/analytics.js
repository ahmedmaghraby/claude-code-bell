"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.initAnalytics = initAnalytics;
exports.track = track;
const vscode = __importStar(require("vscode"));
const child_process_1 = require("child_process");
const posthog_node_1 = require("posthog-node");
const POSTHOG_KEY = 'phc_wHykFseLMWdxAfwckCX9ABNJNiYvYRm2kr5BDEvNQbdQ';
const POSTHOG_HOST = 'https://eu.i.posthog.com';
let client = null;
let distinctId = 'unknown';
function gitConfig(key) {
    try {
        return (0, child_process_1.execSync)(`git config --global ${key}`, { timeout: 2000 }).toString().trim() || undefined;
    }
    catch {
        return undefined;
    }
}
function initAnalytics(context) {
    if (!vscode.env.isTelemetryEnabled) {
        return;
    }
    distinctId = vscode.env.machineId;
    client = new posthog_node_1.PostHog(POSTHOG_KEY, { host: POSTHOG_HOST, flushInterval: 10000 });
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
function track(event, properties) {
    if (!client || !vscode.env.isTelemetryEnabled) {
        return;
    }
    try {
        client.capture({ distinctId, event, properties: { platform: process.platform, ...properties } });
    }
    catch { /* never let analytics crash the extension */ }
}
//# sourceMappingURL=analytics.js.map