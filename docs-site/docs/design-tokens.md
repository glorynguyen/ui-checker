---
id: design-tokens
title: Design Tokens
---

UI Checker can validate expected Figma values against imported design tokens.

## Import Tokens

Open **Workspace Settings** and use **Import Tokens** in the Design Tokens section.

Supported JSON shapes:

```json
{
  "color.primary": "#336699",
  "space.4": "16px",
  "font.weight.bold": 700
}
```

W3C-style token objects are also supported:

```json
{
  "color": {
    "primary": {
      "$type": "color",
      "$value": "#336699"
    }
  }
}
```

## Validation Results

Token validation appears next to expected values in the diff report.

| Result | Meaning |
| --- | --- |
| Tokenized | The expected value uses a CSS variable that maps to an imported token name. |
| Hardcoded | The expected value matches a token value but does not use the token variable. |
| Unmapped | No exact token match was found. UI Checker may show the nearest token suggestion. |

## Coverage Summary

When tokens are loaded, reports include token coverage counts:

- tokenized values;
- hardcoded token matches;
- unmapped values;
- tokenized percentage.

Use this to find places where design values are correct but should be expressed through shared tokens.
