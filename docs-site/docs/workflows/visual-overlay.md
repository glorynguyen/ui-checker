---
id: visual-overlay
title: Visual Overlay
---

The visual overlay workflow compares screenshots instead of only CSS declarations.

## Capture The Live Element

After selecting an element, UI Checker captures the visible browser tab and crops to the selected element bounds. You can also trigger capture manually from the overlay controls.

## Add The Figma Image

The Figma image can come from:

- automatic Figma rendered image fetch;
- drag-and-drop upload;
- pasted screenshot;
- file picker upload.

## Comparison Modes

| Mode | Use Case |
| --- | --- |
| Onion-skin | Blend Figma and browser screenshots to inspect alignment and size. |
| Side-by-side | Compare screenshots without overlap. |
| Pixel diff | Highlight changed pixels and calculate a match percentage. |

## Sensitivity

Pixel diff mode includes a threshold control. Increase the threshold to ignore tiny antialiasing or rendering differences. Decrease it when you need strict visual matching.

## Practical Notes

- Capture works best when the selected element is fully visible in the viewport.
- Browser font rendering can differ from Figma even when CSS values match.
- Use style diffing first for precise CSS fixes, then use overlay for composition and alignment checks.
