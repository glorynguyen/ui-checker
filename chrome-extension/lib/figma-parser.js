// Figma CSS Parser — parses CSS text copied from Figma Dev Mode into
// normalized key-value pairs, expanding shorthands.

const FigmaParser = {
  parse(cssText) {
    if (!cssText || !cssText.trim()) return {};

    // Strip CSS comments
    let cleaned = cssText.replace(/\/\*[\s\S]*?\*\//g, '');

    // Split into declarations
    const declarations = cleaned
      .split(';')
      .map(d => d.trim())
      .filter(d => d.includes(':'));

    const result = {};

    for (const decl of declarations) {
      const colonIdx = decl.indexOf(':');
      const prop = decl.slice(0, colonIdx).trim().toLowerCase();
      const value = decl.slice(colonIdx + 1).trim();

      if (!prop || !value) continue;

      // Expand shorthands
      const expanded = this._expandShorthand(prop, value);
      Object.assign(result, expanded);
    }

    return result;
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
  }
};

if (typeof window !== 'undefined') {
  window.FigmaParser = FigmaParser;
}
