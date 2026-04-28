"use strict";
(() => {
  // chrome-extension/lib/figma-api-client.ts
  var FigmaAPIClient = class {
    baseUrl = "https://api.figma.com/v1";
    token;
    constructor(token) {
      this.token = token;
    }
    async _request(path) {
      const response = await fetch(`${this.baseUrl}${path}`, {
        headers: { "X-Figma-Token": this.token }
      });
      if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new Error(`Figma API ${response.status}: ${body || response.statusText}`);
      }
      return response.json();
    }
    /** Verify the token works by fetching the current user. */
    async connect() {
      await this._request("/me");
    }
    /** Fetch a single node's properties from a file. */
    async getNode(nodeId, fileKey) {
      const encodedId = encodeURIComponent(nodeId);
      const data = await this._request(`/files/${fileKey}/nodes?ids=${encodedId}`);
      const node = data.nodes?.[nodeId] || data.nodes?.[Object.keys(data.nodes)[0]];
      if (!node || !node.document) {
        throw new Error("Node not found in Figma file");
      }
      return node.document;
    }
    /** Get a rendered image URL for a node. */
    async getImage(nodeId, fileKey) {
      const encodedId = encodeURIComponent(nodeId);
      const data = await this._request(`/images/${fileKey}?ids=${encodedId}&format=png&scale=2`);
      const imageUrl = data.images?.[nodeId] || data.images?.[Object.keys(data.images)[0]];
      if (!imageUrl) {
        throw new Error("Image render not available for this node");
      }
      return { imageUrl };
    }
  };

  // chrome-extension/background/service-worker.ts
  console.log("[SW] LOADING...");
  var figmaClient = null;
  var panelPorts = /* @__PURE__ */ new Map();
  var bridgeSocket = null;
  async function connectToBridge() {
    const result = await chrome.storage.local.get(["bridgePort"]);
    const port = result.bridgePort || 3e3;
    if (bridgeSocket && bridgeSocket.readyState === WebSocket.OPEN)
      return;
    console.log(`[SW] Attempting WebSocket connection to ws://localhost:${port}`);
    try {
      bridgeSocket = new WebSocket(`ws://localhost:${port}`);
      bridgeSocket.onopen = () => {
        console.log("[SW] SUCCESS: Connected to VS Code Bridge");
        notifyPanelPorts({ action: "BRIDGE_CONNECTED" });
      };
      bridgeSocket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log("[SW] RECEIVE FROM BRIDGE:", data);
        notifyPanelPorts(data);
      };
      bridgeSocket.onclose = () => {
        console.log("[SW] Bridge connection closed");
        notifyPanelPorts({ action: "BRIDGE_DISCONNECTED" });
      };
      bridgeSocket.onerror = (err) => {
        console.error("[SW] Bridge WebSocket Error:", err);
      };
    } catch (e) {
      console.error("[SW] Failed to create WebSocket:", e);
    }
  }
  function notifyPanelPorts(msg) {
    for (const port of panelPorts.values()) {
      try {
        port.postMessage(msg);
      } catch (_) {
      }
    }
  }
  connectToBridge();
  chrome.runtime.onConnect.addListener((port) => {
    let tabId = null;
    port.onMessage.addListener(async (msg) => {
      if (msg.action === "BRIDGE_COMMAND") {
        console.log("[SW] BRIDGE_COMMAND RECEIVED:", msg.payload);
        if (!bridgeSocket || bridgeSocket.readyState !== WebSocket.OPEN) {
          console.log("[SW] Socket not open, attempting reconnect before send...");
          await connectToBridge();
          setTimeout(() => {
            if (bridgeSocket && bridgeSocket.readyState === WebSocket.OPEN) {
              bridgeSocket.send(JSON.stringify(msg.payload));
            } else {
              port.postMessage({ action: "BRIDGE_ERROR", error: "Could not connect to VS Code" });
            }
          }, 800);
        } else {
          bridgeSocket.send(JSON.stringify(msg.payload));
        }
        return;
      }
      if (msg.action === "FIGMA_CONNECT") {
        figmaClient = new FigmaAPIClient(msg.token);
        figmaClient.connect().then(() => port.postMessage({ action: "MCP_CONNECTED" })).catch((err) => port.postMessage({ action: "MCP_CONNECTION_FAILED", error: err.message }));
        return;
      }
      if (msg.action === "MCP_GET_NODE") {
        getNodeData(msg.fileKey, msg.nodeId, Boolean(msg.forceRefresh)).then(({ data, meta }) => port.postMessage({ action: "MCP_NODE_DATA", data, meta, requestId: msg.requestId })).catch((err) => port.postMessage({ action: "MCP_NODE_FETCH_FAILED", error: err.message }));
        return;
      }
      if (msg.action === "INIT" && msg.tabId) {
        tabId = msg.tabId;
        if (tabId !== null) {
          panelPorts.set(tabId, port);
          console.log("[SW] INIT registered tabId:", tabId);
        }
        return;
      }
      if (msg.action === "CAPTURE_ELEMENT" && tabId !== null) {
        console.log("[SW] CAPTURING ELEMENT for tab:", tabId);
        chrome.tabs.get(tabId).then((tab) => {
          return Promise.all([
            chrome.tabs.sendMessage(tabId, { action: "GET_ELEMENT_RECT", selector: msg.selector }),
            chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" })
          ]);
        }).then(([rectData, screenshot]) => {
          if (rectData?.rect) {
            port.postMessage({
              action: "ELEMENT_CAPTURED",
              rect: rectData.rect,
              devicePixelRatio: rectData.devicePixelRatio,
              screenshot
            });
          } else {
            port.postMessage({ action: "ELEMENT_CAPTURE_FAILED" });
          }
        }).catch((err) => {
          console.error("[SW] Capture logic failed:", err);
          port.postMessage({ action: "ELEMENT_CAPTURE_FAILED" });
        });
        return;
      }
      if (tabId !== null) {
        chrome.tabs.sendMessage(tabId, msg).catch(() => {
        });
      }
    });
    port.onDisconnect.addListener(() => {
      if (tabId !== null)
        panelPorts.delete(tabId);
    });
  });
  chrome.runtime.onMessage.addListener((msg, sender) => {
    if (!sender.tab || sender.tab.id === void 0)
      return;
    const port = panelPorts.get(sender.tab.id);
    if (port) {
      try {
        port.postMessage(msg);
      } catch (_) {
      }
    }
  });
  async function getNodeData(fileKey, nodeId, forceRefresh = false) {
    const client = await ensureClient();
    if (!client)
      throw new Error("No token found");
    const nodeData = await client.getNode(nodeId, fileKey);
    return { data: nodeData, meta: { source: "network", cachedAt: Date.now() } };
  }
  async function ensureClient() {
    if (figmaClient)
      return figmaClient;
    const result = await chrome.storage.local.get(["figmaConfig"]);
    if (result.figmaConfig?.token) {
      figmaClient = new FigmaAPIClient(result.figmaConfig.token);
      return figmaClient;
    }
    return null;
  }
})();
