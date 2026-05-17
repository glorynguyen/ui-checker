// --- Figma CSS Diff Service Worker ---
import { FigmaAPIClient } from '../lib/figma-api-client';
import { selectBestFigmaTab } from '../lib/figma-tab-sync';

let figmaClient: FigmaAPIClient | null = null;
let debugLogging = false;

const panelPorts = new Map<number, chrome.runtime.Port>(); // tabId -> port
const FIGMA_NODE_CACHE_KEY = 'figmaNodeCache';
const FIGMA_IMAGE_CACHE_KEY = 'figmaImageCache';
const FIGMA_COMPONENTS_CACHE_KEY = 'figmaComponentsCache';
const FIGMA_CACHE_MAX_ENTRIES = 50;
const FIGMA_TAB_URL_PATTERNS = [
  'https://www.figma.com/file/*',
  'https://www.figma.com/design/*',
  'https://figma.com/file/*',
  'https://figma.com/design/*'
];

function logRuntimeSetup(event: string, details?: Record<string, unknown>) {
  const prefix = '[SW][RuntimeSetup]';
  if (details) {
    console.log(`${prefix} ${event}`, details);
  } else {
    console.log(`${prefix} ${event}`);
  }
}

function debugLog(...args: unknown[]) {
  if (debugLogging) {
    console.log(...args);
  }
}

interface CacheEntry<T> {
  value: T;
  cachedAt: number;
}

interface CacheMeta {
  source: 'cache' | 'network';
  cachedAt: number;
}

// --- VS Code Bridge (WebSocket) ---
let bridgeSocket: WebSocket | null = null;
const DEFAULT_BRIDGE_PORT = 9876;
const injectedTabs = new Set<number>();

async function ensureContentScript(tabId: number) {
  if (injectedTabs.has(tabId)) return;

  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['dist/content/content.js']
    });
    injectedTabs.add(tabId);
  } catch (err) {
    // Static content scripts still cover normal pages; dynamic injection is a
    // best-effort fallback for newly opened inspected tabs.
    debugLog('[SW] Could not dynamically inject content script:', err);
    injectedTabs.add(tabId);
  }
}

function openBridgeSocket(port: number): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    debugLog(`[SW] Attempting WebSocket connection to ws://localhost:${port}`);
    const socket = new WebSocket(`ws://localhost:${port}`);
    let settled = false;
    let opened = false;

    const fail = (err?: unknown) => {
      if (settled) return;
      settled = true;
      try { socket.close(); } catch { /* noop */ }
      reject(err instanceof Error ? err : new Error(`Could not connect to VS Code on port ${port}`));
    };

    socket.onopen = () => {
      settled = true;
      opened = true;
      debugLog('[SW] SUCCESS: Connected to VS Code Bridge');
      notifyPanelPorts({ action: 'BRIDGE_CONNECTED' });
      resolve(socket);
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      debugLog('[SW] RECEIVE FROM BRIDGE:', data);
      if (String(data?.action || '').startsWith('SETUP_RUNTIME')) {
        logRuntimeSetup('received bridge message', {
          action: data.action,
          message: data.message,
          error: data.error,
          panelPortCount: panelPorts.size
        });
      }
      notifyPanelPorts(data);
    };

    socket.onclose = () => {
      if (!settled) {
        fail();
        return;
      }
      if (!opened) return;
      debugLog('[SW] Bridge connection closed');
      notifyPanelPorts({ action: 'BRIDGE_DISCONNECTED' });
    };

    socket.onerror = (err) => {
      console.error('[SW] Bridge WebSocket Error:', err);
      fail(err);
    };
  });
}

async function connectToBridge(): Promise<boolean> {
  const result = await chrome.storage.local.get(['bridgePort']);
  const savedPort = Number(result.bridgePort) || DEFAULT_BRIDGE_PORT;

  if (bridgeSocket && bridgeSocket.readyState === WebSocket.OPEN) return true;

  try {
    bridgeSocket = await openBridgeSocket(savedPort);
    return true;
  } catch (e) {
    if (savedPort === DEFAULT_BRIDGE_PORT) {
      console.error('[SW] Failed to connect to VS Code Bridge:', e);
      return false;
    }

    debugLog(`[SW] Saved bridge port ${savedPort} failed; trying default ${DEFAULT_BRIDGE_PORT}`);
    try {
      bridgeSocket = await openBridgeSocket(DEFAULT_BRIDGE_PORT);
      await chrome.storage.local.set({ bridgePort: DEFAULT_BRIDGE_PORT });
      notifyPanelPorts({
        action: 'BRIDGE_PORT_FALLBACK',
        port: DEFAULT_BRIDGE_PORT,
        previousPort: savedPort
      });
      return true;
    } catch (fallbackError) {
      console.error('[SW] Failed to connect to VS Code Bridge:', fallbackError);
      return false;
    }
  }
}

