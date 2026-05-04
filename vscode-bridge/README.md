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

## ⚡ Exact Jump with `@ui-checker/runtime` (React)

By default the bridge finds your source file by fuzzy-matching CSS selectors. For an **exact jump** to the right file and line every time, add the optional runtime to your React project — it stamps every DOM node with its source location at render time.

### Install

```bash
npm install --save-dev @ui-checker/runtime
```

### Add one import to your root entry file

```ts
// Next.js (App Router) — app/layout.tsx
import '@ui-checker/runtime';

// Next.js (Pages Router) — pages/_app.tsx
import '@ui-checker/runtime';

// Vite / CRA / Remix — src/main.tsx
import '@ui-checker/runtime';
```

That's it. After the next render, every element in the browser carries two attributes that the bridge reads directly:

- `data-uic-loc="src/components/Button.tsx:42:5"` — exact workspace-relative `path:line:col`
- `data-uic-name="Button"` — nearest component name

### Notes

- **Import order matters.** The import must come before React evaluates. Placing it at the top of your root entry file is enough — bundlers hoist it automatically.
- **No-ops in production.** `process.env.NODE_ENV === 'production'` disables the runtime, so you can keep the import unconditional and it won't affect your production bundle.
- **Monorepo path mismatch.** If your dev server's working directory differs from your VS Code workspace root, the bridge may not resolve the exact path and will fall back to fuzzy search. Open the workspace at the same root your bundler runs from to avoid this.
- **React only.** The runtime relies on React's dev JSX `_debugSource`. Vue and Svelte are not supported.

## 🔌 Status Bar

The bridge status is always visible in the bottom-right status bar:

| Status | Meaning |
|---|---|
| `⚡ Bridge: Active (9876)` | A browser tab is connected |
| `⊘ Bridge: Listening (9876)` | Server is running, waiting for a browser |
| `⊘ Bridge: In Use (9876)` | Port is held by another VS Code window |

**Port in use?** Click `Bridge: In Use (9876)` directly — it will attempt to retake the port without requiring a reload. If another VS Code window still holds it, that window's bridge will stop and this one takes over.

## 📄 License

MIT © [Vinh Nguyen (Vincent)](https://github.com/glorynguyen)
