// Relay messages between DevTools panel and content scripts.
// The panel uses chrome.runtime.sendMessage, the content script listens via
// chrome.runtime.onMessage. We need to bridge them because the panel doesn't
// have direct access to the inspected tab.

const panelPorts = new Map(); // tabId -> port

chrome.runtime.onConnect.addListener((port) => {
  console.log('[SW] onConnect, port.name:', port.name);
  if (port.name !== 'figma-diff-panel') return;

  let tabId = null;

  port.onMessage.addListener((msg) => {
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
      chrome.tabs.sendMessage(tabId, msg);
    }
  });

  port.onDisconnect.addListener(() => {
    if (tabId) {
      panelPorts.delete(tabId);
      // Tell content script to cancel picker if panel closes
      chrome.tabs.sendMessage(tabId, { action: 'CANCEL_PICKER' }).catch(() => {});
    }
  });
});

// Forward content script messages to the panel
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (!sender.tab) return;
  const port = panelPorts.get(sender.tab.id);
  if (port) {
    port.postMessage(msg);
  }
});
