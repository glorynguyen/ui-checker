# UI Checker — Implementation Review And Roadmap

> Last reviewed against the repository on 2026-04-20.

This document reflects what is actually implemented in the current codebase, not just the original intent.

---

## Product Vision

Ship UI that matches the design without relying on eyeballing. The extension gives frontend developers a fast feedback loop inside Chrome DevTools: select an element, fetch or paste the expected Figma styles, compare them against the live browser output, and act on the differences immediately.

---

## Current Status Summary

| Area | Status | Notes |
|------|--------|-------|
| Core style diff workflow | Implemented | Element picker, selector-based selection, style extraction, parser, normalizer, diff engine, grouped results, copyable report |
| CSS variable workflow | Implemented | `var()` parsing, fallback display, override editing, save/load/import/export mappings |
| Visual overlay comparison | Implemented | Element capture, Figma image upload/paste, onion-skin, side-by-side, pixel diff heatmap |
| VS Code Bridge | Implemented | Local WebSocket bridge, smart search, and marketplace extension |
| Figma API integration | Partially implemented | Personal access token auth, file key + node URL parsing, node fetch, image fetch, tab sync, short-term local cache |
| Design token validation | Not implemented | No token import, token coverage, or token suggestions found |
| AI vision comparison | Not implemented | No model integration or screenshot-to-LLM flow found |
| CI/CD integration | Partially implemented | Style-only CLI runner, config validation, and JSON/Markdown reports are implemented; no GitHub Action, PR comments, visual CI, or baseline approval yet |

---

## Implemented Today

### Core Comparison Flow

- Element picker with hover highlight, click select, tooltip, and escape-to-cancel
- Selection by CSS selector in addition to click picking
- Curated extraction of browser computed styles across spacing, typography, sizing, layout, and visual groups
- Figma CSS parsing with comment stripping and shorthand expansion
- Figma node JSON parsing for dimensions, fills, typography, radius, padding, and gap
- Normalization for colors, font weights, font family, `rem` to `px`, zero values, and selected border cases
- Tolerance-aware diffing for spacing, colors, and border radius
- Results UI with grouping, severity badges, color swatches, filtering, collapsible matched properties, and report copy
- One-click "Fix" action that copies the expected declaration for a mismatched property

### CSS Variable Support

- Detection of `var(--token, fallback)` patterns
- Display of variable chips and resolved fallback values in results
- Per-property override editing before comparison
- Saved override mappings in `chrome.storage.local`
- Mapping load, delete, import, and export flows

### Visual Overlay Comparison

- Capture of the selected element from the inspected page
- Upload, drag-and-drop, or paste of a Figma screenshot/image
- Onion-skin blend view with opacity control
- Side-by-side comparison view
- Pixel-diff mode with configurable sensitivity and match percentage output
- Auto-fetch of a Figma-rendered node image when Figma node data is fetched successfully

### VS Code Integration (Bridge)

