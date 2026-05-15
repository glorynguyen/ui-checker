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

## Setup Runtime From Chrome

Open UI Checker's **Workspace Settings**, expand **VS Code Bridge**, and click **Setup Runtime**. The Chrome extension sends a setup request to the VS Code bridge. VS Code will ask for confirmation before it runs your package manager and adds the `@ui-checker/runtime` import to the detected app entry file.

## Locate From Results

After running a comparison:

1. Find a mismatch row.
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
