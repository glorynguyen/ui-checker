# Figma CSS Diff - Chrome DevTools Extension

A Chrome DevTools extension that helps frontend developers catch visual discrepancies between Figma designs and actual browser rendering. Compare computed browser styles against Figma Dev Mode CSS specs to identify mismatches in spacing, typography, colors, and more.

---

## Features

- **Element Picker**: Select any element on the page directly from DevTools
- **Style Extraction**: Automatically extracts computed CSS styles from selected elements
- **Figma CSS Parsing**: Paste CSS copied from Figma Dev Mode for comparison
- **Smart Diff Engine**: Compares styles with configurable tolerance for:
  - Spacing (margin, padding, gap) - ±2px default tolerance
  - Colors - ±5 per channel default tolerance
  - Border radius - ±2px default tolerance
- **Visual Results**: Clear ✅/❌ indicators showing matched and mismatched properties
- **Export**: Copy diff reports for sharing with your team

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
   - Or click Chrome menu → More tools → Extensions

3. **Enable Developer mode:**
   - Toggle the "Developer mode" switch in the top-right corner

4. **Load the extension:**
   - Click "Load unpacked"
   - Select the `chrome-extension` folder from this repository

5. **Verify installation:**
   - The extension "Figma CSS Diff" should appear in your extensions list
   - You'll see the extension icon in your toolbar (optional)

---

## How to Use

### Step 1: Open DevTools

1. Navigate to any webpage you want to inspect
2. Open Chrome DevTools (F12 or Cmd+Option+I on Mac, Ctrl+Shift+I on Windows)
3. Look for the **"Figma CSS Diff"** tab in the DevTools panel

### Step 2: Select an Element

1. In the Figma CSS Diff panel, click the **"Pick Element"** button
2. Your cursor will change - hover over elements on the page to see highlights
3. Click on the element you want to inspect
4. The element's tag, classes, and dimensions will appear in the panel

### Step 3: Get Figma CSS

1. Open your Figma design file
2. Enter **Dev Mode** (toggle in the top-right of Figma)
3. Select the corresponding component/frame in Figma
4. Copy the CSS from Figma's Inspect panel (usually shows as "CSS" tab)
5. Paste the CSS into the **"Figma CSS"** textarea in the extension

### Step 4: Compare

1. Click the **"Compare"** button
2. The diff results will show:
   - **✅ Matched**: Properties that match between Figma and browser
   - **❌ Mismatched**: Properties with different values (expected vs actual)
   - **📋 Only in Figma**: Properties defined in Figma but not in browser
   - **📋 Only in Browser**: Properties in browser but not in Figma

### Step 5: Adjust Tolerance (Optional)

1. Click the **settings gear icon** ⚙️ to open tolerance settings
2. Adjust tolerances for:
   - **Spacing tolerance**: Acceptable pixel difference for margins/padding
   - **Color tolerance**: Acceptable RGB channel difference
   - **Border radius tolerance**: Acceptable pixel difference for border-radius
3. Click "Compare" again to see updated results

### Step 6: Export Results

1. Click **"Copy Report"** to copy the full diff to your clipboard
2. Share with your team or paste into PR descriptions
3. Click **"Clear"** to reset and start a new comparison

---

## Style Properties Compared

The extension extracts and compares the following CSS property groups:

| Category | Properties |
|----------|-----------|
| **Spacing** | `margin-*`, `padding-*`, `gap`, `row-gap`, `column-gap` |
| **Typography** | `font-family`, `font-size`, `font-weight`, `line-height`, `letter-spacing`, `text-align`, `text-transform`, `text-decoration`, `color` |
| **Sizing** | `width`, `height`, `min-width`, `max-width`, `min-height`, `max-height` |
| **Layout** | `display`, `flex-direction`, `align-items`, `justify-content`, `flex-wrap`, `position`, `top`, `right`, `bottom`, `left`, `z-index` |
| **Visual** | `background-color`, `border`, `border-radius`, `box-shadow`, `opacity`, `overflow` |

---

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Cancel element picker | `Esc` |
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
│   ├── panel.js               # Panel logic & diff display
│   └── panel.css              # Panel styling
├── content/
│   └── content.js             # Element picker & style extraction
├── background/
│   └── service-worker.js      # Message relay
├── lib/
│   ├── style-extractor.js     # Extract computed styles
│   ├── figma-parser.js        # Parse Figma CSS
│   ├── normalizer.js          # Normalize values for comparison
│   └── diff-engine.js         # Compare styles & generate report
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

---

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

### Ideas for contributions:
- Support for additional CSS properties
- Export to different formats (JSON, Markdown)
- Improved shadow DOM support
- Dark/light theme toggle
- Keyboard navigation improvements

---

## License

MIT

---

## Support

If you encounter issues or have feature requests, please [open an issue](https://github.com/yourusername/ui-checker/issues).

---

**Happy pixel-perfect developing! 🎨✨**
