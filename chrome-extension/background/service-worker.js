// Relay messages between DevTools panel and content scripts.
// The panel uses chrome.runtime.sendMessage, the content script listens via
// chrome.runtime.onMessage. We need to bridge them because the panel doesn't
// have direct access to the inspected tab.

const panelPorts = new Map(); // tabId -> port

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'figma-diff-panel') return;

  let tabId = null;

  port.onMessage.addListener((msg) => {
    if (msg.action === 'INIT' && msg.tabId) {
      tabId = msg.tabId;
      panelPorts.set(tabId, port);
      return;
    }

    // Forward panel messages to content script
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
