---
id: troubleshooting
title: Troubleshooting
---

## Extension Panel Does Not Appear

Rebuild the extension and reload it in Chrome:

```bash
npm run build:extension
```

Then open `chrome://extensions/`, click reload for UI Checker, and reopen DevTools.

## Figma Connect Fails

Check that:

- the token is copied correctly;
- the token has file content access;
- the Figma file is available to the token owner;
- the organization does not block personal access token use.

## Fetch Spec Fails

Use a full Figma URL first. It should include both the file key and `node-id` query parameter.

Example:

```text
https://www.figma.com/design/abc123/My-File?node-id=12-34
```

UI Checker converts `12-34` to `12:34` for API calls.

## Sync Tab Finds Nothing

Make sure:

- a Figma tab is open in Chrome;
- the URL is on `figma.com/design/...` or `figma.com/file/...`;
- a layer is selected so the URL includes `node-id`;
- the Figma tab is in the same browser profile as DevTools.

## Element Capture Fails

The selected element must be in the visible tab and available to the content script. Try scrolling the element into view and selecting it again.

## Locate In VS Code Fails

Check that:

- the VS Code bridge extension is installed and running;
- the configured bridge port matches the VS Code extension port;
- your workspace is open in VS Code;
- the selected element has stable selectors or source metadata.

## CI Runner Fails With Missing Token

Set the token environment variable:

```bash
export FIGMA_TOKEN=figd_your_token
```

Or update `figmaTokenEnv` in the config to match your environment variable name.

## Docs Site Dependency Install Fails

The docs site is a separate Docusaurus app. Install its dependencies from the repository root:

```bash
npm run docs:install
```

If your network blocks npm registry access, configure your npm registry or proxy first.
