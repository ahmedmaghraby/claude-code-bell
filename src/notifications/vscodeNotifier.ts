import * as vscode from 'vscode';

export function showVSCodeNotification(level: 'info' | 'warning', message: string): void {
  if (level === 'warning') {
    vscode.window.showWarningMessage(message);
  } else {
    vscode.window.showInformationMessage(message);
  }
}
