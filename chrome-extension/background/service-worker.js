// Persistent client instance for the extension
let figmaClient = null;

// Standard import for non-module service workers
importScripts('../lib/figma-api-client.js');

const panelPorts = new Map(); // tabId -> port

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
        const client = await ensureClient();
        if (client) {
            client.getNode(msg.nodeId, msg.fileKey).then(nodeData => {
                port.postMessage({ action: 'MCP_NODE_DATA', data: nodeData });
            }).catch(err => {
                console.error('[SW] Figma node fetch failed:', err);
                port.postMessage({ action: 'MCP_NODE_FETCH_FAILED', error: err.message });
            });
        } else {
            console.error('[SW] No Figma client available');
            port.postMessage({ action: 'MCP_CONNECTION_FAILED', error: 'No token found. Please connect in settings.' });
        }
        return;
    }

    if (msg.action === 'MCP_GET_IMAGE') {
      const client = await ensureClient();
      if (client) {
        client.getImage(msg.nodeId, msg.fileKey).then(data => {
          port.postMessage({ action: 'MCP_IMAGE_DATA', imageUrl: data.imageUrl });
        }).catch(err => {
          console.error('[SW] Figma image fetch failed:', err);
          port.postMessage({ action: 'MCP_IMAGE_FETCH_FAILED', error: err.message });
        });
      }
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