function notifyPanelPorts(msg: any) {
  if (String(msg?.action || '').startsWith('SETUP_RUNTIME') || msg?.action === 'BRIDGE_ERROR') {
    logRuntimeSetup('forwarding message to panel ports', {
      action: msg.action,
      panelPortCount: panelPorts.size
    });
  }

  for (const port of panelPorts.values()) {
    try {
      port.postMessage(msg);
    } catch (error) {
      if (String(msg?.action || '').startsWith('SETUP_RUNTIME') || msg?.action === 'BRIDGE_ERROR') {
        logRuntimeSetup('failed to post message to panel', {
          action: msg.action,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }
}

chrome.storage.local.get(['debugLogging'], (result) => {
  debugLogging = Boolean(result.debugLogging);
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.debugLogging) {
    debugLogging = Boolean(changes.debugLogging.newValue);
  }
});

connectToBridge();

async function attachNearestSourceLoc(payload: any, tabId: number | null) {
  const canUseNearestSource =
    payload?.action === 'FIND_SELECTOR' ||
    payload?.action === 'APPLY_FIX' ||
    payload?.action === 'APPLY_TAILWIND_CLASS_FIX' ||
    payload?.action === 'GET_PROPS';

  if (!canUseNearestSource || tabId === null) {
    return payload;
  }

  if (payload.sourceLoc) {
    return payload;
  }

  try {
    const nearest = await chrome.tabs.sendMessage(tabId, {
      action: 'QUERY_NEAREST_SOURCE_LOC',
      selector: payload.selector
    });

    if (nearest?.sourceLoc) {
      return {
        ...payload,
        sourceLoc: nearest.sourceLoc,
        sourceName: nearest.sourceName ?? payload.sourceName ?? null
      };
    }
  } catch (e) {
    debugLog('[SW] Could not query nearest data-uic-loc before locate:', e);
  }

  return payload;
}

// --- Main Message Router ---
chrome.runtime.onConnect.addListener((port) => {
  let tabId: number | null = null;

  port.onMessage.addListener(async (msg: any) => {
    // 1. Bridge Commands (Priority 1)
    if (msg.action === 'BRIDGE_COMMAND') {
      const payload = await attachNearestSourceLoc(msg.payload, tabId);
      debugLog('[SW] BRIDGE_COMMAND RECEIVED:', payload);
      if (payload?.action === 'SETUP_RUNTIME') {
        logRuntimeSetup('command received from panel', {
          bridgeReadyState: bridgeSocket?.readyState ?? 'none',
          tabId,
          panelPortCount: panelPorts.size
        });
      }
      if (!bridgeSocket || bridgeSocket.readyState !== WebSocket.OPEN) {
        debugLog('[SW] Socket not open, attempting reconnect before send...');
        if (payload?.action === 'SETUP_RUNTIME') {
          logRuntimeSetup('bridge socket not open; reconnecting before forwarding');
        }
        const connected = await connectToBridge();
        if (connected && bridgeSocket && bridgeSocket.readyState === WebSocket.OPEN) {
          if (payload?.action === 'SETUP_RUNTIME') {
            logRuntimeSetup('forwarding setup command after reconnect');
          }
          bridgeSocket.send(JSON.stringify(payload));
        } else {
          if (payload?.action === 'SETUP_RUNTIME') {
            logRuntimeSetup('failed to connect to bridge for setup command');
          }
          port.postMessage({ action: 'BRIDGE_ERROR', error: 'Could not connect to VS Code. Check the VS Code Bridge port in settings.' });
        }
      } else {
        if (payload?.action === 'SETUP_RUNTIME') {
          logRuntimeSetup('forwarding setup command to VS Code bridge');
        }
        bridgeSocket.send(JSON.stringify(payload));
      }
      return;
    }

    // 2. Figma API
    if (msg.action === 'FIGMA_CONNECT') {
      figmaClient = new FigmaAPIClient(msg.token);
      figmaClient.connect().then(() => port.postMessage({ action: 'MCP_CONNECTED' }))
        .catch(err => port.postMessage({ action: 'MCP_CONNECTION_FAILED', error: err.message }));
      return;
    }

    if (msg.action === 'MCP_GET_NODE') {
      getNodeData(msg.fileKey, msg.nodeId, Boolean(msg.forceRefresh))
        .then(({ data, meta }) => port.postMessage({ action: 'MCP_NODE_DATA', data, meta, requestId: msg.requestId }))
        .catch(err => port.postMessage({ action: 'MCP_NODE_FETCH_FAILED', error: err.message, requestId: msg.requestId }));
      return;
    }

    if (msg.action === 'MCP_GET_IMAGE') {
      getImageData(msg.fileKey, msg.nodeId, Boolean(msg.forceRefresh))
        .then(({ imageUrl, meta }) => port.postMessage({ action: 'MCP_IMAGE_DATA', imageUrl, meta, requestId: msg.requestId }))
        .catch(err => port.postMessage({ action: 'MCP_IMAGE_FETCH_FAILED', error: err.message, requestId: msg.requestId }));
      return;
    }

    if (msg.action === 'MCP_GET_COMPONENTS') {
      getComponentsData(msg.fileKey, Boolean(msg.forceRefresh))
        .then(({ components, meta }) => port.postMessage({ action: 'MCP_COMPONENTS_DATA', components, meta, requestId: msg.requestId }))
        .catch(err => port.postMessage({ action: 'MCP_COMPONENTS_FETCH_FAILED', error: err.message, requestId: msg.requestId }));
      return;
    }

    if (msg.action === 'BATCH_GET_NODE') {
      getNodeData(msg.fileKey, msg.nodeId, Boolean(msg.forceRefresh))
        .then(({ data, meta }) => port.postMessage({ action: 'BATCH_NODE_DATA', data, meta, requestId: msg.requestId }))
        .catch(err => port.postMessage({ action: 'BATCH_NODE_FAILED', error: err.message, requestId: msg.requestId }));
      return;
    }

    // 3. System Actions
    if (msg.action === 'INIT' && msg.tabId) {
      tabId = msg.tabId;
      if (tabId !== null) {
        panelPorts.set(tabId, port);
        debugLog('[SW] INIT registered tabId:', tabId);
        ensureContentScript(tabId).catch((err) => {
          port.postMessage({
            action: 'CONTENT_SCRIPT_INJECTION_FAILED',
            error: err?.message || 'Unable to inject UI Checker content script.'
          });
        });
      }
      return;
    }

    if (msg.action === 'CAPTURE_ELEMENT' && tabId !== null) {
        debugLog('[SW] CAPTURING ELEMENT for tab:', tabId);
        await ensureContentScript(tabId);
        chrome.tabs.get(tabId).then(tab => {
            return Promise.all([
                chrome.tabs.sendMessage(tabId!, { action: 'GET_ELEMENT_RECT', selector: msg.selector }),
                chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' })
            ]);
        }).then(([rectData, screenshot]) => {
            if (rectData?.rect) {
                port.postMessage({
                    action: 'ELEMENT_CAPTURED',
                    rect: rectData.rect,
                    devicePixelRatio: rectData.devicePixelRatio,
                    screenshot
                });
            } else {
                port.postMessage({ action: 'ELEMENT_CAPTURE_FAILED' });
            }
        }).catch(err => {
            console.error('[SW] Capture logic failed:', err);
            port.postMessage({ action: 'ELEMENT_CAPTURE_FAILED' });
        });
        return;
    }

    if (msg.action === 'BATCH_EXTRACT_SELECTOR' && tabId !== null) {
      try {
        await ensureContentScript(tabId);
        const result = await chrome.tabs.sendMessage(tabId, {
          action: 'EXTRACT_SELECTOR',
          selector: msg.selector
        });
        port.postMessage({
          action: 'BATCH_SELECTOR_EXTRACTED',
          requestId: msg.requestId,
          selector: msg.selector,
          ...result
        });
      } catch (err: any) {
        port.postMessage({
          action: 'BATCH_SELECTOR_EXTRACTED',
          requestId: msg.requestId,
          selector: msg.selector,
          error: err?.message || 'Unable to extract selector.'
        });
      }
      return;
    }

    if (msg.action === 'SYNC_FIGMA_TAB') {
      syncFigmaTab(port);
      return;
    }

    // Forward to content script if not handled
    if (tabId !== null) {
      await ensureContentScript(tabId);
      chrome.tabs.sendMessage(tabId, msg).catch(() => {});
    }
  });

  port.onDisconnect.addListener(() => {
    if (tabId !== null) panelPorts.delete(tabId);
  });
});

// --- Forward messages from Content Script to Panel ---
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (!sender.tab || sender.tab.id === undefined) return;
  const port = panelPorts.get(sender.tab.id);
  if (port) {
    try { port.postMessage(msg); } catch (_) {}
  }
});

// --- Figma Helpers ---
async function getNodeData(fileKey: string, nodeId: string, forceRefresh: boolean = false) {
  const client = await ensureClient();
  if (!client) throw new Error('No token found');

  const cacheKey = makeFigmaCacheKey(fileKey, nodeId);
  if (!forceRefresh) {
    const cached = await readFigmaCacheEntry<any>(FIGMA_NODE_CACHE_KEY, cacheKey);
    if (cached) {
      return { data: cached.value, meta: makeCacheMeta('cache', cached.cachedAt) };
    }
  }

  const nodeData = await client.getNode(nodeId, fileKey);
  const cachedAt = Date.now();
  await writeFigmaCacheEntry(FIGMA_NODE_CACHE_KEY, cacheKey, { value: nodeData, cachedAt });
  return { data: nodeData, meta: makeCacheMeta('network', cachedAt) };
}

async function getImageData(fileKey: string, nodeId: string, forceRefresh: boolean = false) {
  const client = await ensureClient();
  if (!client) throw new Error('No token found');

  const cacheKey = makeFigmaCacheKey(fileKey, nodeId);
  if (!forceRefresh) {
    const cached = await readFigmaCacheEntry<string>(FIGMA_IMAGE_CACHE_KEY, cacheKey);
    if (cached) {
      return { imageUrl: cached.value, meta: makeCacheMeta('cache', cached.cachedAt) };
    }
  }

  const imageData = await client.getImage(nodeId, fileKey);
  const cachedAt = Date.now();
  await writeFigmaCacheEntry(FIGMA_IMAGE_CACHE_KEY, cacheKey, { value: imageData.imageUrl, cachedAt });
  return { imageUrl: imageData.imageUrl, meta: makeCacheMeta('network', cachedAt) };
}

async function getComponentsData(fileKey: string, forceRefresh: boolean = false) {
  const client = await ensureClient();
  if (!client) throw new Error('No token found');

  const cacheKey = fileKey;
  if (!forceRefresh) {
    const cached = await readFigmaCacheEntry<any[]>(FIGMA_COMPONENTS_CACHE_KEY, cacheKey);
    if (cached) {
      return { components: cached.value, meta: makeCacheMeta('cache', cached.cachedAt) };
    }
  }

  const components = await client.getComponents(fileKey);
  const cachedAt = Date.now();
  await writeFigmaCacheEntry(FIGMA_COMPONENTS_CACHE_KEY, cacheKey, { value: components, cachedAt });
  return { components, meta: makeCacheMeta('network', cachedAt) };
}

async function ensureClient() {
  if (figmaClient) return figmaClient;
  const result = await chrome.storage.local.get(['figmaConfig']);
  if (result.figmaConfig?.token) {
    figmaClient = new FigmaAPIClient(result.figmaConfig.token);
    return figmaClient;
  }
  return null;
}

async function syncFigmaTab(port: chrome.runtime.Port) {
  try {
    const activeTabs = await chrome.tabs.query({
      active: true,
      currentWindow: true,
      url: FIGMA_TAB_URL_PATTERNS
    });
    const synced = selectBestFigmaTab(activeTabs)
      || selectBestFigmaTab(await chrome.tabs.query({ url: FIGMA_TAB_URL_PATTERNS }));

    if (!synced) {
      port.postMessage({
        action: 'FIGMA_TAB_SYNC_FAILED',
        error: 'No open Figma tab with a selected node was found.'
      });
      return;
    }

    port.postMessage({
      action: 'FIGMA_TAB_SYNCED',
      url: synced.url,
      fileKey: synced.fileKey,
      nodeId: synced.nodeId
    });
  } catch (err: any) {
    port.postMessage({
      action: 'FIGMA_TAB_SYNC_FAILED',
      error: err?.message || 'Unable to inspect open Figma tabs.'
    });
  }
}

function makeFigmaCacheKey(fileKey: string, nodeId: string) {
  return `${fileKey}::${nodeId}`;
}

function makeCacheMeta(source: CacheMeta['source'], cachedAt: number): CacheMeta {
  return { source, cachedAt };
}

async function readFigmaCacheEntry<T>(storageKey: string, cacheKey: string): Promise<CacheEntry<T> | null> {
  const result = await chrome.storage.local.get([storageKey]);
  const cache = result[storageKey] || {};
  const entry = cache[cacheKey] as CacheEntry<T> | undefined;
  return entry && typeof entry.cachedAt === 'number' ? entry : null;
}

async function writeFigmaCacheEntry<T>(storageKey: string, cacheKey: string, entry: CacheEntry<T>) {
  const result = await chrome.storage.local.get([storageKey]);
  const cache = { ...(result[storageKey] || {}), [cacheKey]: entry };
  pruneCache(cache);
  await chrome.storage.local.set({ [storageKey]: cache });
}

function pruneCache(cache: Record<string, CacheEntry<unknown>>) {
  const entries = Object.entries(cache);
  if (entries.length <= FIGMA_CACHE_MAX_ENTRIES) return;

  entries
    .sort(([, a], [, b]) => b.cachedAt - a.cachedAt)
    .slice(FIGMA_CACHE_MAX_ENTRIES)
    .forEach(([key]) => {
      delete cache[key];
    });
}
