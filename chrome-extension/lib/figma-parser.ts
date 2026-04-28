// Figma CSS Parser — parses CSS text copied from Figma Dev Mode into
// normalized key-value pairs, expanding shorthands.

export interface ParsedStyles {
  styles: Record<string, string>;
  varMap: Record<string, { varName: string; fallback: string | null; original: string }>;
  rawStyles: Record<string, string>;
  sourceDeclarations: Record<string, string>;
}

export interface MultiParsedStyles extends ParsedStyles {
  label: string;
}

export const FigmaParser = {
  parse(input: string | any): ParsedStyles {
    if (!input) return { styles: {}, varMap: {}, rawStyles: {}, sourceDeclarations: {} };

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

  _parseNodeObject(node: any): ParsedStyles {
    const doc = node.document || node;
    const styles: Record<string, string> = {};
    const varMap: Record<string, any> = {};
    const rawStyles: Record<string, string> = {};
    const sourceDeclarations: Record<string, string> = {};

    const setStyle = (prop: string, value: string) => {
      styles[prop] = value;
      rawStyles[prop] = value;
      sourceDeclarations[prop] = `${prop}: ${value};`;
    };

    // 1. Sizing
    const box = doc.absoluteBoundingBox || doc.boundingBox;
    if (box) {
      setStyle('width', `${Math.round(box.width)}px`);
      setStyle('height', `${Math.round(box.height)}px`);
    }

    // 2. Background/Color
    const fill = this._getPrimarySolidFill(doc.fills);
    if (fill) {
      const combinedOpacity = this._combineOpacity(fill.opacity, doc.opacity);
      const color = this._figmaColorToRgb(fill.color, combinedOpacity);
      if (this._isTextNode(doc)) {
        setStyle('color', color);
      } else {
        setStyle('background-color', color);
      }
    }

    // 3. Typography
    if (doc.style) {
      const s = doc.style;
      if (s.fontFamily) setStyle('font-family', s.fontFamily);
      if (s.fontSize) setStyle('font-size', `${s.fontSize}px`);
      if (s.fontWeight) setStyle('font-weight', s.fontWeight.toString());
      if (s.lineHeightPx) setStyle('line-height', `${Math.round(s.lineHeightPx)}px`);
      if (s.letterSpacing) setStyle('letter-spacing', `${s.letterSpacing}px`);
      if (s.textAlignHorizontal) setStyle('text-align', s.textAlignHorizontal.toLowerCase());
    }

    // 4. Border Radius
    if (doc.cornerRadius !== undefined) {
      const r = `${doc.cornerRadius}px`;
      setStyle('border-top-left-radius', r);
      setStyle('border-top-right-radius', r);
      setStyle('border-bottom-right-radius', r);
      setStyle('border-bottom-left-radius', r);
    }

    // 5. Padding/Gap (Auto Layout)
    if (doc.paddingTop !== undefined) setStyle('padding-top', `${doc.paddingTop}px`);
    if (doc.paddingRight !== undefined) setStyle('padding-right', `${doc.paddingRight}px`);
    if (doc.paddingBottom !== undefined) setStyle('padding-bottom', `${doc.paddingBottom}px`);
    if (doc.paddingLeft !== undefined) setStyle('padding-left', `${doc.paddingLeft}px`);
    if (doc.itemSpacing !== undefined) setStyle('gap', `${doc.itemSpacing}px`);

    return { styles, varMap, rawStyles, sourceDeclarations };
  },

  _getPrimarySolidFill(fills: any[]) {
    if (!Array.isArray(fills)) return null;

    for (const fill of fills) {
      if (!fill || fill.visible === false) continue;
      if (fill.type === 'SOLID') {
        return fill;
      }
    }

    return null;
  },

  _isTextNode(doc: any) {
    return doc?.type === 'TEXT';
  },

  _combineOpacity(fillOpacity: number | undefined, nodeOpacity: number | undefined) {
    const fillAlpha = typeof fillOpacity === 'number' ? fillOpacity : 1;
    const nodeAlpha = typeof nodeOpacity === 'number' ? nodeOpacity : 1;
    return fillAlpha * nodeAlpha;
  },

  _figmaColorToRgb(c: { r: number; g: number; b: number }, opacity: number = 1) {
    const r = Math.round(c.r * 255);
    const g = Math.round(c.g * 255);
    const b = Math.round(c.b * 255);
    const a = opacity !== undefined ? opacity : 1;
    return a === 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${a})`;
  },

  _parseCSSText(cssText: string): ParsedStyles {
    if (!cssText || !cssText.trim()) return { styles: {}, varMap: {}, rawStyles: {}, sourceDeclarations: {} };

    // Strip CSS comments
    let cleaned = cssText.replace(/\/\*[\s\S]*?\*\//g, '');

    // Split into declarations
    const declarations = cleaned
      .split(';')
      .map(d => d.trim())
      .filter(d => d.includes(':'));

    const styles: Record<string, string> = {};
    const varMap: Record<string, any> = {};
    const rawStyles: Record<string, string> = {};
    const sourceDeclarations: Record<string, string> = {};

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
      const expandedRaw = varInfo ? null : this._expandShorthand(prop, rawValue);

      // Map var info to each expanded property
      for (const expandedProp of Object.keys(expanded)) {
        if (varInfo) {
          varMap[expandedProp] = {
            varName: varInfo.varName,
            fallback: varInfo.fallback,
            original: rawValue
          };
        }

        rawStyles[expandedProp] = varInfo
          ? rawValue
          : (expandedRaw?.[expandedProp] ?? rawValue);
        sourceDeclarations[expandedProp] = `${expandedProp}: ${rawStyles[expandedProp]};`;
      }

      Object.assign(styles, expanded);
    }

    return { styles, varMap, rawStyles, sourceDeclarations };
  },

  // Extract var(--name, fallback) info and resolve to fallback
  _extractVarInfo(value: string) {
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

  _expandShorthand(prop: string, value: string): Record<string, string> {
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

  _expandBoxShorthand(prefix: string, value: string): Record<string, string> {
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

  _expandBorderRadius(value: string): Record<string, string> {
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

  _expandBorder(value: string) {
    // border: 1px solid #ccc
    const match = value.match(/^(\S+)\s+(\S+)\s+(.+)$/);
    if (!match) return { 'border': value };

    const [, width, style, color] = match;
    const result: Record<string, string> = {};
    for (const side of ['top', 'right', 'bottom', 'left']) {
      result[`border-${side}-width`] = width;
      result[`border-${side}-style`] = style;
      result[`border-${side}-color`] = color;
    }
    return result;
  },

  _isColorValue(value: string) {
    return /^#[0-9a-fA-F]{3,8}$/.test(value) ||
           /^rgba?\(/.test(value) ||
           /^hsla?\(/.test(value) ||
           /^(transparent|currentColor|inherit)$/i.test(value);
  },

  /**
   * Parse multi-block CSS text into an array of { label, styles, varMap }.
   * Blocks are delimited by CSS comments or double-newlines.
   */
  parseMulti(cssText: string): MultiParsedStyles[] {
    if (!cssText || !cssText.trim()) return [];

    // Try splitting by CSS comments first
    const commentPattern = /\/\*\s*(.+?)\s*\*\//g;
    const comments = [...cssText.matchAll(commentPattern)];

    if (comments.length > 0) {
      const blocks: MultiParsedStyles[] = [];
      for (let i = 0; i < comments.length; i++) {
        const label = comments[i][1].trim();
        const start = (comments[i].index || 0) + comments[i][0].length;
        const end = i + 1 < comments.length ? (comments[i + 1].index || 0) : cssText.length;
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
