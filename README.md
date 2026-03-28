# Figma CSS Diff - Chrome DevTools Extension

A Chrome DevTools extension that helps frontend developers catch visual discrepancies between Figma designs and actual browser rendering. Compare computed browser styles against Figma Dev Mode CSS specs to identify mismatches in spacing, typography, colors, and more.

---

## Features

### Element Selection
- **Visual Element Picker** -- click "Pick Element", hover to see a blue highlight overlay with tooltip showing tag, classes, and dimensions. Click to select. Press `Esc` to cancel.
- **CSS Selector Input** -- type any CSS selector directly (e.g., `#app > div.card > img`) and press Enter or click "Select" to query the element without using the visual picker.

### Figma CSS Parsing
- Paste CSS copied from Figma Dev Mode
- Automatic shorthand expansion for: `padding`, `margin`, `border-radius`, `border`, `gap`, `background`
- CSS comment stripping
- CSS variable detection -- extracts `var(--name, fallback)` syntax, preserving variable name and fallback value

### Style Extraction
Automatically extracts 38 computed CSS properties from selected elements via `getComputedStyle()`, covering 5 categories:

| Category | Properties |
|----------|-----------|
| **Spacing** | `margin-top`, `margin-right`, `margin-bottom`, `margin-left`, `padding-top`, `padding-right`, `padding-bottom`, `padding-left`, `gap`, `row-gap`, `column-gap` |
| **Typography** | `font-family`, `font-size`, `font-weight`, `line-height`, `letter-spacing`, `text-align`, `text-transform`, `text-decoration`, `color` |
| **Sizing** | `width`, `height`, `min-width`, `max-width`, `min-height`, `max-height` |
| **Layout** | `display`, `flex-direction`, `align-items`, `justify-content`, `flex-wrap`, `position`, `top`, `right`, `bottom`, `left`, `z-index` |
| **Visual** | `background-color`, `border-*-width`, `border-*-style`, `border-*-color`, `border-*-radius`, `box-shadow`, `opacity`, `overflow` |

### Smart Diff Engine
- Tolerance-aware comparison with configurable thresholds
- **Severity classification**: major, minor, negligible
  - **Major**: font-size > 2px diff, font-weight mismatch, large color differences, string mismatches
  - **Minor**: spacing differences <= 4px, radius differences <= 2px, small color diffs
  - **Negligible**: subpixel differences (< 1px), values within tolerance
- Subpixel rounding detection (auto-matches with note)
- Per-channel color comparison with tolerance

### Style Normalization
Values are normalized before comparison for accurate matching:
- Hex to RGB conversion (`#1A1A1A` to `rgb(26, 26, 26)`)
- Font-weight keyword normalization (`bold` to `700`, `normal` to `400`, `thin` to `100`, etc.)
- Font-family primary extraction (strips fallback fonts, lowercases)
- `rem` to `px` conversion (16px base)
- `normal` line-height to computed pixel value (1.2x font-size)
- Zero-unit stripping (`0px` to `0`)
- Bare number to px conversion for applicable Figma values
- Border `none` normalization

### CSS Variable Support
- Detects CSS variables with fallback values in pasted Figma CSS
- Displays clickable variable chips in diff results showing the variable name
- Hover to see original `var()` syntax
- Click to open an inline editor to override the fallback value
- Overrides are applied instantly and the comparison re-runs

### Variable Mappings
Save and share CSS variable override sets:
- **Save** current overrides as a named mapping
- **Load** a saved mapping to apply overrides
- **Delete** mappings you no longer need
- **Export** a mapping as a JSON file for team sharing
- **Import** mapping JSON files from teammates
- All mappings are persisted to `chrome.storage`

### Visual Results Display
- Summary statistics bar: matched / mismatched / missing counts
- Color-coded indicators: green checkmark (match), red X (mismatch), orange warning (missing)
- Results grouped by property category (Spacing, Typography, Sizing, Layout, Visual)
- Severity badges on mismatches (major / minor)
- Color swatches displayed next to color property values
- Matched properties collapsed by default with expandable toggle
- Tolerance notes shown when values are within threshold

### Batch Element Comparison
Compare multiple elements in a single operation:
- Toggle **Batch Mode** with the "Batch" button
- Enter a CSS selector matching multiple elements (e.g., `.card`, `ul > li`)
- Paste multi-block Figma CSS separated by `/* label */` comments or blank lines
- Click "Compare" to diff all elements at once
- Accordion results view with per-element summary (auto-opens sections with mismatches)
- Aggregate summary across all compared elements
- Warning shown when element count doesn't match CSS block count
- Capped at 50 elements for performance
- Batch-specific markdown report with summary table

### Configurable Tolerance Settings
- **Spacing tolerance** (px): acceptable pixel difference for margins, padding, gap, positioning (default: 2)
- **Color tolerance** (per channel): acceptable RGB channel difference (default: 5)
- **Border radius tolerance** (px): acceptable pixel difference for border-radius (default: 2)
- Settings persist across browser sessions via `chrome.storage`

### Report Export
- Generates a markdown-formatted diff report
- Includes: element info, dimensions, date, all mismatches with severity, match count
- Single-click copy to clipboard
- Batch mode generates a summary table followed by per-element detail sections
- Paste into PR descriptions, Slack, or documentation

---

## Installation

### From Source (Developer Mode)

1. **Download or clone this repository:**
   ```bash
   git clone <repository-url>
   cd ui-checker/chrome-extension
   ```

