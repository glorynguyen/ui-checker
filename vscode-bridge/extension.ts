import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { WebSocketServer, WebSocket } from 'ws';
import { SearchLogic, SearchMatch } from './search-logic';
import { enumerateSearchableFiles, type FileEnumeratorDeps } from './file-enumerator';
import {
  findSourceLocSuffixMatch,
  parseSourceLoc,
  sourceLocBasename,
  sourceLocMatch,
} from './source-loc';
import {
  RUNTIME_FALLBACK_EXCLUDE,
  RUNTIME_FALLBACK_INCLUDE,
  RUNTIME_PACKAGE_NAME,
  addRuntimeToPackageJson,
  findKnownRuntimeEntryFile,
  findNearestPackageJson,
  getRuntimeImportInsertLine,
} from './runtime-setup';

const vscodeDeps: FileEnumeratorDeps = {
  getConfiguration: (s) => vscode.workspace.getConfiguration(s),
  findFiles: (inc, exc) => Promise.resolve(vscode.workspace.findFiles(inc, exc)),
  readFile: (uri) => Promise.resolve(vscode.workspace.fs.readFile(uri as unknown as vscode.Uri)),
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

  const setupRuntimeCommand = vscode.commands.registerCommand('ui-checker-bridge.setupRuntime', async () => {
    await setupRuntime();
  });
  context.subscriptions.push(setupRuntimeCommand);

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

          if (data.action === 'SETUP_RUNTIME') {
            const confirmed = await confirmRuntimeSetup();
            if (!confirmed) {
              ws.send(JSON.stringify({
                action: 'SETUP_RUNTIME_CANCELLED',
                message: 'Runtime setup cancelled in VS Code.'
              }));
              return;
            }

            ws.send(JSON.stringify({
              action: 'SETUP_RUNTIME_STARTED',
              message: 'Updating package.json and the app entry file...'
            }));

            const result = await setupRuntime();
            if (result.ok) {
              ws.send(JSON.stringify({
                action: 'SETUP_RUNTIME_SUCCESS',
                message: 'Runtime setup complete. Reload your app to stamp source locations.'
              }));
            } else {
              ws.send(JSON.stringify({
                action: 'SETUP_RUNTIME_FAILED',
                error: result.error
              }));
            }
            return;
          }

          if (data.action === 'FIND_SELECTOR') {
            // Fast path: runtime-stamped data-uic-loc gives us file:line:col directly.
            const exact = data.sourceLoc ? await resolveExactSourceLoc(data.sourceLoc) : null;

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

// Resolve `data-uic-loc="path:line:col"` against the workspace. The runtime
// path can be package-relative in monorepos, so direct root joins are tried
// first and then a workspace suffix search keeps the data-uic-loc fast path.
async function resolveExactSourceLoc(sourceLoc: string): Promise<SearchMatch | null> {
  const loc = parseSourceLoc(sourceLoc);
  if (!loc) return null;

  const candidates: string[] = [];
  if (path.isAbsolute(loc.rawPath)) {
    candidates.push(loc.rawPath);
  } else {
    for (const folder of vscode.workspace.workspaceFolders ?? []) {
      candidates.push(path.join(folder.uri.fsPath, loc.rawPath));
    }
  }

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return sourceLocMatch(candidate, loc);
      }
    } catch {
      // ignore and try next candidate
    }
  }

  if (!path.isAbsolute(loc.rawPath)) {
    const basename = sourceLocBasename(loc.rawPath);
    if (basename) {
      const found = await vscode.workspace.findFiles(`**/${basename}`, '**/{node_modules,dist,build,.next,out,coverage}/**', 50);
      const suffixMatch = findSourceLocSuffixMatch(loc.rawPath, found.map((uri) => uri.fsPath));
      if (suffixMatch) {
        return sourceLocMatch(suffixMatch, loc);
      }
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
  
  const pos = new vscode.Position(match.line, match.column ?? 0);
  editor.selection = new vscode.Selection(pos, pos);
  editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
}

async function setupRuntime() {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    const error = 'No workspace folder open.';
    vscode.window.showErrorMessage(`[UI Checker] ${error}`);
    return { ok: false, error };
  }

  const root = folders[0].uri;

  try {
    await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: "Setting up UI Checker Runtime",
      cancellable: false
    }, async (progress) => {
      progress.report({ message: "Finding app entry point..." });
      const entryFile = await findRuntimeEntryFile(root);

      progress.report({ message: `Adding ${RUNTIME_PACKAGE_NAME} to package.json...` });
      const packageJson = vscode.Uri.file(findNearestPackageJson(root.fsPath, entryFile.fsPath));
      addRuntimeToPackageJson(packageJson.fsPath);

      progress.report({ message: "Injecting import into entry point..." });
      await injectImport(entryFile);
    });

    vscode.window.showInformationMessage('[UI Checker] Runtime setup complete. package.json was updated and the runtime import was added.');
    return { ok: true };
  } catch (error: any) {
    const message = error?.message || 'Unknown setup error.';
    vscode.window.showErrorMessage(`[UI Checker] Setup failed: ${message}`);
    return { ok: false, error: message };
  }
}

async function confirmRuntimeSetup() {
  const choice = await vscode.window.showWarningMessage(
    '[UI Checker] Add @ui-checker/runtime to package.json and import it in your project entry file?',
    {
      modal: true,
      detail: 'This edits package.json in the active VS Code workspace and updates the detected app entry file.'
    },
    'Update Files'
  );

  return choice === 'Update Files';
}

async function findRuntimeEntryFile(root: vscode.Uri) {
  const knownEntryFile = findKnownRuntimeEntryFile(root.fsPath);
  if (knownEntryFile) {
    return vscode.Uri.file(knownEntryFile);
  }

  const found = await vscode.workspace.findFiles(
    new vscode.RelativePattern(root, RUNTIME_FALLBACK_INCLUDE),
    RUNTIME_FALLBACK_EXCLUDE,
    1
  );
  if (found.length > 0) {
    return found[0];
  }

  throw new Error(`Could not find project entry point. Please add "import '${RUNTIME_PACKAGE_NAME}';" manually to your main file.`);
}

async function injectImport(targetFile: vscode.Uri) {
  const document = await vscode.workspace.openTextDocument(targetFile);
  const text = document.getText();
  const importStatement = `import '${RUNTIME_PACKAGE_NAME}';\n`;

  if (text.includes(RUNTIME_PACKAGE_NAME)) {
    return; // Already imported
  }

  const edit = new vscode.WorkspaceEdit();
  const insertLine = getRuntimeImportInsertLine(text);

  edit.insert(targetFile, new vscode.Position(insertLine, 0), importStatement);
  await vscode.workspace.applyEdit(edit);
  await document.save();
}

export function deactivate() {
  if (server) {
    server.close();
  }
}
