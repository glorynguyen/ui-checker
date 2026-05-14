---
id: installation
title: Installation
---

## Prerequisites

- Node.js 18 or newer.
- Chrome or another Chromium browser that supports Manifest V3 DevTools extensions.
- A Figma personal access token with file content access.

## Install Dependencies

From the repository root:

```bash
npm install
```

## Build The Extension

```bash
npm run build:extension
```

This writes bundled browser files to `chrome-extension/dist/`, which is the path referenced by `chrome-extension/manifest.json`.

## Load In Chrome

1. Open `chrome://extensions/`.
2. Enable Developer mode.
3. Click **Load unpacked**.
4. Select the repository's `chrome-extension/` folder.
5. Open DevTools on any web page.
6. Select the **UI Checker** panel.

## Run The Docs Site

The docs site lives in `docs-site/`.

```bash
npm run docs:install
npm run docs:dev
```

Docusaurus starts on `http://localhost:3000` by default.

## Production Docs Build

```bash
npm run docs:build
npm run docs:serve
```

The static output is written to `docs-site/build/`.
