---
id: vscode-bridge
title: VS Code Bridge
---

The VS Code bridge helps connect DevTools mismatches to source code.

## How It Works

The Chrome extension sends selector and mismatch context to a local WebSocket server started by the UI Checker VS Code extension. The VS Code extension searches the workspace and opens likely source matches.

Default bridge port:

```text
9876
```

You can change the port in UI Checker's **Workspace Settings**.

## Multi-Window Support

If you have multiple VS Code windows open, the bridge port can only be held by one window at a time.

### Auto-Takeover
By default, the bridge is configured to **Auto-Takeover**. When you switch focus to a VS Code window, it will automatically request the bridge port from any other window currently holding it.

You can disable this in VS Code settings:
`ui-checker-bridge.autoTakeover: false`

### Manual Retake
If you need to manually force a window to take over the bridge port, run the command:
**UI Checker Bridge: Retake UI Checker Bridge Port**

## Setup Runtime

The runtime adds source metadata to your application, allowing for 100% accurate "Locate in Code" jumps.

### From Chrome
Open UI Checker's **Workspace Settings**, expand **VS Code Bridge**, and click **Setup Runtime**. The Chrome extension sends a setup request to the VS Code bridge. VS Code will ask for confirmation before it adds `@ui-checker/runtime` to the nearest `package.json` and imports it into the detected app entry file.

### From VS Code
You can also trigger the setup process directly from VS Code using the command:
**UI Checker Bridge: Setup UI Checker Runtime (Install & Import)**

## Locate From Results

After running a comparison, there are two ways to jump to code:

### Hero Button
When an element is selected, a **Locate in Editor** button appears in the "Active Selection" header. This is the fastest way to jump to the component definition.

### Result Rows
1. Find a mismatch row in the results list.
2. Click **Locate**.
3. VS Code opens the likely file and match.

The payload can include:

- selected element descriptor;
- ancestor descriptors;
- source location attributes when available;
- mismatched property;
- expected value.

## Source Location Attributes

If your app can stamp source metadata during development, UI Checker looks for:

```html
data-uic-loc="src/components/Button.tsx:12"
data-uic-name="Button"
```

This improves locate accuracy because the selected DOM target is often a nested child of the component that owns the styling.

## When Search Is Approximate

If source metadata is not available, the bridge falls back to selector, class, and value search. Utility-class-heavy projects can produce multiple candidates, so prefer stable test IDs or source metadata for important components.
