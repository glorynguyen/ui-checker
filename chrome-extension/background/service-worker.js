// Persistent client instance for the extension
let figmaClient = null;

// Standard import for non-module service workers
importScripts('../lib/figma-api-client.js');

const panelPorts = new Map(); // tabId -> port
const FIGMA_CACHE_STORAGE_KEY = 'figmaNodeCache';
const FIGMA_CACHE_TTL_MS = 10 * 60 * 1000;

function getCacheKey(fileKey, nodeId) {
  return `${fileKey}::${nodeId}`;
}

async function getFigmaCache() {
  const result = await chrome.storage.local.get([FIGMA_CACHE_STORAGE_KEY]);
  return result[FIGMA_CACHE_STORAGE_KEY] || {};
}

async function setFigmaCache(cache) {
  await chrome.storage.local.set({ [FIGMA_CACHE_STORAGE_KEY]: cache });
}

async function pruneExpiredCache(cache) {
  const nextCache = { ...cache };
  const now = Date.now();
  let changed = false;

  for (const [key, entry] of Object.entries(nextCache)) {
    if (!entry || !entry.updatedAt || now - entry.updatedAt > FIGMA_CACHE_TTL_MS) {
      delete nextCache[key];
      changed = true;
    }
  }

  if (changed) {
    await setFigmaCache(nextCache);
  }

  return nextCache;
}

async function readCacheEntry(fileKey, nodeId) {
  const cache = await pruneExpiredCache(await getFigmaCache());
  return cache[getCacheKey(fileKey, nodeId)] || null;
}

async function writeCacheEntry(fileKey, nodeId, patch) {
  const cache = await pruneExpiredCache(await getFigmaCache());
  const key = getCacheKey(fileKey, nodeId);
  const existing = cache[key] || {};
  const updatedAt = patch.updatedAt || existing.updatedAt || Date.now();

  cache[key] = {
    ...existing,
    ...patch,
    updatedAt
  };

  await setFigmaCache(cache);
  return cache[key];
}

function buildCacheMeta(entry, source, assetType) {
  return {
    key: entry?.cacheKey || null,
    assetType,
    source,
    cachedAt: entry?.updatedAt || Date.now(),
    ttlMs: FIGMA_CACHE_TTL_MS
  };
}

async function getNodeData(fileKey, nodeId, forceRefresh = false) {
  const cacheKey = getCacheKey(fileKey, nodeId);
  const cached = forceRefresh ? null : await readCacheEntry(fileKey, nodeId);
  if (cached?.nodeData) {
    return {
      data: cached.nodeData,
      meta: buildCacheMeta({ ...cached, cacheKey }, 'cache', 'node')
    };
  }

  const client = await ensureClient();
  if (!client) {
    throw new Error('No token found. Please connect in settings.');
  }

  const nodeData = await client.getNode(nodeId, fileKey);
  const updatedEntry = await writeCacheEntry(fileKey, nodeId, {
    cacheKey,
    nodeData,
    updatedAt: Date.now()
  });

  return {
    data: nodeData,
    meta: buildCacheMeta({ ...updatedEntry, cacheKey }, 'network', 'node')
  };
}

async function getImageData(fileKey, nodeId, forceRefresh = false) {
  const cacheKey = getCacheKey(fileKey, nodeId);
  const cached = forceRefresh ? null : await readCacheEntry(fileKey, nodeId);
  if (cached?.imageUrl) {
    return {
      imageUrl: cached.imageUrl,
      meta: buildCacheMeta({ ...cached, cacheKey }, 'cache', 'image')
    };
  }

  const client = await ensureClient();
  if (!client) {
    throw new Error('No token found. Please connect in settings.');
  }

  const imageData = await client.getImage(nodeId, fileKey);
  const updatedEntry = await writeCacheEntry(fileKey, nodeId, {
    cacheKey,
    imageUrl: imageData.imageUrl,
    updatedAt: Date.now()
  });

  return {
    imageUrl: imageData.imageUrl,
    meta: buildCacheMeta({ ...updatedEntry, cacheKey }, 'network', 'image')
  };
}

async function ensureClient() {
  if (figmaClient) return figmaClient;

  // Try to restore from storage
  const result = await chrome.storage.local.get(['figmaConfig']);
  if (result.figmaConfig && result.figmaConfig.token) {
    console.log('[SW] Restoring figmaClient from storage...');
    figmaClient = new FigmaAPIClient(result.figmaConfig.token);
    return figmaClient;
  }
  return null;
}

