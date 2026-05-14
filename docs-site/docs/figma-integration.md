---
id: figma-integration
title: Figma Integration
---

UI Checker talks directly to the Figma REST API from the extension service worker. No proxy server is required.

## Configure Access

1. In Figma, create a personal access token with file content access.
2. Open Chrome DevTools and select the **UI Checker** panel.
3. Open **Workspace Settings**.
4. Paste the token into **Personal Access Token**.
5. Paste a Figma file key, node ID, or full Figma node URL.
6. Click **Connect**.

The token and file key are stored in `chrome.storage.local`.

## Fetch A Node

You can fetch a Figma spec in three ways:

- Paste a full Figma URL into **Figma Node ID Or URL**.
- Paste a raw node ID such as `12:34`.
- Use **Sync Tab** while a Figma file is open in Chrome with a layer selected.

When a node is fetched, UI Checker requests:

- node JSON for style extraction;
- a rendered PNG URL for visual overlay comparison.

## Sync Tab

**Sync Tab** looks for an open Figma tab with a selected node in the URL. It supports both `/design/` and `/file/` URLs and normalizes Figma URL node IDs such as `12-34` into API node IDs such as `12:34`.

Selection priority:

1. Active Figma tab in the current Chrome window.
2. Any other open Figma tab with a selected node.

If the panel has a saved token and the synced tab includes both file key and node ID, UI Checker automatically fetches the Figma spec.

## Cache Behavior

Fetched node data and rendered image URLs are cached in `chrome.storage.local`. Use **Refresh Live** to bypass the cache for the current node.

The cache is useful when repeatedly comparing the same component during implementation.
