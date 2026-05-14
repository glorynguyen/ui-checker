import { spawn, ChildProcessWithoutNullStreams } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ALL_PROPERTIES } from '../../chrome-extension/lib/style-extractor';
import { DomExtraction } from '../types';

type PendingCommand = {
  resolve: (value: any) => void;
  reject: (error: Error) => void;
};

/* node:coverage ignore start */
class CdpSocket {
  private nextId = 1;
  private pending = new Map<number, PendingCommand>();
  private events = new Map<string, Array<(params: any) => void>>();

  constructor(private ws: WebSocket) {
    ws.addEventListener('message', (event) => {
      const msg = JSON.parse(String(event.data));
      if (msg.id && this.pending.has(msg.id)) {
        const pending = this.pending.get(msg.id)!;
        this.pending.delete(msg.id);
        if (msg.error) {
          pending.reject(new Error(msg.error.message || 'Chrome DevTools Protocol error'));
        } else {
          pending.resolve(msg.result);
        }
        return;
      }

      if (msg.method) {
        for (const handler of this.events.get(msg.method) || []) {
          handler(msg.params);
        }
      }
    });
  }

  static async connect(url: string) {
    const ws = new WebSocket(url);
    await new Promise<void>((resolve, reject) => {
      ws.addEventListener('open', () => resolve(), { once: true });
      ws.addEventListener('error', () => reject(new Error(`Unable to connect to Chrome at ${url}`)), { once: true });
    });
    return new CdpSocket(ws);
  }

  send(method: string, params: Record<string, unknown> = {}) {
    const id = this.nextId++;
    const payload = JSON.stringify({ id, method, params });
    this.ws.send(payload);
    return new Promise<any>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
  }

  once(method: string) {
    return new Promise<any>((resolve) => {
      const handler = (params: any) => {
        const list = this.events.get(method) || [];
        this.events.set(method, list.filter((item) => item !== handler));
        resolve(params);
      };
      this.events.set(method, [...(this.events.get(method) || []), handler]);
    });
  }

  close() {
    this.ws.close();
  }
}

export async function extractDomStyles(url: string, selector: string, timeoutMs = 10000): Promise<DomExtraction> {
  const chrome = await launchChrome();
  let browser: CdpSocket | null = null;
  let page: CdpSocket | null = null;

  try {
    const browserWs = await readBrowserWebSocketUrl(chrome.userDataDir);
    browser = await CdpSocket.connect(browserWs);
    const target = await browser.send('Target.createTarget', { url: 'about:blank' });
    const pageWs = await findPageWebSocket(chrome.port, target.targetId);
    page = await CdpSocket.connect(pageWs);

    await page.send('Page.enable');
    await page.send('Runtime.enable');

    const loaded = page.once('Page.loadEventFired');
    await page.send('Page.navigate', { url });
    await loaded;

    await page.send('Runtime.evaluate', {
      expression: waitForSelectorExpression(selector, timeoutMs),
      awaitPromise: true,
      returnByValue: true
    });

    const result = await page.send('Runtime.evaluate', {
      expression: extractExpression(selector),
      returnByValue: true
    });

    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.text || 'DOM extraction failed');
    }

    return result.result.value as DomExtraction;
  } finally {
    page?.close();
    browser?.close();
    chrome.process.kill();
    await rm(chrome.userDataDir, { recursive: true, force: true });
  }
}

async function launchChrome() {
  const chromePath = resolveChromePath();
  const userDataDir = await mkdtemp(join(tmpdir(), 'ui-checker-ci-'));
  const args = [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--remote-debugging-port=0',
    `--user-data-dir=${userDataDir}`,
    'about:blank'
  ];

  const child = spawn(chromePath, args, { stdio: 'pipe' });
  child.on('error', () => {});
  return { process: child, userDataDir, port: await readDevToolsPort(userDataDir, child) };
}

async function readDevToolsPort(userDataDir: string, child: ChildProcessWithoutNullStreams) {
  const activePortPath = join(userDataDir, 'DevToolsActivePort');
  const startedAt = Date.now();
  while (Date.now() - startedAt < 10000) {
    if (child.exitCode !== null) {
      throw new Error('Chrome exited before DevTools became available.');
    }
    if (existsSync(activePortPath)) {
      const [port] = (await readFile(activePortPath, 'utf8')).trim().split('\n');
      return Number(port);
    }
    await delay(50);
  }
  throw new Error('Timed out waiting for Chrome DevTools port.');
}

async function readBrowserWebSocketUrl(userDataDir: string) {
  const activePortPath = join(userDataDir, 'DevToolsActivePort');
  const [, browserPath] = (await readFile(activePortPath, 'utf8')).trim().split('\n');
  const port = Number((await readFile(activePortPath, 'utf8')).trim().split('\n')[0]);
  return `ws://127.0.0.1:${port}${browserPath}`;
}

async function findPageWebSocket(port: number, targetId: string) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 10000) {
    const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then((res) => res.json()) as any[];
    const target = targets.find((item) => item.id === targetId);
    if (target?.webSocketDebuggerUrl) return target.webSocketDebuggerUrl as string;
    await delay(50);
  }
  throw new Error('Timed out waiting for Chrome page target.');
}

function resolveChromePath() {
  const candidates = [
    process.env.CHROME_PATH,
    process.env.CHROMIUM_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser'
  ].filter(Boolean) as string[];

  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) {
    throw new Error('Chrome/Chromium not found. Set CHROME_PATH to the browser executable.');
  }
  return found;
}
/* node:coverage ignore stop */

export function waitForSelectorExpression(selector: string, timeoutMs: number) {
  return `new Promise((resolve, reject) => {
    const selector = ${JSON.stringify(selector)};
    const timeoutMs = ${timeoutMs};
    const startedAt = Date.now();
    const tick = () => {
      if (document.querySelector(selector)) {
        resolve(true);
        return;
      }
      if (Date.now() - startedAt > timeoutMs) {
        reject(new Error('Selector not found: ' + selector));
        return;
      }
      setTimeout(tick, 50);
    };
    tick();
  })`;
}

export function extractExpression(selector: string) {
  return `(() => {
    const selector = ${JSON.stringify(selector)};
    const props = ${JSON.stringify(ALL_PROPERTIES)};
    const el = document.querySelector(selector);
    if (!el) throw new Error('Selector not found: ' + selector);
    const computed = window.getComputedStyle(el);
    const rootComputed = window.getComputedStyle(document.documentElement);
    const rect = el.getBoundingClientRect();
    const styles = {};
    for (const prop of props) {
      styles[prop] = computed.getPropertyValue(prop).trim();
    }
    return {
      url: window.location.href,
      selector,
      rootFontSize: parseFloat(rootComputed.fontSize) || 16,
      dimensions: {
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      },
      styles
    };
  })()`;
}

/* node:coverage ignore next 3 */
function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
