---
id: compare-elements
title: Compare Elements
---

The primary UI Checker workflow runs inside Chrome DevTools.

## Select A Live Element

Use one of two selection paths:

- **Pick From Page**: hover and click an element in the inspected page.
- **Manual CSS Selector**: enter a selector such as `[data-testid="primary-button"]`.

After selection, the panel shows:

- element descriptor;
- dimensions;
- extracted computed CSS;
- source hints when available;
- visual overlay controls.

If the selected element has `data-figma-id`, UI Checker uses that as the Figma node ID and attempts to fetch the node automatically.

## Fetch Or Paste The Figma Spec

Use the Figma connection controls to fetch the node, or paste CSS copied from Figma Dev Mode into the spec box.

The parser supports:

- Figma REST node JSON;
- raw CSS declarations;
- shorthand expansion for padding, margin, gap, border, and border radius;
- CSS variables with fallbacks.

## Run Comparison

Click **Compare** after both a live element and a Figma spec are available.

The diff report groups properties by area:

- spacing;
- typography;
- sizing;
- layout;
- visual styling.

Each property can be:

| Status | Meaning |
| --- | --- |
| Match | The normalized values are equivalent or within tolerance. |
| Mismatch | Both values exist, but differ beyond tolerance. |
| Missing | Figma expected a property that was not extracted from the browser style set. |

## Fix And Report

For each mismatch, use:

- **Fix** to copy the expected CSS declaration;
- **Locate** to ask the VS Code bridge to find likely source code;
- **Copy Report** to copy a Markdown report;
- **Copy AI Prompt** to copy structured context for an AI code assistant.

## Tolerance Rules

Tolerance settings are stored in workspace settings:

- spacing tolerance in pixels;
- color channel tolerance;
- border-radius tolerance.

Small subpixel differences are treated as matches.
