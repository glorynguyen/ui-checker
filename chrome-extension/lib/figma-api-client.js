/**
 * FigmaAPIClient - Direct communication with the Figma REST API.
 * Designed to run in the extension service worker (no CORS restrictions).
 */
class FigmaAPIClient {
  constructor(token) {
    this.baseUrl = 'https://api.figma.com/v1';
    this.token = token;
  }

  async _request(path) {
    const response = await fetch(`${this.baseUrl}${path}`, {
      headers: { 'X-Figma-Token': this.token }
    });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`Figma API ${response.status}: ${body || response.statusText}`);
    }
    return response.json();
  }

  /** Verify the token works by fetching the current user. */
  async connect() {
    await this._request('/me');
  }

  /** Fetch a single node's properties from a file. */
  async getNode(nodeId, fileKey) {
    const encodedId = encodeURIComponent(nodeId);
    const data = await this._request(`/files/${fileKey}/nodes?ids=${encodedId}`);
    const node = data.nodes?.[nodeId] || data.nodes?.[Object.keys(data.nodes)[0]];
    if (!node || !node.document) {
      throw new Error('Node not found in Figma file');
    }
    return node.document;
  }

  /** Get a rendered image URL for a node. */
  async getImage(nodeId, fileKey) {
    const encodedId = encodeURIComponent(nodeId);
    const data = await this._request(`/images/${fileKey}?ids=${encodedId}&format=png&scale=2`);
    const imageUrl = data.images?.[nodeId] || data.images?.[Object.keys(data.images)[0]];
    if (!imageUrl) {
      throw new Error('Image render not available for this node');
    }
    return { imageUrl };
  }
}

// Ensure it's available in global scope (ServiceWorker or Window)
if (typeof self !== 'undefined') {
  self.FigmaAPIClient = FigmaAPIClient;
}
