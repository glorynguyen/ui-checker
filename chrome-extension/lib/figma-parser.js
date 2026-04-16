// Figma CSS Parser — parses CSS text copied from Figma Dev Mode into
// normalized key-value pairs, expanding shorthands.

const FigmaParser = {
  parse(input) {
    if (!input) return { styles: {}, varMap: {} };

    // Handle JSON object (direct from API)
    if (typeof input === 'object' && input !== null) {
      return this._parseNodeObject(input);
    }

    // Handle JSON string (if pasted into textarea)
    if (typeof input === 'string' && input.trim().startsWith('{')) {
      try {
        const obj = JSON.parse(input);
        return this._parseNodeObject(obj);
      } catch (e) {
        // Fall back to CSS parsing if JSON is malformed
      }
    }

    return this._parseCSSText(input);
  },

  _parseNodeObject(node) {
    const doc = node.document || node;
    const styles = {};
    const varMap = {};

    // 1. Sizing
    const box = doc.absoluteBoundingBox || doc.boundingBox;
    if (box) {
      styles['width'] = `${Math.round(box.width)}px`;
      styles['height'] = `${Math.round(box.height)}px`;
    }

    // 2. Background/Color
    if (Array.isArray(doc.fills) && doc.fills.length > 0) {
      const fill = doc.fills[0];
      if (fill.type === 'SOLID') {
        const color = this._figmaColorToRgb(fill.color, fill.opacity);
        styles['background-color'] = color;
      }
    }

    // 3. Typography
    if (doc.style) {
      const s = doc.style;
      if (s.fontFamily) styles['font-family'] = s.fontFamily;
      if (s.fontSize) styles['font-size'] = `${s.fontSize}px`;
      if (s.fontWeight) styles['font-weight'] = s.fontWeight.toString();
      if (s.lineHeightPx) styles['line-height'] = `${Math.round(s.lineHeightPx)}px`;
      if (s.letterSpacing) styles['letter-spacing'] = `${s.letterSpacing}px`;
      if (s.textAlignHorizontal) styles['text-align'] = s.textAlignHorizontal.toLowerCase();
    }

    // 4. Border Radius
    if (doc.cornerRadius !== undefined) {
      const r = `${doc.cornerRadius}px`;
      styles['border-top-left-radius'] = r;
      styles['border-top-right-radius'] = r;
      styles['border-bottom-right-radius'] = r;
      styles['border-bottom-left-radius'] = r;
    }

    // 5. Padding/Gap (Auto Layout)
    if (doc.paddingTop !== undefined) styles['padding-top'] = `${doc.paddingTop}px`;
    if (doc.paddingRight !== undefined) styles['padding-right'] = `${doc.paddingRight}px`;
    if (doc.paddingBottom !== undefined) styles['padding-bottom'] = `${doc.paddingBottom}px`;
    if (doc.paddingLeft !== undefined) styles['padding-left'] = `${doc.paddingLeft}px`;
    if (doc.itemSpacing !== undefined) styles['gap'] = `${doc.itemSpacing}px`;

    return { styles, varMap };
  },

  _figmaColorToRgb(c, opacity = 1) {
    const r = Math.round(c.r * 255);
    const g = Math.round(c.g * 255);
    const b = Math.round(c.b * 255);
    const a = opacity !== undefined ? opacity : 1;
    return a === 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${a})`;
  },

  _parseCSSText(cssText) {
    if (!cssText || !cssText.trim()) return { styles: {}, varMap: {} };

    // Strip CSS comments
    let cleaned = cssText.replace(/\/\*[\s\S]*?\*\//g, '');

    // Split into declarations
    const declarations = cleaned
      .split(';')
      .map(d => d.trim())
      .filter(d => d.includes(':'));

    const styles = {};
    const varMap = {};

    for (const decl of declarations) {
      const colonIdx = decl.indexOf(':');
      const prop = decl.slice(0, colonIdx).trim().toLowerCase();
      const rawValue = decl.slice(colonIdx + 1).trim();

      if (!prop || !rawValue) continue;

      // Extract var() metadata before resolving
      const varInfo = this._extractVarInfo(rawValue);
      const value = varInfo ? varInfo.resolved : rawValue;

      // Expand shorthands
      const expanded = this._expandShorthand(prop, value);

      // Map var info to each expanded property
      if (varInfo) {
        for (const expandedProp of Object.keys(expanded)) {
          varMap[expandedProp] = {
            varName: varInfo.varName,
            fallback: varInfo.fallback,
            original: rawValue
          };
        }
      }

      Object.assign(styles, expanded);
    }

    return { styles, varMap };
  },

  // Extract var(--name, fallback) info and resolve to fallback
  _extractVarInfo(value) {
    const match = value.match(/var\(\s*(--[\w-]+)\s*(?:,\s*(.+?))?\s*\)$/);
    if (!match) return null;

    const varName = match[1];
    const fallback = match[2] ? match[2].trim() : null;

    return {
      varName,
      fallback,
      resolved: fallback || value, // keep raw if no fallback
      original: value
    };
  },

  _expandShorthand(prop, value) {
    switch (prop) {
      case 'padding':
        return this._expandBoxShorthand('padding', value);
      case 'margin':
        return this._expandBoxShorthand('margin', value);
      case 'gap': {
        const parts = value.split(/\s+/);
        if (parts.length === 1) {
          return { 'row-gap': parts[0], 'column-gap': parts[0] };
        }
        return { 'row-gap': parts[0], 'column-gap': parts[1] };
      }
      case 'border-radius':
        return this._expandBorderRadius(value);
      case 'border':
        return this._expandBorder(value);
      case 'background':
        // If it's a simple color value, map to background-color
        if (this._isColorValue(value)) {
          return { 'background-color': value };
        }
        return { 'background': value };
      default:
        return { [prop]: value };
    }
  },

  _expandBoxShorthand(prefix, value) {
    const parts = value.split(/\s+/);
    let top, right, bottom, left;

    switch (parts.length) {
      case 1:
        top = right = bottom = left = parts[0];
        break;
      case 2:
        top = bottom = parts[0];
        right = left = parts[1];
        break;
      case 3:
        top = parts[0];
        right = left = parts[1];
        bottom = parts[2];
        break;
      case 4:
        top = parts[0];
        right = parts[1];
        bottom = parts[2];
        left = parts[3];
        break;
      default:
        return { [prefix]: value };
    }

    return {
      [`${prefix}-top`]: top,
      [`${prefix}-right`]: right,
      [`${prefix}-bottom`]: bottom,
      [`${prefix}-left`]: left
    };
  },

  _expandBorderRadius(value) {
    const parts = value.split(/\s+/);
    let tl, tr, br, bl;

    switch (parts.length) {
      case 1:
        tl = tr = br = bl = parts[0];
        break;
      case 2:
        tl = br = parts[0];
        tr = bl = parts[1];
        break;
      case 3:
        tl = parts[0];
        tr = bl = parts[1];
        br = parts[2];
        break;
      case 4:
        tl = parts[0];
        tr = parts[1];
        br = parts[2];
        bl = parts[3];
        break;
      default:
        return { 'border-radius': value };
    }

    return {
      'border-top-left-radius': tl,
      'border-top-right-radius': tr,
      'border-bottom-right-radius': br,
      'border-bottom-left-radius': bl
    };
  },

  _expandBorder(value) {
    // border: 1px solid #ccc
    const match = value.match(/^(\S+)\s+(\S+)\s+(.+)$/);
    if (!match) return { 'border': value };

    const [, width, style, color] = match;
    const result = {};
    for (const side of ['top', 'right', 'bottom', 'left']) {
      result[`border-${side}-width`] = width;
      result[`border-${side}-style`] = style;
      result[`border-${side}-color`] = color;
    }
    return result;
  },

  _isColorValue(value) {
    return /^#[0-9a-fA-F]{3,8}$/.test(value) ||
           /^rgba?\(/.test(value) ||
           /^hsla?\(/.test(value) ||
           /^(transparent|currentColor|inherit)$/i.test(value);
  },

  /**
   * Parse multi-block CSS text into an array of { label, styles, varMap }.
   * Blocks are delimited by CSS comments or double-newlines.
   */
  parseMulti(cssText) {
    if (!cssText || !cssText.trim()) return [];

    // Try splitting by CSS comments first
    const commentPattern = /\/\*\s*(.+?)\s*\*\//g;
    const comments = [...cssText.matchAll(commentPattern)];

    if (comments.length > 0) {
      const blocks = [];
      for (let i = 0; i < comments.length; i++) {
        const label = comments[i][1].trim();
        const start = comments[i].index + comments[i][0].length;
        const end = i + 1 < comments.length ? comments[i + 1].index : cssText.length;
        const blockText = cssText.slice(start, end).trim();
        if (blockText) {
          const parsed = this.parse(blockText);
          blocks.push({ label, ...parsed });
        }
      }
      return blocks;
    }

    // Fallback: split by double-newlines
    const rawBlocks = cssText.split(/\n\s*\n/).filter(b => b.trim());
    return rawBlocks.map((block, i) => {
      const parsed = this.parse(block);
      return { label: `Element ${i + 1}`, ...parsed };
    });
  }
};

if (typeof window !== 'undefined') {
  window.FigmaParser = FigmaParser;
}