- Dedicated [VS Code Extension](https://marketplace.visualstudio.com/items?itemName=VinhNguyen-Vincent.ui-checker-bridge) for navigation
- Local WebSocket server (port 9876) for browser-to-editor communication
- Smart search algorithm with utility class filtering (Tailwind-aware)
- High-confidence matching using IDs, unique classes, and active file focus

---

## Phase Review

### Phase 1 — Core DevTools Diffing

**Status:** Mostly implemented

Implemented:
- Element picker
- Style extractor
- Figma CSS parser
- Style normalizer
- Diff engine
- Settings persisted via `chrome.storage.local`
- Panel UI with grouped diffs and copyable report
- CSS variable handling and saved mappings
- One-click fix copying

Not found in the current codebase:
- Batch mode / multi-element comparison with per-element accordion results

Conclusion:
- Phase 1 is effectively shipped for single-element workflows.
- `plan.md` previously overstated Phase 1 by listing batch mode as complete.

### Phase 2 — Visual Overlay Comparison

**Status:** Implemented

Implemented:
- Screenshot capture of the selected element bounding box
- Figma frame image upload by file, drag-and-drop, and paste
- Opacity slider for onion-skin blending
- Pixel-diff heatmap
- Side-by-side and onion-skin modes

Notes:
- This phase appears implemented end to end in the panel, service worker, and image diff utility.

### Phase 3 — Figma API Integration

**Status:** Partially implemented

Implemented:
- Figma personal access token setup stored in `chrome.storage.local`
- Paste a Figma frame/layer URL and extract file key + node ID
- Fetch node data from the Figma REST API
- Fetch rendered node image from the Figma REST API
- Short-term local caching of fetched node data and rendered images
- Sync file key and node ID from an open Figma browser tab
- Auto-fill node ID from `data-figma-id` when present on the selected DOM element

Not found in the current codebase:
- Component name matching between Figma and DOM using heuristics
- Manual mapping between Figma components and DOM components
- Variant-aware comparison flow beyond basic node fetches

Conclusion:
- The integration foundation is in place, but the "copy-paste free" workflow is not fully complete yet.

### Phase 4 — Design Token Validation

**Status:** Not implemented

Not found:
- Import of design token files
- Validation of hardcoded values against tokens
- Token coverage reporting
- Closest-token suggestions

### Phase 5 — AI Vision Comparison

**Status:** Not implemented

Not found:
- Vision model integration
- Upload of screenshots to an AI service
- Natural-language visual review
- Confidence scoring
- Annotated screenshot generation

### Phase 6 — CI/CD Integration

**Status:** Partially implemented

Implemented:
- Style-only CLI runner
- JSON config validation
- Headless Chrome computed-style extraction through the Chrome DevTools Protocol
- Figma node fetch through the existing REST API client
- Reuse of existing parser, normalizer, and diff engine
- Failure-threshold classification
- JSON and Markdown CI report generation

Not found:
- Baseline storage and approval workflow
- HTML CI artifact generation
- GitHub Action or other hosted CI wrapper
- PR comment publishing
- Visual screenshot/pixel-diff CI mode

Notes:
- The repo includes release tooling via `semantic-release`, but that is not the same as UI fidelity CI.
- The first CI slice can run with `npm run ci:check -- --config ui-checker.config.json --json ui-checker-report.json --markdown ui-checker-report.md`.

---

## Current Architecture

```text
chrome-extension/
├── manifest.json
├── devtools/
│   ├── devtools.html
│   └── devtools.js
├── panel/
│   ├── panel.html
│   ├── panel.js
│   └── panel.css
├── content/
│   └── content.js
├── background/
│   └── service-worker.js
├── lib/
│   ├── style-extractor.js
│   ├── figma-parser.js
│   ├── normalizer.js
│   ├── diff-engine.js
│   ├── pixel-diff.js
│   ├── figma-api-client.js
│   └── comparator.js
└── icons/
```

---

## Recommended Next Priorities

1. Finish Phase 3 by adding a real component mapping workflow and deeper Figma-to-DOM matching.
2. Either implement batch comparison or remove it from product promises everywhere else too.
3. Start Phase 4 with a simple token import plus hardcoded-value detection pass before attempting AI or CI work.

---

## CI/CD Check Plan

### Why This Matters

CI/CD checks are a bigger product win than manual Figma-to-DOM mapping for teams with stable component URLs, Storybook stories, or test pages. The goal is to move UI fidelity checks from an occasional DevTools workflow into a repeatable PR gate.

The first version should be style-only. Screenshot and pixel-diff checks are valuable later, but they introduce more CI flakiness and setup cost.

### MVP Scope

Status: implemented for style-only checks.

Build a local CLI runner that:

- Reads a JSON config file.
- Opens each target page in a headless browser.
- Selects a DOM element with a stable selector.
- Extracts the same curated computed styles used by the extension.
- Fetches the matching Figma node through the Figma REST API.
- Parses and normalizes both style sets with the existing parser and normalizer.
- Runs the existing tolerance-aware diff engine.
- Writes JSON and Markdown reports.
- Exits non-zero when configured failure thresholds are exceeded.

Out of scope for the MVP:

- GitHub Action wrapper
- PR comments
- Screenshot/pixel diff
- Baseline approval workflow
- Automatic Figma-to-DOM discovery
- Full browser extension integration

### Config Shape

Proposed `ui-checker.config.json`:

```json
{
  "baseUrl": "http://localhost:6006",
  "figmaTokenEnv": "FIGMA_TOKEN",
  "tolerance": {
    "spacing": 2,
    "color": 5,
    "borderRadius": 2
  },
  "failOn": {
    "major": true,
    "minorCount": 5,
    "missing": true
  },
  "checks": [
    {
      "name": "Primary Button",
      "path": "/iframe.html?id=button--primary",
      "selector": "[data-testid='primary-button']",
      "figmaFileKey": "abc123",
      "figmaNodeId": "88:1204"
    }
  ]
}
```

### CLI Contract

Proposed command:

```bash
ui-checker-ci --config ui-checker.config.json --json ui-checker-report.json --markdown ui-checker-report.md
```

Expected behavior:

- `0`: all checks pass within tolerance.
- `1`: one or more checks fail thresholds.
- `2`: invalid config, missing token, app unavailable, selector missing, or Figma fetch failure.

### Implementation Steps

1. **Create CLI package entry**
   - Add a `cli/` or `runtime/ci/` entry point.
   - Add a package script such as `npm run ci:check -- --config ui-checker.config.json`.
   - Keep it Node-first and separate from Chrome extension code.

2. **Define config types and validation**
   - Validate `baseUrl`, `checks`, selector fields, Figma file key/node ID, and tolerance settings.
   - Resolve the Figma token from the configured env var.
   - Return clear config errors before opening a browser.

3. **Add headless DOM extractor**
   - Use Playwright or a similar browser runner.
   - Open `baseUrl + path`.
   - Wait for the selector.
   - Extract computed styles using the same curated property list as the content script.
   - Capture dimensions and URL metadata for reports.

4. **Reuse Figma parsing path**
   - Use the existing `FigmaAPIClient` to fetch node JSON.
   - Use `FigmaParser.parse()` to convert node JSON into expected styles.
   - Normalize expected and actual styles with `Normalizer.normalize()`.

5. **Run diffs and classify check status**
   - Use `DiffEngine.compare()`.
   - Apply `failOn` thresholds.
   - Track per-check pass/fail/error status.

6. **Generate reports**
   - JSON report for machines.
   - Markdown report for CI artifacts and easy PR copy/paste.
   - Include check name, URL, selector, Figma node, summary counts, and mismatch table.

7. **Add tests**
   - Unit test config validation.
   - Unit test failure-threshold classification.
   - Unit test report generation.
   - Add one integration-style test with a static local HTML fixture if Playwright is available in dev dependencies.

### Report Shape

JSON report:

```json
{
  "status": "failed",
  "summary": {
    "total": 1,
    "passed": 0,
    "failed": 1,
    "errored": 0
  },
  "checks": [
    {
      "name": "Primary Button",
      "status": "failed",
      "selector": "[data-testid='primary-button']",
      "figmaNodeId": "88:1204",
      "diff": {
        "matched": 12,
        "mismatched": 2,
        "missing": 0
      }
    }
  ]
}
```

Markdown report:

```markdown
## UI Checker CI Report

Status: failed

| Check | Status | Matched | Mismatched | Missing |
|---|---|---:|---:|---:|
| Primary Button | failed | 12 | 2 | 0 |

### Primary Button

Selector: `[data-testid='primary-button']`
Figma node: `88:1204`

| Property | Expected | Actual | Severity |
|---|---|---|---|
| padding-left | 16px | 12px | major |
```

### Recommended Follow-Up Phases

1. **GitHub Action wrapper**
   - Package the CLI into a simple reusable action.
   - Upload JSON/Markdown as artifacts.

2. **PR comments**
   - Post the Markdown summary on pull requests.
   - Keep detailed JSON/HTML as artifacts.

3. **Baseline approval**
   - Store accepted mismatches.
   - Fail only on new or worsened diffs.

4. **Visual diff mode**
   - Add screenshot capture and Figma image comparison after style-only checks are stable.

5. **Mapping reuse**
   - Allow extension-saved mappings to export into CI config.

---

## Success Criteria

- Select an element and compare it against Figma styles inside DevTools quickly
- Catch spacing, typography, color, and radius mismatches with configurable tolerance
- Provide a report that can be pasted into a PR or review thread
- Support both manual CSS paste and direct Figma fetch workflows
