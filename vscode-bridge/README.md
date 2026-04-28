# UI Checker Bridge

Connect your browser-based UI inspection tools directly to your VS Code workspace. This extension acts as a secure, local bridge for the [**Figma CSS Diff**](https://chromewebstore.google.com/detail/figma-css-diff/khbnahljdhbiafecmjbojhpocmehhbjc) Chrome extension.

## 🚀 Features

- **Locate in Code:** Click a "Locate" button in your browser to instantly open the correct file and line in VS Code.
- **Smart Search:** Advanced scoring algorithm that understands Tailwind CSS, CSS Modules, and standard CSS classes.
- **Multi-Window Support:** Intelligently follows your focus if you have multiple VS Code windows open.
- **Auto-Takeover:** Automatically claims the bridge port when you switch projects.

## 🛠 Setup

1. **Install from Marketplace:** Search for [**UI Checker Bridge**](https://marketplace.visualstudio.com/items?itemName=VinhNguyen-Vincent.ui-checker-bridge) in the VS Code Extensions view or click the link.
2. Ensure you have the [**Figma CSS Diff**](https://chromewebstore.google.com/detail/figma-css-diff/khbnahljdhbiafecmjbojhpocmehhbjc) Chrome extension installed.
3. The bridge starts automatically on port `3000`. You can change this in VS Code settings if needed.

## 🧠 Smart Search Logic

The bridge uses a weighted scoring system to find the best match for your element:
- **ID Match:** 100 points
- **Custom Class Match:** 20 points
- **Active File Bonus:** 50 points
- **Tailwind Aware:** Automatically filters out utility noise like `flex`, `p-4`, and `text-center` to find the unique component code.

## ⚙️ Configuration

- `ui-checker-bridge.port`: The WebSocket port (default: `3000`).
- `ui-checker-bridge.autoTakeover`: Enable/disable automatic port claiming on window focus.

## 📄 License

MIT © [Vinh Nguyen (Vincent)](https://github.com/glorynguyen)
