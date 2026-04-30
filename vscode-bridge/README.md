# UI Checker Bridge

Connect your browser-based UI inspection tools directly to your VS Code workspace. This extension acts as a secure, local bridge for the [**Figma CSS Diff**](https://chromewebstore.google.com/detail/figma-css-diff/khbnahljdhbiafecmjbojhpocmehhbjc) Chrome extension.

## 🚀 Features

- **Locate in Code:** Click a "Locate" button in your browser to instantly open the correct file and line in VS Code.
- **Exact Match:** When source location data is available (`data-uic-loc`), jumps directly to the exact file and line — no search needed.
- **Smart Search:** Scores files by IDs, class names, ancestor context, and CSS property/value pairs. Tailwind utility classes are automatically filtered out so they don't pollute results.
- **Multi-Window Support:** Intelligently follows your focus if you have multiple VS Code windows open.
- **Auto-Takeover:** Automatically claims the bridge port when you switch projects.

## 🛠 Setup

1. **Install from Marketplace:** Search for [**UI Checker Bridge**](https://marketplace.visualstudio.com/items?itemName=VinhNguyen-Vincent.ui-checker-bridge) in the VS Code Extensions view or click the link.
2. Ensure you have the [**Figma CSS Diff**](https://chromewebstore.google.com/detail/figma-css-diff/khbnahljdhbiafecmjbojhpocmehhbjc) Chrome extension installed.
3. The bridge starts automatically on port `9876`. You can change this in VS Code settings if needed.

## ⚙️ Configuration

- `ui-checker-bridge.port`: The WebSocket port (default: `9876`).
- `ui-checker-bridge.autoTakeover`: Enable/disable automatic port claiming on window focus.
- `ui-checker-bridge.searchExtensions`: File extensions to search (default: `tsx jsx ts vue svelte astro html css scss less`).
- `ui-checker-bridge.additionalExcludePatterns`: Extra glob patterns to exclude on top of the built-in list (`node_modules`, `dist`, `.next`, `coverage`, etc.). Example: `["**/storybook-static/**"]`.
- `ui-checker-bridge.maxFileSize`: Files larger than this are skipped (default: `1048576` = 1 MB). Lower it to speed up search on large monorepos.

## 📄 License

MIT © [Vinh Nguyen (Vincent)](https://github.com/glorynguyen)