2. **Open Chrome Extensions page:**
   - Navigate to `chrome://extensions/`
   - Or click Chrome menu > More tools > Extensions

3. **Enable Developer mode:**
   - Toggle the "Developer mode" switch in the top-right corner

4. **Load the extension:**
   - Click "Load unpacked"
   - Select the `chrome-extension` folder from this repository

5. **Verify installation:**
   - The extension "Figma CSS Diff" should appear in your extensions list

---

## How to Use

### Single Element Comparison

1. **Open DevTools**: Navigate to any webpage. Open Chrome DevTools (`F12` or `Cmd+Option+I` on Mac). Find the **"Figma CSS Diff"** tab.

2. **Select an element**: Either click **"Pick Element"** and click on the page, or type a CSS selector in the selector input and press Enter.

3. **Paste Figma CSS**: Open Figma Dev Mode, select the corresponding component, copy the CSS, and paste it into the "Figma CSS" textarea.

4. **Compare**: Click **"Compare"** to see the diff results with severity indicators.

5. **Export**: Click **"Copy Report"** to copy a markdown report to your clipboard.

### Batch Element Comparison

1. Click the **"Batch"** button to enter batch mode.
2. Enter a CSS selector that matches multiple elements (e.g., `.card`, `.list-item`).
3. Click **"Select"** to extract styles from all matched elements.
4. Paste Figma CSS blocks separated by `/* label */` comments:
   ```css
   /* card-header */
   padding: 16px 24px;
   font-size: 14px;

   /* card-body */
   padding: 24px;
   font-size: 13px;
   ```
5. Click **"Compare"** to diff all elements at once.
6. Review results in the accordion view -- sections with mismatches auto-expand.

### Working with CSS Variables

1. Paste Figma CSS containing `var(--name, fallback)` syntax.
2. Variable chips appear in the results showing the variable name.
3. Click a chip to open an inline editor and override the fallback value.
4. Save your overrides as a named mapping via Settings > Variable Mappings > **Save Current**.
5. Export mappings as JSON to share with your team.

### Adjusting Tolerances

1. Click the **settings gear icon** to open tolerance settings.
2. Adjust thresholds for spacing, color, and border-radius.
3. Click "Compare" again to see updated results.

---

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Cancel element picker | `Esc` |
| Confirm CSS selector | `Enter` |
| Open DevTools | `F12` or `Cmd+Option+I` (Mac) / `Ctrl+Shift+I` (Windows) |

---

## Troubleshooting

### Extension not appearing in DevTools
- Ensure the extension is enabled at `chrome://extensions/`
- Try reloading the extension by clicking the refresh icon on the extension card
- Restart Chrome and try again

### "Pick Element" not working
- Make sure you're on a webpage (not a Chrome internal page like `chrome://extensions/`)
- Some sites with strict CSP (Content Security Policy) may block the content script
- Try refreshing the page after loading the extension

### Styles not extracting
- Ensure the element is visible on the page
- Some pseudo-elements or shadow DOM elements may have limited support
- Check the browser console for any error messages

### Figma CSS not parsing correctly
- Make sure you're copying CSS from Figma's Dev Mode Inspect panel
- The parser supports standard CSS property-value pairs
- Complex CSS (animations, transforms) may not be fully supported

### Batch mode showing wrong matches
- Ensure the number of `/* label */` blocks matches the number of elements the selector finds
- Elements are matched to CSS blocks in DOM order
- Check the batch status bar for the element count before comparing

---

## Development

### Project Structure

```
chrome-extension/
├── manifest.json              # Extension manifest (V3)
├── devtools/
│   ├── devtools.html          # DevTools page entry
│   └── devtools.js            # Panel registration
├── panel/
│   ├── panel.html             # Main UI (DevTools panel)
│   ├── panel.js               # Panel logic, diff display, batch mode
│   └── panel.css              # Panel styling
├── content/
│   └── content.js             # Element picker, style extraction, batch extraction
├── background/
│   └── service-worker.js      # Message relay between panel and content
├── lib/
│   ├── style-extractor.js     # Property group definitions
│   ├── figma-parser.js        # Parse Figma CSS, expand shorthands, multi-block parsing
│   ├── normalizer.js          # Normalize values for comparison
│   └── diff-engine.js         # Compare styles & classify severity
└── icons/
    ├── icon-16.png
    ├── icon-48.png
    └── icon-128.png
```

### Making Changes

1. Edit the source files in the `chrome-extension/` directory
2. Go to `chrome://extensions/`
3. Click the refresh icon on the Figma CSS Diff extension
4. Reload the page you're testing and open DevTools to see changes

---

## Browser Support

- **Chrome**: Full support (Manifest V3)
- **Edge**: Compatible (Chromium-based)
- **Other browsers**: May require modifications for Manifest V3 compatibility

---

## Privacy & Security

- This extension runs entirely locally in your browser
- No data is sent to external servers
- Style information is only extracted from pages you actively inspect
- The extension requires `activeTab` permission to access the current page's DOM
- Variable mappings are stored locally in `chrome.storage`

---

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

### Ideas for contributions:
- Visual overlay comparison (screenshot overlay on live page)
- Comparison history and regression tracking
- Shadow DOM and web component support
- Design token validation
- Responsive breakpoint comparison

---

## License

MIT

---

## Support

If you encounter issues or have feature requests, please [open an issue](https://github.com/yourusername/ui-checker/issues).
