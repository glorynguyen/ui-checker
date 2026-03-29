# Pixel Perfect — UI Fidelity Checker for Chrome

> Ship UI that matches the design. Every pixel, every time.

A Chrome DevTools extension that bridges the gap between Figma specs and browser output. Pick an element, paste the expected CSS, and instantly see what's off — spacing, color, typography, layout — with severity-aware diffs and actionable reports.

---

## Vision

Pixel-perfect UI shouldn't require eyeballing. This tool gives frontend developers a **fast, programmatic feedback loop** — paste what Figma says, see what the browser actually rendered, fix the diff before anyone reviews your PR.

---

## What's Built (Phase 1) ✅

All core functionality is shipped and working:

| Feature | Description |
|---------|-------------|
| Element Picker | Hover-highlight, click-select, tooltip with tag/class/dimensions |
| Style Extractor | 40+ curated properties across spacing, typography, sizing, layout, visual |
| Figma CSS Parser | Comment stripping, shorthand expansion, Figma quirks handling |
| Style Normalizer | Color (hex→rgb), units (rem→px), font-weight keywords, zero values |
| Diff Engine | Tolerance-aware comparison with major/minor/negligible severity |
| Panel UI | Grouped results, color swatches, collapsible sections, copy-to-clipboard report |
| Settings | Configurable tolerance thresholds (spacing, color, border-radius) via chrome.storage |
| Batch Mode | Multi-element comparison with per-element accordion results |
| CSS Variables | var() extraction, fallback display, override mappings with save/load/export |

---

## Roadmap

### Phase 2 — Visual Overlay Comparison

Go beyond property diffs. Overlay the Figma design on top of the live page to catch visual issues that CSS values alone can't express.

**Key features:**
- Screenshot capture of selected element's bounding box
- Figma frame image upload (drag & drop or paste)
- Opacity slider to blend Figma screenshot over live element
- Pixel-diff heatmap highlighting regions that diverge
- Side-by-side and onion-skin view modes

**Why:** Some mismatches are compositional — a 2px padding difference might be "within tolerance" but looks wrong in context. Visual overlay catches what numbers miss.

---

### Phase 3 — Figma API Integration

Eliminate the copy-paste step entirely. Connect to Figma and auto-fetch styles for the selected component.

**Key features:**
- Figma personal access token setup (stored in chrome.storage)
- Paste a Figma frame URL → auto-resolve node styles
- Component name matching between Figma and DOM (manual mapping + heuristics)
- Cache fetched styles locally to reduce API calls
- Support for Figma component variants

**Why:** Copy-pasting CSS from Figma is the biggest friction point. Direct integration makes the workflow near-instant.

---

### Phase 4 — Design Token Validation

Check not just Figma-vs-browser, but whether the implementation uses the correct design tokens.

**Key features:**
- Import design tokens (JSON, CSS custom properties, or Style Dictionary format)
- Flag hardcoded values that should reference a token (e.g., `#1A1A1A` instead of `var(--color-text-primary)`)
- Token coverage report: % of properties using tokens vs hardcoded
- Suggest closest matching token for hardcoded values

**Why:** Pixel-perfect isn't just about matching Figma — it's about using the design system correctly so things stay consistent at scale.

---

### Phase 5 — AI Vision Comparison

Use vision models to catch issues that neither CSS diffs nor pixel overlays surface — layout shifts, visual hierarchy problems, spacing rhythm.

**Key features:**
- Capture screenshot of rendered component
- Send Figma design + browser screenshot to vision model
- Natural language summary of visual differences
- Confidence scoring per issue
- Annotated screenshot with callouts

**Why:** Human designers catch things like "the spacing rhythm feels off" or "the visual weight is wrong." AI vision bridges that gap.

---

### Phase 6 — CI/CD Integration

Move fidelity checks from manual DevTools use into the automated pipeline.

**Key features:**
- CLI tool that runs headless Chrome + extension logic
- Compare pages against stored Figma baselines
- JSON/HTML report output for CI artifacts
- GitHub Action for PR checks (fail if major mismatches exceed threshold)
- Baseline management: approve/update expected snapshots

**Why:** Catching regressions before merge is the endgame. Manual checking doesn't scale.

---

## Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Manifest version | V3 | Required for Chrome Web Store, V2 deprecated |
| UI framework | Vanilla JS + CSS | No build step, lightweight, fast iteration |
| Color normalization | All to RGB | Browser returns RGB, simplest common format |
| Unit normalization | All to px | Figma uses px, browser computes to px |
| Shorthand expansion | Custom parser | Figma shorthands are predictable, no need for PostCSS |
| Tolerance system | Configurable thresholds | Teams have different standards for "close enough" |
| Data persistence | chrome.storage.local | User settings only, no style data persisted |

---

## Architecture

```
chrome-extension/
├── manifest.json              # Manifest V3
├── devtools/
│   ├── devtools.html          # DevTools page entry
│   └── devtools.js            # Panel registration
├── panel/
│   ├── panel.html             # Main UI
│   ├── panel.js               # Panel logic, diff display
│   └── panel.css              # Panel styling
├── content/
│   └── content.js             # Element picker + style extraction
├── background/
│   └── service-worker.js      # Message relay
├── lib/
│   ├── style-extractor.js     # Computed style extraction
│   ├── figma-parser.js        # Figma CSS parsing
│   ├── normalizer.js          # Value normalization
│   └── diff-engine.js         # Style comparison engine
└── icons/
```

---

## Success Criteria

- Select element + paste Figma CSS → see diff in **under 10 seconds**
- Correctly identifies spacing, typography, and color mismatches at configurable tolerance
- Report output is clean enough to paste directly into a PR comment
- Works on any localhost or deployed site without CORS issues
