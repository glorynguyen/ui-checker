---
id: intro
title: UI Checker
slug: /
---

UI Checker is a Chrome DevTools extension for comparing live browser rendering against Figma design specs. It helps frontend teams catch styling drift in spacing, typography, color, sizing, borders, and component layout without relying on manual visual inspection.

The extension is built around a fast loop:

1. Select a live DOM element in the inspected page.
2. Fetch or paste the matching Figma node spec.
3. Compare computed browser styles against expected design values.
4. Copy fixes, locate source code, or export a report.

## What It Includes

| Capability | Purpose |
| --- | --- |
| Element picker | Select an element from the inspected page and extract computed styles. |
| Figma integration | Fetch node JSON and rendered images directly from the Figma REST API. |
| Figma tab sync | Pull the file key and selected node ID from an open Figma tab. |
| Style diffing | Compare normalized Figma and browser styles with configurable tolerance. |
| CSS variable workflow | Resolve, override, save, import, and export `var()` fallback mappings. |
| Visual overlay | Compare selected element screenshots with Figma images using onion-skin, side-by-side, and pixel-diff views. |
| Design tokens | Import token JSON and flag hardcoded or unmapped expected values. |
| VS Code bridge | Jump from a mismatch or active selection in DevTools to source code in VS Code. |
| CI runner | Run style checks outside Chrome from a JSON config. |

## Recommended First Run

```bash
npm install
npm run build:extension
```

Then load `chrome-extension/` as an unpacked extension in Chrome.

## Documentation Structure

- [Installation](./installation.md): install the Chrome extension and docs site.
- [Figma Integration](./figma-integration.md): token setup, node fetch, cache, and tab sync.
- [Compare Elements](./workflows/compare-elements.md): the main DevTools workflow.
- [Visual Overlay](./workflows/visual-overlay.md): screenshot and pixel comparison.
- [Design Tokens](./design-tokens.md): token import and token coverage.
- [VS Code Bridge](./vscode-bridge.md): editor navigation.
- [CI Runner](./ci.md): automated style checks.
- [Architecture](./architecture.md): extension modules and data flow.
- [Troubleshooting](./troubleshooting.md): common failures and fixes.
