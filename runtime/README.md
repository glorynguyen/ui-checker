# @ui-checker/runtime

Dev-only runtime that stamps every rendered DOM node with its React source
location so the [ui-checker](../README.md) Chrome extension + VSCode bridge can
open the exact file and line you clicked, instead of fuzzy-matching CSS
selectors against the workspace.

## Install

```bash
npm install --save-dev @ui-checker/runtime
```

## Use

Import once at the top of your root layout / entry file:

```ts
// Next.js — app/layout.tsx
import '@ui-checker/runtime';

// Next.js (pages) — pages/_app.tsx
import '@ui-checker/runtime';

// Vite / CRA / Remix — src/main.tsx (or equivalent)
import '@ui-checker/runtime';
```

That's it. After the next render, every host element will carry:

- `data-uic-loc="src/components/Button.tsx:42:5"` — workspace-relative `path:line:col`
- `data-uic-name="Button"` — nearest component name

## How it works

React's dev JSX runtime (`_jsxDEV`) attaches `_debugSource = { fileName,
lineNumber, columnNumber }` and `_debugOwner` to every fiber. This package
subscribes to the React DevTools commit hook and walks the fiber tree on each
commit, stamping the DOM nodes whose React fiber has a `_debugSource`.

There is no build-time transform. Works with any React framework that uses the
dev JSX runtime: Next.js (SWC), Vite (`@vitejs/plugin-react`), CRA, Remix, etc.

## Production

The package no-ops if `process.env.NODE_ENV === 'production'`, and React strips
`_debugSource` from production builds anyway, so importing it in a production
bundle does nothing. You can keep the import unconditional.

## Caveats

- **Run before React loads.** The runtime installs the React DevTools global
  hook if it isn't already present. This must happen before React itself
  evaluates. Importing at the top of your root entry file is enough — bundlers
  hoist it ahead of React.
- **Workspace path mismatch.** The runtime emits paths relative to the longest
  common prefix it sees across stamped fibers. If your dev server's CWD differs
  from your VSCode workspace root (e.g. monorepo sub-package), the bridge may
  not find the file by exact path and will fall back to fuzzy search.
- **Vue/Svelte not supported.** This package relies on React's `_debugSource`.
  Other frameworks would need their own instrumentation.
