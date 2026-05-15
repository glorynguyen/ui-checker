// --- Figma CSS Diff Service Worker ---
import { FigmaAPIClient } from '../lib/figma-api-client';
import { selectBestFigmaTab } from '../lib/figma-tab-sync';

console.log('[SW] LOADING...');

let figmaClient: FigmaAPIClient | null = null;

const panelPorts = new Map<number, chrome.runtime.Port>(); // tabId -> port
const FIGMA_NODE_CACHE_KEY = 'figmaNodeCache';
const FIGMA_IMAGE_CACHE_KEY = 'figmaImageCache';
const FIGMA_CACHE_MAX_ENTRIES = 50;
const FIGMA_TAB_URL_PATTERNS = [
  'https://www.figma.com/file/*',
  'https://www.figma.com/design/*',
  'https://figma.com/file/*',
  'https://figma.com/design/*'
];

function logRuntimeSetup(event: string, details?: Record<string, unknown>) {
  if (details) {
    console.log(`[SW][RuntimeSetup] ${event}`, details);
  } else {
    console.log(`[SW][RuntimeSetup] ${event}`);
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

async function connectToBridge() {
  const result = await chrome.storage.local.get(['bridgePort']);
  const port = result.bridgePort || 9876;

  if (bridgeSocket && bridgeSocket.readyState === WebSocket.OPEN) return;

  console.log(`[SW] Attempting WebSocket connection to ws://localhost:${port}`);
  try {
    bridgeSocket = new WebSocket(`ws://localhost:${port}`);

    bridgeSocket.onopen = () => {
      console.log('[SW] SUCCESS: Connected to VS Code Bridge');
      notifyPanelPorts({ action: 'BRIDGE_CONNECTED' });
    };

    bridgeSocket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log('[SW] RECEIVE FROM BRIDGE:', data);
      notifyPanelPorts(data);
    };

    bridgeSocket.onclose = () => {
      console.log('[SW] Bridge connection closed');
      notifyPanelPorts({ action: 'BRIDGE_DISCONNECTED' });
    };

    bridgeSocket.onerror = (err) => {
      console.error('[SW] Bridge WebSocket Error:', err);
    };
  } catch (e) {
    console.error('[SW] Failed to create WebSocket:', e);
  }
}

function notifyPanelPorts(msg: any) {
  for (const port of panelPorts.values()) {
    try { port.postMessage(msg); } catch (_) {}
  }
}

connectToBridge();

async function attachNearestSourceLoc(payload: any, tabId: number | null) {
  if (payload?.action !== 'FIND_SELECTOR' || tabId === null) {
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
    console.warn('[SW] Could not query nearest data-uic-loc before locate:', e);
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
      console.log('[SW] BRIDGE_COMMAND RECEIVED:', payload);
      if (payload?.action === 'SETUP_RUNTIME') {
        logRuntimeSetup('command received from panel', {
          bridgeReadyState: bridgeSocket?.readyState ?? 'none'
        });
      }
      if (!bridgeSocket || bridgeSocket.readyState !== WebSocket.OPEN) {
        console.log('[SW] Socket not open, attempting reconnect before send...');
        if (payload?.action === 'SETUP_RUNTIME') {
          logRuntimeSetup('bridge socket not open; reconnecting before forwarding');
        }
        await connectToBridge();
        setTimeout(() => {
          if (bridgeSocket && bridgeSocket.readyState === WebSocket.OPEN) {
            if (payload?.action === 'SETUP_RUNTIME') {
              logRuntimeSetup('forwarding setup command after reconnect');
            }
            bridgeSocket.send(JSON.stringify(payload));
          } else {
            if (payload?.action === 'SETUP_RUNTIME') {
              logRuntimeSetup('failed to connect to bridge for setup command');
            }
            port.postMessage({ action: 'BRIDGE_ERROR', error: 'Could not connect to VS Code' });
          }
        }, 800);
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

    // 3. System Actions
    if (msg.action === 'INIT' && msg.tabId) {
      tabId = msg.tabId;
      if (tabId !== null) {
        panelPorts.set(tabId, port);
        console.log('[SW] INIT registered tabId:', tabId);
      }
      return;
    }

    if (msg.action === 'CAPTURE_ELEMENT' && tabId !== null) {
        console.log('[SW] CAPTURING ELEMENT for tab:', tabId);
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

    if (msg.action === 'SYNC_FIGMA_TAB') {
      syncFigmaTab(port);
      return;
    }

    // Forward to content script if not handled
    if (tabId !== null) {
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
