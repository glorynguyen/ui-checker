import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { WebSocketServer, WebSocket } from 'ws';
import { SearchLogic, SearchMatch } from './search-logic';
import { enumerateSearchableFiles, type FileEnumeratorDeps } from './file-enumerator';

const vscodeDeps: FileEnumeratorDeps = {
  getConfiguration: (s) => vscode.workspace.getConfiguration(s),
  findFiles: (inc, exc) => vscode.workspace.findFiles(inc, exc),
  readFile: (uri) => vscode.workspace.fs.readFile(uri as unknown as vscode.Uri),
};

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

  const retakeCommand = vscode.commands.registerCommand('ui-checker-bridge.retakeServer', async () => {
    statusBarItem.text = '$(sync~spin) Bridge: Retaking...';
    statusBarItem.tooltip = undefined;
    await retakePort();
  });
  context.subscriptions.push(retakeCommand);

  // Auto-start if configured
  startBridgeServer();

  // Listen for focus changes to handle "Auto Takeover" if multiple windows are open
  vscode.window.onDidChangeWindowState(async (e) => {
    const config = vscode.workspace.getConfiguration('ui-checker-bridge');
    if (e.focused && config.get('autoTakeover') && !server) {
      console.log('[Bridge] Window gained focus, taking over server...');
      await retakePort();
    }
  });
}

// Ask the current port holder (another VS Code window running this extension)
// to release the port, then bind ourselves. Falls back to a direct bind attempt
// if no one answers within the timeout.
async function retakePort() {
  const config = vscode.workspace.getConfiguration('ui-checker-bridge');
  const port = config.get<number>('port') || 9876;

  if (server) {
    server.close();
    server = null;
  }

  await requestPortRelease(port);
  // Brief delay so the OS fully releases the socket before we re-bind
  setTimeout(() => startBridgeServer(), 150);
}

function requestPortRelease(port: number, timeoutMs = 1000): Promise<void> {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      try { client.terminate(); } catch { /* noop */ }
      resolve();
    };

    let client: WebSocket;
    try {
      client = new WebSocket(`ws://127.0.0.1:${port}`);
    } catch {
      return resolve();
    }

    client.on('open', () => {
      try { client.send(JSON.stringify({ action: 'RELEASE_PORT' })); } catch { /* noop */ }
    });
    client.on('message', (msg) => {
      try {
        const data = JSON.parse(msg.toString());
        if (data.action === 'PORT_RELEASED') finish();
      } catch { /* noop */ }
    });
    client.on('close', finish);
    client.on('error', finish);
    setTimeout(finish, timeoutMs);
  });
}

function startBridgeServer() {
  const config = vscode.workspace.getConfiguration('ui-checker-bridge');
  const port = config.get<number>('port') || 9876;

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

          if (data.action === 'RELEASE_PORT') {
            console.log('[Bridge] Release requested by another window — closing server');
            try { ws.send(JSON.stringify({ action: 'PORT_RELEASED' })); } catch { /* noop */ }
            // Give the ack a moment to flush before closing
            setTimeout(() => {
              if (server) {
                server.close();
                server = null;
              }
              updateStatus(false, port, 'Off');
            }, 50);
            return;
          }

          if (data.action === 'FIND_SELECTOR') {
            // Fast path: runtime-stamped data-uic-loc gives us file:line:col directly.
            const exact = data.sourceLoc ? resolveExactSourceLoc(data.sourceLoc) : null;

            const matches = exact
              ? [exact]
              : await findSelectorInWorkspace(data.selector, data.property, data.value, data.ancestors, data.sourceName);

            ws.send(JSON.stringify({
              action: 'SELECTOR_RESULTS',
              selector: data.selector,
              matches,
              exact: Boolean(exact)
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
        // Close the failed server so the next retake attempt can bind fresh
        if (server) { server.close(); server = null; }
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
    statusBarItem.command = 'ui-checker-bridge.startServer';
    statusBarItem.tooltip = undefined;
  } else if (extra === 'In Use') {
    statusBarItem.text = `$(circle-slash) Bridge: In Use (${port})`;
    statusBarItem.backgroundColor = undefined;
    statusBarItem.command = 'ui-checker-bridge.retakeServer';
    statusBarItem.tooltip = 'Click to retake port';
  } else {
    statusBarItem.text = `$(circle-slash) Bridge: ${extra || 'Listening'} (${port})`;
    statusBarItem.backgroundColor = undefined;
    statusBarItem.command = 'ui-checker-bridge.startServer';
    statusBarItem.tooltip = undefined;
  }
}

function tokenizeSelector(selector: string): string[] {
  return selector.split(/(?=[.#])| /).map(t => t.trim()).filter(Boolean);
}

// Resolve `data-uic-loc="path:line:col"` against each workspace folder. Returns
// a single high-confidence match if the file exists; null otherwise so callers
// fall back to fuzzy search.
function resolveExactSourceLoc(sourceLoc: string): SearchMatch | null {
  // Format: "<rel-or-abs-path>:<line>:<col>". Path may itself contain colons
  // on Windows; line/col are always the trailing two numeric segments.
  const m = sourceLoc.match(/^(.*):(\d+):(\d+)$/);
  if (!m) return null;
  const [, rawPath, lineStr] = m;
  const line = parseInt(lineStr, 10);
  if (!Number.isFinite(line)) return null;

  const candidates: string[] = [];
  if (path.isAbsolute(rawPath)) {
    candidates.push(rawPath);
  } else {
    for (const folder of vscode.workspace.workspaceFolders ?? []) {
      candidates.push(path.join(folder.uri.fsPath, rawPath));
    }
  }

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return { file: candidate, line: Math.max(0, line - 1), score: 9999 };
      }
    } catch {
      // ignore and try next candidate
    }
  }
  return null;
}

async function findSelectorInWorkspace(
  selector: string,
  property?: string,
  value?: string,
  ancestors?: string[],
  sourceName?: string | null
): Promise<SearchMatch[]> {
  const tokens = tokenizeSelector(selector);
  const ancestorTokens = (ancestors ?? []).map(tokenizeSelector).filter(t => t.length > 0);
  const activeFile = vscode.window.activeTextEditor?.document.fileName ?? null;

  const files = await enumerateSearchableFiles(vscodeDeps);
  const results: SearchMatch[] = [];

  for (const { filePath, content } of files) {
    const match = SearchLogic.scoreFile(filePath, content, tokens, activeFile, property, value, ancestorTokens, sourceName ?? undefined);
    if (match) results.push(match);
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
