# Phase 1: Figma vs Browser CSS Diff — Chrome Extension

## Overview

A Chrome DevTools extension that lets frontend developers select any rendered element on a page, extract its computed styles, paste the expected styles from Figma's Dev Mode, and instantly see a property-by-property diff highlighting mismatches. The goal is to catch spacing, typography, and color discrepancies before PR review.

---

## Problem Statement

Developers build components that look "roughly correct" but have subtle style mismatches compared to Figma specs — wrong padding, font-weight, color hex, line-height, etc. These issues are hard to catch visually but trivial to detect programmatically. Currently, there's no quick feedback loop between "what Figma says" and "what the browser rendered."

---

## Target Users

- Frontend developers during self-review before pushing a PR
- Tech leads during PR review or QA walkthroughs
- QA engineers validating design fidelity

---

## Core User Flow

```
1. Developer opens Chrome DevTools → navigates to the extension panel
2. Clicks "Pick Element" → selects a rendered component on the page
3. Extension extracts computed styles for the selected element
4. Developer copies CSS from Figma Dev Mode → pastes into the extension
5. Extension normalizes both sides and runs a diff
6. Results show: ✅ matched properties, ❌ mismatched properties with expected vs actual values
```

---

## Architecture

```
chrome-extension/
├── manifest.json              # Manifest V3
├── devtools/
│   ├── devtools.html          # DevTools page entry (registers panel)
│   └── devtools.js            # Panel registration script
├── panel/
│   ├── panel.html             # Main extension UI (DevTools panel)
│   ├── panel.js               # Panel logic: UI state, diff engine, display
│   └── panel.css              # Panel styling
├── content/
│   └── content.js             # Content script: element picker + style extraction
├── background/
│   └── service-worker.js      # Message relay between panel ↔ content script
├── lib/
│   ├── style-extractor.js     # Extract & normalize computed styles from DOM element
│   ├── figma-parser.js        # Parse Figma Dev Mode CSS text into normalized key-value pairs
│   ├── normalizer.js          # Shared normalization (units, shorthands, color formats)
│   └── diff-engine.js         # Compare two normalized style objects, produce diff report
├── icons/
│   ├── icon-16.png
│   ├── icon-48.png
│   └── icon-128.png
└── README.md
```

---

## Detailed Feature Specs

### F1 — Element Picker

**File:** `content/content.js`

- Activated via message from the DevTools panel
- On activation, overlays a highlight (outline + semi-transparent background) on hovered elements
- On click, captures the target element and calls the style extractor
- Sends extracted styles back to the panel via `chrome.runtime` messaging
- Deactivates picker mode after selection
- Shows the element's tag, class list, and dimensions as a tooltip during hover

**Edge cases:**
- Ignore clicks on iframes (cross-origin restriction)
- Handle shadow DOM elements if possible (open shadow roots only)
- Clean up all event listeners and overlays on deactivation

---

### F2 — Style Extractor

**File:** `lib/style-extractor.js`

Extracts computed styles from the selected DOM element, filtered to a curated property set.

**Curated property groups:**

| Group         | Properties                                                                 |
|---------------|---------------------------------------------------------------------------|
| **Spacing**   | `margin-*`, `padding-*`, `gap`, `row-gap`, `column-gap`                  |
| **Typography**| `font-family`, `font-size`, `font-weight`, `line-height`, `letter-spacing`, `text-align`, `text-transform`, `text-decoration`, `color` |
| **Sizing**    | `width`, `height`, `min-width`, `max-width`, `min-height`, `max-height`  |
| **Layout**    | `display`, `flex-direction`, `align-items`, `justify-content`, `flex-wrap`, `position`, `top`, `right`, `bottom`, `left`, `z-index` |
| **Visual**    | `background-color`, `border`, `border-radius`, `box-shadow`, `opacity`, `overflow` |

**Output format:**
```json
{
  "element": "div.card-header",
  "dimensions": { "width": 320, "height": 48 },
  "styles": {
    "padding-top": "16px",
    "padding-right": "24px",
    "font-size": "14px",
    "font-weight": "500",
    "color": "rgb(26, 26, 26)",
    "...": "..."
  }
}
```

---

### F3 — Figma CSS Parser

**File:** `lib/figma-parser.js`

Parses the text copied from Figma's Dev Mode CSS inspect panel.

