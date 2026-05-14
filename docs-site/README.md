# UI Checker Documentation Site

This folder contains the Docusaurus documentation site for the UI Checker Chrome DevTools extension.

## Local Development

```bash
npm --prefix docs-site install
npm run docs:dev
```

The local server defaults to `http://localhost:3000`.

## Production Build

```bash
npm run docs:build
npm run docs:serve
```

The generated static site is written to `docs-site/build/`.
