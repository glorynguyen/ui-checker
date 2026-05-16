---
id: ci
title: CI Runner
---

The CI runner executes style checks outside the Chrome extension. It is useful for Storybook pages, component preview routes, and stable test pages.

## Run A Check

```bash
npm run ci:check -- --config ui-checker.config.json --json ui-checker-report.json --markdown ui-checker-report.md --html ui-checker-report.html
```

## Example Config

```json
{
  "baseUrl": "http://localhost:6006",
  "figmaTokenEnv": "FIGMA_TOKEN",
  "tolerance": {
    "spacing": 2,
    "color": 5,
    "borderRadius": 2
  },
  "failOn": {
    "major": true,
    "minorCount": 0,
    "missing": true
  },
  "checks": [
    {
      "name": "Primary Button",
      "path": "/iframe.html?id=button--primary",
      "selector": "[data-testid='primary-button']",
      "figmaFileKey": "abc123",
      "figmaNodeId": "12:34"
    }
  ]
}
```

## Required Environment

Set the Figma token before running checks:

```bash
export FIGMA_TOKEN=figd_your_token
```

If you use another variable name, set `figmaTokenEnv` in the config.

## Reports

The runner can write:

- JSON report for machines;
- Markdown report for pull requests or review threads;
- HTML report for standalone visual inspection.

The process exits non-zero when configured failure thresholds are exceeded.

## Current Scope

The current runner is style-focused. It reuses the extension's Figma parser, normalizer, and diff engine.

Not included yet:

- hosted GitHub Action wrapper;
- PR comment publishing;
- baseline approval workflow;
- visual screenshot diff in CI.
