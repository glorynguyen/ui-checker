import * as vscode from 'vscode';
import { WebSocketServer, WebSocket } from 'ws';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { SearchLogic, SearchMatch } from './search-logic';

let server: WebSocketServer | null = null;
let statusBarItem: vscode.StatusBarItem;

export function activate(context: vscode.ExtensionContext) {
  console.log('UI Checker Bridge is now active');

  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.text = '$(circle-slash) Bridge: Off';
  statusBarItem.command = 'ui-checker-bridge.startServer';
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  const startCommand = vscode.commands.registerCommand('ui-checker-bridge.startServer', () => {
    startBridgeServer();
  });
  context.subscriptions.push(startCommand);

  // Auto-start if configured
  startBridgeServer();

  // Listen for focus changes to handle "Auto Takeover" if multiple windows are open
  vscode.window.onDidChangeWindowState(async (e) => {
    const config = vscode.workspace.getConfiguration('ui-checker-bridge');
    if (e.focused && config.get('autoTakeover')) {
      console.log('[Bridge] Window gained focus, taking over server...');
      startBridgeServer();
    }
  });
}

function startBridgeServer() {
  const config = vscode.workspace.getConfiguration('ui-checker-bridge');
  const port = config.get<number>('port') || 3000;

  if (server) {
    // If port is the same, just return
    if ((server as any)._port === port) return;
    server.close();
  }

  try {
    server = new WebSocketServer({ port });
    (server as any)._port = port;

    server.on('connection', (ws) => {
      console.log('[Bridge] Browser connected');
      updateStatus(true, port);

      ws.on('message', async (message) => {
        try {
          const data = JSON.parse(message.toString());
          console.log('[Bridge] Command:', data.action);

          if (data.action === 'FIND_SELECTOR') {
            const matches = await findSelectorInWorkspace(data.selector);
            ws.send(JSON.stringify({
              action: 'SELECTOR_RESULTS',
              selector: data.selector,
              matches
            }));

            if (matches.length > 0) {
              await openMatch(matches[0]);
            }
          }
        } catch (e) {
          console.error('[Bridge] Message error:', e);
        }
      });

      ws.on('close', () => {
        console.log('[Bridge] Browser disconnected');
        updateStatus(server?.clients.size! > 0, port);
      });
    });

    server.on('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        console.warn(`[Bridge] Port ${port} in use, another VS Code window might have it.`);
        updateStatus(false, port, 'In Use');
      } else {
        console.error('[Bridge] Server error:', err);
        updateStatus(false, port, 'Error');
      }
    });

    console.log(`[Bridge] Server started on port ${port}`);
    updateStatus(false, port);
  } catch (e) {
    console.error('[Bridge] Failed to start server:', e);
  }
}

function updateStatus(connected: boolean, port: number, extra = '') {
  if (!statusBarItem) return;
  if (connected) {
    statusBarItem.text = `$(zap) Bridge: Active (${port})`;
    statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.prominentBackground');
  } else {
    statusBarItem.text = `$(circle-slash) Bridge: ${extra || 'Listening'} (${port})`;
    statusBarItem.backgroundColor = undefined;
  }
}

async function findSelectorInWorkspace(selector: string): Promise<SearchMatch[]> {
  const tokens = selector.split(/(?=[.#])| /).map(t => t.trim()).filter(Boolean);
  const results: SearchMatch[] = [];
  
  const files = await vscode.workspace.findFiles('**/*.{tsx,jsx,js,html,css,scss}', '**/node_modules/**');
  const activeFile = vscode.window.activeTextEditor?.document.fileName || null;

  for (const fileUri of files) {
    try {
      const content = fs.readFileSync(fileUri.fsPath, 'utf8');
      const match = SearchLogic.scoreFile(fileUri.fsPath, content, tokens, activeFile);
      if (match) {
        results.push(match);
      }
    } catch (e) {
      // ignore read errors
    }
  }

  return results.sort((a, b) => b.score - a.score).slice(0, 5);
}

async function openMatch(match: SearchMatch) {
  const doc = await vscode.workspace.openTextDocument(match.file);
  const editor = await vscode.window.showTextDocument(doc);
  
  const pos = new vscode.Position(match.line, 0);
  editor.selection = new vscode.Selection(pos, pos);
  editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
}

export function deactivate() {
  if (server) {
    server.close();
  }
}
