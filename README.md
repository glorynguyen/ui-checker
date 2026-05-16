# Figma CSS Diff - Chrome DevTools Extension

A Chrome DevTools extension that helps frontend developers catch visual discrepancies between Figma designs and actual browser rendering. Compare computed browser styles against Figma Dev Mode CSS specs to identify mismatches in spacing, typography, colors, and more.

---

## Key Features

- **Direct Figma Integration**: Fetch live design data directly from the Figma REST API — no proxy or bridge server required.
- **Figma Fetch Cache**: Reuse recently fetched node specs and rendered image URLs for faster repeat comparisons, with **Refresh Live** when you need fresh design data.
- **Automated Component Matching**: Automatically find the matching Figma node based on React component names extracted from the browser.
- **Smart URL Parsing**: Paste a full Figma URL and the tool automatically extracts the File Key and Node ID.
- **Visual Element Picker**: Hover-highlight and click-select elements on your page to extract 40+ computed styles.
- **One-Click Fixes**: Click the "Fix" button next to any mismatch to copy the correct Figma CSS to your clipboard.
- **VS Code Integration**: Use the [UI Checker Bridge](https://marketplace.visualstudio.com/items?itemName=VinhNguyen-Vincent.ui-checker-bridge) extension to instantly jump from a browser element to its source code in VS Code.
- **CSS Variable Support**: Detects `var()` syntax, displays variable names, and allows overriding fallbacks.
- **Visual Overlay**: Onion-skin, side-by-side, and pixel-diff heatmaps to catch compositional issues. Includes **Smart Shift Detection** to automatically align design and browser images.
- **Saved Checks**: Link DOM selectors to Figma nodes, save them as reusable checks, and rerun the page checklist from DevTools.
- **Bridge-Assisted Fixes**: Apply safe CSS declaration replacements through the VS Code Bridge when the source location can be resolved.

---

## Setup Guide

### 1. Generate your Figma Access Token
1. Log in to your **Figma** account.
2. Go to **Settings** > **Personal access tokens**.
3. Click **Generate new token**, name it (e.g. `UI-Checker`), and ensure **File content** scope is checked.
4. Copy the token (it starts with `figd_`).

### 2. Install the Extension
1. Open Chrome and go to `chrome://extensions/`.
2. Enable **Developer mode** (top right).
3. Click **Load unpacked** and select the `chrome-extension/` folder in this repository.

### 3. Connect and Configure
1. Open DevTools (`F12`) and find the **UI Checker** tab.
2. Click the **Settings (gear icon)**.
3. Paste your **Personal Access Token**.
4. Enter your **Figma File Key** (or paste a full Figma URL — the key is extracted automatically).
5. Click **Connect**. The status should turn **Connected**.

---

## How to Use

### Basic Workflow
1. **Pick**: Click "Pick Element" and select a component on your webpage.
2. **Fetch**: Paste a Figma URL (or Node ID) into the "Figma Node ID" field and click **Fetch Spec**. Repeat fetches use the local cache when available.
3. **Compare**: Review the diff report. Mismatches are highlighted by severity (Major/Minor).
4. **Fix**: Click the **Fix** button to copy the correct CSS for a mismatched property.

### Visual Comparison
1. In the **Visual Overlay** section, click **Capture** to grab a screenshot of your selected element.
2. Fetch a Figma node to auto-load the rendered Figma image, or drag and drop a screenshot from Figma into the drop zone.
3. Use the **Opacity Slider** to blend the two images or switch to **Diff** mode to see a pixel-level heatmap of differences.

### Tips
- **URL Support**: You don't need to hunt for Node IDs. Just paste the full URL from your browser's address bar when you have the layer selected in Figma.
- **Tab Sync**: Click the **Sync** button to auto-detect the File Key and Node ID from an open Figma browser tab.
- **Cache Status**: The panel shows whether the spec and image came from cache or a fresh Figma request.
- **Refresh Live**: Click **Refresh Live** to bypass the cache and refetch the current node spec and rendered image from Figma.
- **Persistence**: Your settings (Token, File Key, Tolerances) are saved automatically.
- **Filtering**: Use the search box in the results panel to filter properties by name.

---

## Architecture

The extension communicates directly with the Figma REST API (`api.figma.com`) from the service worker. No proxy, bridge server, or external dependencies are required. The service worker caches recent Figma node specs and rendered image URLs in `chrome.storage.local`, keyed by Figma file key and node ID. The cache is bypassed when the panel sends a **Refresh Live** request.

```
DevTools Panel  -->  Service Worker  -->  https://api.figma.com/v1/...
```

### Project Structure
- `chrome-extension/background/` — Service worker handling Figma API calls and tab capture.
- `chrome-extension/panel/` — DevTools panel UI (HTML, CSS, JS).
- `chrome-extension/content/` — Content script for element picking and style extraction.
- `chrome-extension/lib/` — Shared logic for Figma API client, CSS parsing, normalizing, and diffing.

## Testing

This repo now uses Node's built-in test runner, so you can run unit tests without adding Jest or Vitest.

- `npm test` — run the unit test suite
- `npm run test:watch` — rerun tests on file changes
- `npm run test:coverage` — run tests with a coverage report across shared libs and the content script
- `npm run ci:check -- --config ui-checker.config.json --html ui-checker-report.html` — run configured UI checks and write an HTML artifact

### Coverage Management

The coverage script is intentionally configurable so you can manage what counts and how strict it should be.

- `npm run test:coverage -- --include=chrome-extension/lib/*.js`
- `npm run test:coverage -- --include=chrome-extension/lib/*.js --include=chrome-extension/content/*.js --exclude=chrome-extension/lib/pixel-diff.js`
- `npm run test:coverage -- --lines=90 --functions=90 --branches=80`
- `npm run test:coverage -- test/figma-parser.test.js`

You can also drive the same settings with environment variables:

- `TEST_COVERAGE_INCLUDE=chrome-extension/lib/*.js npm run test:coverage`
- `TEST_COVERAGE_LINES=90 TEST_COVERAGE_FUNCTIONS=90 TEST_COVERAGE_BRANCHES=80 npm run test:coverage`

By default, `npm run test:coverage` scopes coverage to `chrome-extension/lib/*.js` and `chrome-extension/content/*.js`, which keeps the report focused on the unit-testable core logic and the content-script runtime path we can realistically mock. You can broaden that include list whenever you want to start measuring panel or background files too.

---

## Troubleshooting

- **Connection Failed**: Verify your Personal Access Token is valid and hasn't expired. Re-generate in Figma Settings if needed.
- **Node Not Found**: Double-check that your Figma File Key matches the file containing the Node ID.
- **Fetch Errors**: Ensure the token has **File content** read scope. Some organization-level files may require additional permissions.

---

## License
MIT
