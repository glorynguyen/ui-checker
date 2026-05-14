---
id: architecture
title: Architecture
---

UI Checker is split into browser extension code, shared comparison logic, optional editor integration, and CI tooling.

## Extension Runtime

```text
Chrome DevTools Panel
        |
        v
Extension Service Worker
        |
        +--> Figma REST API
        +--> inspected tab content script
        +--> local VS Code bridge
```

## Main Extension Modules

| Path | Responsibility |
| --- | --- |
| `chrome-extension/panel/` | DevTools UI, settings, comparison workflow, overlay rendering. |
| `chrome-extension/background/` | Figma API requests, tab sync, element capture, VS Code bridge forwarding. |
| `chrome-extension/content/` | Element picker, computed style extraction, element rect lookup. |
| `chrome-extension/lib/` | Shared parser, normalizer, diff engine, pixel diff, token validation, Figma helpers. |

## Shared Comparison Pipeline

1. Extract browser computed styles from a selected DOM element.
2. Parse expected styles from Figma CSS or Figma node JSON.
3. Normalize both style maps.
4. Compare with tolerance-aware diffing.
5. Enrich results with source declarations, CSS variable metadata, and token validation.
6. Render grouped results and exportable reports.

## Persistence

The extension uses `chrome.storage.local` for:

- Figma token and file key;
- tolerance settings;
- bridge port;
- cached Figma node data and image URLs;
- saved CSS variable mappings;
- imported design tokens.

## CI Runtime

The CLI runner reads JSON config, extracts DOM styles from target pages, fetches Figma nodes, and produces JSON/Markdown reports.

```text
Config file --> CLI runner --> target page + Figma API --> diff report
```
