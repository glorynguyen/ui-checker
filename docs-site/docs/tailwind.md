---
id: tailwind
title: Tailwind Suggestions
---

UI Checker can translate Figma style mismatches into Tailwind utility classes.

## Modes

Open **Workspace Settings** and expand **Tailwind Suggestions**.

| Mode | Behavior |
| --- | --- |
| Off | Hide Tailwind suggestions. |
| Strict matches | Suggest only exact utility scale matches. |
| Nearest utility | Suggest the closest utility and show the distance; falls back to arbitrary values when no close scale match exists. |

## Project Config

Click **Load Config** while the VS Code bridge is connected. The bridge looks for common `tailwind.config.*` files in the open workspace and sends supported theme values back to the Chrome extension.

Supported config sections include:

- spacing;
- colors;
- font size and weight;
- line height and letter spacing;
- border radius and width;
- opacity;
- box shadow.

If no config is found, UI Checker uses the default Tailwind scale.

## Applying Classes

Mismatch rows can show:

- **Copy TW**: copy the suggested utility class.
- **Apply TW**: ask the VS Code bridge to preview and replace a nearby static `class` or `className` string.

Dynamic class expressions such as `clsx(...)` are intentionally not edited automatically. In those cases, UI Checker opens the likely source file and reports that no safe static class string was found.