**Input example (what Figma gives you):**
```css
/* Frame 1 */
width: 320px;
height: 48px;
padding: 16px 24px;
display: flex;
align-items: center;
gap: 8px;

font-family: Inter;
font-size: 14px;
font-weight: 500;
line-height: 20px;
color: #1A1A1A;

background: #FFFFFF;
border-radius: 8px;
```

**Parser responsibilities:**
- Strip CSS comments (`/* ... */`)
- Split into property-value pairs on `:` and `;`
- Expand shorthand properties (`padding: 16px 24px` → `padding-top: 16px`, `padding-right: 24px`, `padding-bottom: 16px`, `padding-left: 24px`)
- Normalize Figma-specific quirks:
  - `background` → `background-color` (when it's a solid color)
  - Missing units (Figma sometimes outputs `font-size: 14` instead of `14px`)
  - `Auto` → `auto`
- Handle the common shorthands: `margin`, `padding`, `border`, `border-radius`, `gap`

---

### F4 — Style Normalizer

**File:** `lib/normalizer.js`

Normalizes both browser-extracted and Figma-parsed values into a comparable format.

**Normalization rules:**
| Input | Normalized |
|-------|-----------|
| `#1A1A1A` | `rgb(26, 26, 26)` — all colors to `rgb()` or `rgba()` |
| `rgb(26,26,26)` | `rgb(26, 26, 26)` — consistent spacing |
| `1rem` | `16px` — convert rem to px (using root font-size) |
| `bold` | `700` — font-weight keywords to numbers |
| `normal` (font-weight) | `400` |
| `normal` (line-height) | compute to px based on font-size |
| `0px` | `0` — strip unit from zero |
| `none` (border) | `0` |
| `Inter, sans-serif` | `inter` — lowercase, primary font only for comparison |
| Shorthand `border: 1px solid #ccc` | Expand to `border-width`, `border-style`, `border-color` |

---

### F5 — Diff Engine

**File:** `lib/diff-engine.js`

Compares two normalized style objects and produces a structured diff.

**Diff output format:**
```json
{
  "summary": { "total": 25, "matched": 20, "mismatched": 4, "missing": 1 },
  "results": [
    { "property": "padding-top", "status": "match", "expected": "16px", "actual": "16px" },
    { "property": "font-weight", "status": "mismatch", "expected": "500", "actual": "400", "severity": "minor" },
    { "property": "color", "status": "mismatch", "expected": "rgb(26, 26, 26)", "actual": "rgb(51, 51, 51)", "severity": "major" },
    { "property": "letter-spacing", "status": "missing", "expected": "0.5px", "actual": null }
  ]
}
```

**Severity classification:**
- `major`: Color mismatch (any channel differs by > 10), font-size differs by > 2px, font-weight differs
- `minor`: Spacing differs by 1–4px, border-radius off by 1–2px
- `negligible`: Spacing off by < 1px (subpixel rounding) → auto-mark as match with note

**Tolerance settings (configurable):**
- Spacing tolerance: ±2px (default)
- Color tolerance: ±5 per channel (default)
- User can adjust in panel settings

---

### F6 — Panel UI

**File:** `panel/panel.html`, `panel/panel.js`, `panel/panel.css`

The main DevTools panel interface.

**Layout sections:**

```
┌─────────────────────────────────────────────────────┐
│  🎯 Pick Element          [Settings ⚙]             │
├─────────────────────────────────────────────────────┤
│  Selected: div.card-header (320 × 48)               │
├──────────────────────┬──────────────────────────────┤
│  Figma CSS (paste)   │  Extracted Styles (auto)     │
│  ┌────────────────┐  │  ┌────────────────────────┐  │
│  │ textarea       │  │  │ read-only display      │  │
│  │                │  │  │                        │  │
│  └────────────────┘  │  └────────────────────────┘  │
├──────────────────────┴──────────────────────────────┤
│  [Compare]                                          │
├─────────────────────────────────────────────────────┤
│  Results: 20/25 matched  │ 4 mismatched │ 1 missing │
├─────────────────────────────────────────────────────┤
│  ❌ font-weight    expected: 500     actual: 400    │
│  ❌ color          expected: #1A1A1A actual: #333   │
│  ❌ padding-left   expected: 24px    actual: 16px   │
│  ❌ letter-spacing expected: 0.5px   actual: normal │
│  ⚠️  border-radius  expected: 8px     actual: 7px   │
│  ─────────────────────────────────────────────────  │
│  ✅ font-size: 14px                                 │
│  ✅ line-height: 20px                               │
│  ✅ display: flex                                   │
│  ... (collapsible)                                  │
├─────────────────────────────────────────────────────┤
│  [Copy Report]  [Clear]                             │
└─────────────────────────────────────────────────────┘
```

**UI behaviors:**
- Mismatches shown first, sorted by severity (major → minor → negligible)
- Matched properties collapsed by default, expandable
- "Copy Report" generates a markdown summary for pasting into PR comments or Slack
- Color values show a small color swatch preview next to the hex/rgb value
- Property group headers (Spacing, Typography, etc.) for scannability

---

## Messaging Architecture

```
┌─────────────┐    chrome.runtime     ┌──────────────────┐    chrome.tabs     ┌───────────────┐
│  Panel UI   │  ←───────────────→    │  Service Worker   │  ←─────────────→  │ Content Script │
│  (DevTools) │    message passing    │  (background)     │   message passing │ (page context) │
└─────────────┘                       └──────────────────┘                    └───────────────┘

Messages:
  Panel → Content:   { action: "START_PICKER" }
  Content → Panel:   { action: "ELEMENT_SELECTED", data: { element, styles } }
  Content → Panel:   { action: "PICKER_CANCELLED" }
```

---

## Implementation Order

### Step 1 — Scaffold & Manifest
- Set up Manifest V3 structure
- Register DevTools panel
- Verify extension loads in Chrome

### Step 2 — Element Picker
- Implement content script with hover highlight
- Wire up messaging between panel and content script
- Return selected element info

### Step 3 — Style Extractor
- Implement `getComputedStyle` extraction with curated property list
- Display extracted styles in panel (read-only)

### Step 4 — Figma Parser
- Implement CSS text parser
- Handle shorthands, comments, Figma quirks
- Display parsed Figma styles in panel

### Step 5 — Normalizer + Diff Engine
- Build normalization pipeline
- Build comparison engine with severity classification
- Wire into panel UI

### Step 6 — Panel UI Polish
- Implement full results display with severity sorting
- Color swatches, group headers, collapsible sections
- Copy Report functionality (markdown output)

### Step 7 — Settings & Tolerance
- Add tolerance configuration UI
- Persist settings via `chrome.storage.local`

---

## Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Manifest version | V3 | Required for Chrome Web Store, V2 deprecated |
| UI framework | Vanilla JS + CSS | No build step, keeps extension lightweight, fast to iterate |
| Color normalization | Convert all to RGB | Browser returns RGB, simplest common format |
| Unit normalization | Convert all to px | Figma uses px, browser computes to px |
| Shorthand expansion | Custom parser | Figma shorthands are predictable, no need for PostCSS |
| Tolerance system | Configurable thresholds | Teams have different standards for "close enough" |
| Data persistence | `chrome.storage.local` | For user settings only, no style data persisted |

---

## Copy Report Output Format

When the user clicks "Copy Report", generate:

```markdown
## Style Diff Report
**Element:** `div.card-header` (320 × 48)
**Page:** https://localhost:3000/components/card
**Date:** 2026-03-25

### ❌ Mismatches (4)
| Property | Expected (Figma) | Actual (Browser) | Severity |
|----------|-----------------|------------------|----------|
| font-weight | 500 | 400 | major |
| color | #1A1A1A | #333333 | major |
| padding-left | 24px | 16px | major |
| letter-spacing | 0.5px | normal | minor |

### ✅ Matched: 20/25 properties
```

---

## Out of Scope (Phase 1)

- Visual overlay / screenshot comparison (→ Phase 2)
- AI vision-based comparison (→ Phase 3)
- Figma API integration (auto-fetch styles from Figma file)
- Multi-element batch comparison
- Design token validation (checking against a token system)
- Browser extension store publishing

---

## Success Criteria

- A developer can go from "select element + paste Figma CSS" to "see diff results" in under 10 seconds
- Diff correctly identifies spacing, typography, and color mismatches at ±2px / ±5 color channel tolerance
- Report output is clean enough to paste directly into a PR comment
- Works on any localhost or deployed site without CORS issues
