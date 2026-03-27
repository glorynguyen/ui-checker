// Style Extractor — curated property list and extraction logic.
// Used by the content script (which inlines the extraction) and available
// for reference/import in panel-side code.

const PROPERTY_GROUPS = {
  Spacing: [
    'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
    'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
    'gap', 'row-gap', 'column-gap'
  ],
  Typography: [
    'font-family', 'font-size', 'font-weight', 'line-height',
    'letter-spacing', 'text-align', 'text-transform', 'text-decoration', 'color'
  ],
  Sizing: [
    'width', 'height', 'min-width', 'max-width', 'min-height', 'max-height'
  ],
  Layout: [
    'display', 'flex-direction', 'align-items', 'justify-content', 'flex-wrap',
    'position', 'top', 'right', 'bottom', 'left', 'z-index'
  ],
  Visual: [
    'background-color',
    'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width',
    'border-top-style', 'border-right-style', 'border-bottom-style', 'border-left-style',
    'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color',
    'border-top-left-radius', 'border-top-right-radius',
    'border-bottom-right-radius', 'border-bottom-left-radius',
    'box-shadow', 'opacity', 'overflow'
  ]
};

const ALL_PROPERTIES = Object.values(PROPERTY_GROUPS).flat();

function getPropertyGroup(property) {
  for (const [group, props] of Object.entries(PROPERTY_GROUPS)) {
    if (props.includes(property)) return group;
  }
  return 'Other';
}

// Make available globally for panel scripts loaded in the same context
if (typeof window !== 'undefined') {
  window.StyleExtractor = { PROPERTY_GROUPS, ALL_PROPERTIES, getPropertyGroup };
}