chrome.runtime.onConnect.addListener((port) => {
  let tabId = null;

  port.onMessage.addListener(async (msg) => {
    // Handle Figma API connection (token validation)
    if (msg.action === 'FIGMA_CONNECT') {
      figmaClient = new FigmaAPIClient(msg.token);
      figmaClient.connect().then(() => {
        port.postMessage({ action: 'MCP_CONNECTED' });
      }).catch((err) => {
        figmaClient = null;
        port.postMessage({ action: 'MCP_CONNECTION_FAILED', error: err.message });
      });
      return;
    }

    if (msg.action === 'MCP_GET_NODE') {
      getNodeData(msg.fileKey, msg.nodeId, Boolean(msg.forceRefresh)).then(({ data, meta }) => {
        port.postMessage({ action: 'MCP_NODE_DATA', data, meta, requestId: msg.requestId });
      }).catch(err => {
        console.error('[SW] Figma node fetch failed:', err);
        if (err.message === 'No token found. Please connect in settings.') {
          port.postMessage({ action: 'MCP_CONNECTION_FAILED', error: err.message, requestId: msg.requestId });
          return;
        }
        port.postMessage({ action: 'MCP_NODE_FETCH_FAILED', error: err.message, requestId: msg.requestId });
      });
      return;
    }

    if (msg.action === 'MCP_GET_IMAGE') {
      getImageData(msg.fileKey, msg.nodeId, Boolean(msg.forceRefresh)).then(({ imageUrl, meta }) => {
        port.postMessage({ action: 'MCP_IMAGE_DATA', imageUrl, meta, requestId: msg.requestId });
      }).catch(err => {
        console.error('[SW] Figma image fetch failed:', err);
        if (err.message === 'No token found. Please connect in settings.') {
          port.postMessage({ action: 'MCP_CONNECTION_FAILED', error: err.message, requestId: msg.requestId });
          return;
        }
        port.postMessage({ action: 'MCP_IMAGE_FETCH_FAILED', error: err.message, requestId: msg.requestId });
      });
      return;
    }

    console.log('[SW] port.onMessage:', msg.action);
    if (msg.action === 'PING') {
      try { port.postMessage({ action: 'PONG' }); } catch (_) {}
      return;
    }
    if (msg.action === 'INIT' && msg.tabId) {
      tabId = msg.tabId;
      panelPorts.set(tabId, port);
      console.log('[SW] INIT registered tabId:', tabId);
      return;
    }

    if (msg.action === 'SYNC_FIGMA_TAB') {
      chrome.tabs.query({ url: '*://*.figma.com/*' }, (tabs) => {
        if (tabs && tabs.length > 0) {
          const activeTab = tabs.find(t => t.active) || tabs[0];
          port.postMessage({ action: 'FIGMA_TAB_SYNCED', url: activeTab.url });
        } else {
          port.postMessage({ action: 'FIGMA_TAB_SYNC_FAILED', error: 'No open Figma tabs found.' });
        }
      });
      return;
    }

    // Handle CAPTURE_ELEMENT: orchestrate rect + screenshot, then reply to panel
    if (msg.action === 'CAPTURE_ELEMENT' && tabId) {
      console.log('[SW] CAPTURE_ELEMENT received, tabId:', tabId, 'selector:', msg.selector);
      let replied = false;
      const reply = (message) => {
        if (replied) { console.log('[SW] Already replied, ignoring:', message.action); return; }
        replied = true;
        console.log('[SW] Replying:', message.action, message.rect ? 'rect=' + JSON.stringify(message.rect) : '', message.screenshot ? 'screenshot=yes' : 'screenshot=no');
        try { port.postMessage(message); } catch (e) { console.error('[SW] port.postMessage failed:', e); }
      };

      // Safety timeout: never let the button hang forever
      setTimeout(() => { console.warn('[SW] 5s timeout hit'); reply({ action: 'ELEMENT_CAPTURE_FAILED' }); }, 5000);

      chrome.tabs.get(tabId).then((tab) => {
        console.log('[SW] tab.windowId:', tab.windowId, 'tab.url:', tab.url);
        return Promise.all([
          chrome.tabs.sendMessage(tabId, { action: 'GET_ELEMENT_RECT', selector: msg.selector }),
          chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' })
        ]);
      }).then(([rectData, screenshot]) => {
        console.log('[SW] rectData:', JSON.stringify(rectData), 'screenshot length:', screenshot ? screenshot.length : 'null');
        if (rectData && rectData.rect) {
          reply({
            action: 'ELEMENT_CAPTURED',
            rect: rectData.rect,
            devicePixelRatio: rectData.devicePixelRatio,
            screenshot
          });
        } else {
          console.warn('[SW] rectData missing or no rect property');
          reply({ action: 'ELEMENT_CAPTURE_FAILED' });
        }
      }).catch((err) => {
        console.error('[SW] CAPTURE_ELEMENT error:', err, err?.message, err?.stack);
        reply({ action: 'ELEMENT_CAPTURE_FAILED' });
      });
      return;
    }

    // Forward all other panel messages to content script
    if (tabId) {
      chrome.tabs.sendMessage(tabId, msg).catch(() => {});
    }
  });

  port.onDisconnect.addListener(() => {
    if (tabId) {
      panelPorts.delete(tabId);
      chrome.tabs.sendMessage(tabId, { action: 'CANCEL_PICKER' }).catch(() => {});
    }
  });
});

// Forward content script messages to the panel
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (!sender.tab) return;
  const port = panelPorts.get(sender.tab.id);
  if (port) {
    try { port.postMessage(msg); } catch (_) {}
  }
});
