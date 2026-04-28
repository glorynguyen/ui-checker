const vscode = require('vscode');
const { WebSocketServer, WebSocket } = require('ws');
const { calculateScore } = require('./search-logic');

let wss;
let statusBarItem;
let outputChannel;

function log(message) {
    if (!outputChannel) {
        outputChannel = vscode.window.createOutputChannel("UI Checker Bridge");
    }
    const timestamp = new Date().toLocaleTimeString();
    outputChannel.appendLine(`[${timestamp}] ${message}`);
}

function getPort() {
    return vscode.workspace.getConfiguration('ui-checker-bridge').get('port') || 3000;
}

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
    log('UI Checker Bridge activating...');

    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = 'ui-checker-bridge.startServer';
    statusBarItem.text = '$(circle-slash) UI Bridge: Offline';
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);

    async function startServer(force = false) {
        const port = getPort();

        if (force) {
            log('Attempting to force takeover of port...');
            await attemptTakeover(port);
        }

        if (wss) {
            wss.close();
            wss = null;
        }

        try {
            wss = new WebSocketServer({ port });
            
            wss.on('listening', () => {
                log(`SUCCESS: Server listening on ${port}`);
                statusBarItem.text = `$(zap) UI Bridge: ${port}`;
                statusBarItem.tooltip = 'Bridge is active and following this window.';
                statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.prominentBackground');
            });

            wss.on('connection', (ws) => {
                log('NEW CONNECTION');
                statusBarItem.text = `$(broadcast) UI Bridge: Connected`;
                
                ws.on('message', async (message) => {
                    try {
                        const data = JSON.parse(message);
                        
                        if (data.action === 'RELEASE_PORT_REQUEST') {
                            log('Releasing port for another VS Code window...');
                            wss.close();
                            wss = null;
                            statusBarItem.text = '$(clock) UI Bridge: Standby';
                            statusBarItem.tooltip = 'Click to take over bridge for this window.';
                            statusBarItem.backgroundColor = undefined;
                            return;
                        }

                        if (data.action === 'FIND_SELECTOR') {
                            await handleSmartSearch(data.selector, ws);
                        }
                    } catch (err) {
                        log(`ERROR: ${err.message}`);
                    }
                });

                ws.on('close', () => {
                    if (wss) statusBarItem.text = `$(zap) UI Bridge: ${getPort()}`;
                });
            });

            wss.on('error', (err) => {
                if (err.code === 'EADDRINUSE') {
                    log(`PORT BUSY: Port ${port} is in use.`);
                    statusBarItem.text = `$(clock) UI Bridge: Standby`;
                    statusBarItem.tooltip = 'Another VS Code window is active. Click to take over.';
                    statusBarItem.backgroundColor = undefined;
                }
            });

        } catch (err) {
            log(`FATAL: ${err.message}`);
        }
    }

    function attemptTakeover(port) {
        return new Promise((resolve) => {
            const client = new WebSocket(`ws://localhost:${port}`);
            const timeout = setTimeout(() => { client.terminate(); resolve(); }, 500);
            
            client.on('open', () => {
                client.send(JSON.stringify({ action: 'RELEASE_PORT_REQUEST' }));
                setTimeout(() => {
                    client.close();
                    clearTimeout(timeout);
                    resolve();
                }, 100);
            });
            client.on('error', () => {
                clearTimeout(timeout);
                resolve();
            });
        });
    }

    // --- MAGIC FEATURE: Auto-Takeover on Focus ---
    // When you start working in this window, it automatically takes the bridge
    context.subscriptions.push(vscode.window.onDidChangeWindowState(e => {
        if (e.focused && statusBarItem.text.includes('Standby')) {
            const autoSwitch = vscode.workspace.getConfiguration('ui-checker-bridge').get('autoTakeover') !== false;
            if (autoSwitch) {
                log('Window focused. Auto-taking over bridge...');
                startServer(true);
            }
        }
    }));

    startServer();

    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('ui-checker-bridge.port')) startServer();
    }));

    context.subscriptions.push(vscode.commands.registerCommand('ui-checker-bridge.startServer', () => startServer(true)));
}

async function detectFrameworks() {
    const tailwindConfig = await vscode.workspace.findFiles('tailwind.config.{js,ts,cjs}', '**/node_modules/**', 1);
    const packageJson = await vscode.workspace.findFiles('package.json', '**/node_modules/**', 1);

    let isTailwind = tailwindConfig.length > 0;

    if (!isTailwind && packageJson.length > 0) {
        try {
            const doc = await vscode.workspace.openTextDocument(packageJson[0]);
            const text = doc.getText();
            isTailwind = text.includes('"tailwindcss"');
        } catch (e) {}
    }

    log(`Framework Detection: Tailwind=${isTailwind}`);
    return { isTailwind };
}

async function handleSmartSearch(fullSelector, ws) {
    log(`--- Smart Search Started: ${fullSelector} ---`);

    const { isTailwind } = await detectFrameworks();
    // Exclude node_modules and common build/coverage artifacts
    const excludePattern = '{**/node_modules/**,**/coverage/**,**/.next/**,**/build/**,**/dist/**,**/.git/**}';
    const files = await vscode.workspace.findFiles('**/*.{css,scss,tsx,jsx,html,js,vue,svelte}', excludePattern);
    let candidates = [];

    const activeFilePath = vscode.window.activeTextEditor?.document.uri.fsPath;

    for (const file of files) {
        try {
            const document = await vscode.workspace.openTextDocument(file);
            const text = document.getText();
            const isActiveFile = file.fsPath === activeFilePath;

            // Pass the framework info to the scoring engine
            const { score, line } = calculateScore(fullSelector, text, isActiveFile, { 
                isTailwind, 
                fileName: file.fsPath 
            });
            if (score > 0) candidates.push({ file: file.fsPath, line, score });
        } catch (e) {}
    }

    candidates.sort((a, b) => b.score - a.score);

    if (candidates.length > 0) {
        const best = candidates[0];
        log(`BEST MATCH: ${best.file} (Score: ${best.score})`);
        const doc = await vscode.workspace.openTextDocument(best.file);
        const editor = await vscode.window.showTextDocument(doc, { preview: true });
        const pos = new vscode.Position(best.line - 1, 0);
        editor.selection = new vscode.Selection(pos, pos);
        editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
        ws.send(JSON.stringify({ action: 'SELECTOR_RESULTS', matches: [{ file: best.file, line: best.line }] }));
    } else {
        ws.send(JSON.stringify({ action: 'SELECTOR_RESULTS', matches: [] }));
    }
}

function deactivate() {
    if (wss) wss.close();
}

module.exports = { activate, deactivate };
