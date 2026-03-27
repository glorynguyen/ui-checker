// Style Normalizer — converts both browser and Figma values into a
// comparable canonical form.

const Normalizer = {
  normalize(styles, rootFontSize = 16) {
    const result = {};
    for (const [prop, value] of Object.entries(styles)) {
      result[prop] = this.normalizeValue(prop, value, rootFontSize, styles);
    }
    return result;
  },

  normalizeValue(prop, value, rootFontSize = 16, allStyles = {}) {
    if (value === undefined || value === null) return null;

    let v = String(value).trim();

    // Resolve any remaining var() wrappers to fallback values
    v = v.replace(/var\(\s*--[\w-]+\s*,\s*(.+?)\s*\)/g, '$1');

    // Lowercase general values
    v = v.toLowerCase();

    // --- Color normalization ---
    if (this._isColorProperty(prop)) {
      v = this._normalizeColor(v);
    }

    // --- Font-weight keywords ---
    if (prop === 'font-weight') {
      v = this._normalizeFontWeight(v);
    }

    // --- Font-family: primary font only, lowercase ---
    if (prop === 'font-family') {
      v = this._normalizeFontFamily(v);
    }

    // --- Rem to px ---
    v = this._remToPx(v, rootFontSize);

    // --- line-height "normal" ---
    if (prop === 'line-height' && v === 'normal') {
      const fontSize = parseFloat(allStyles['font-size']) || 16;
      v = Math.round(fontSize * 1.2) + 'px';
    }

    // --- Strip unit from zero ---
    if (/^0(px|rem|em|%|pt)?$/.test(v)) {
      v = '0';
    }

    // --- border "none" ---
    if (prop.includes('border') && (v === 'none' || v === '0px none rgb(0, 0, 0)')) {
      if (prop.includes('width')) v = '0';
      if (prop.includes('style')) v = 'none';
    }

    // --- Figma missing units: bare numbers for px properties ---
    if (/^\d+(\.\d+)?$/.test(v) && this._isPxProperty(prop)) {
      v = v + 'px';
    }

    // --- "Auto" normalization ---
    if (v === 'auto') v = 'auto';

    return v;
  },

  _isColorProperty(prop) {
    return prop === 'color' || prop === 'background-color' ||
           prop.includes('border') && prop.includes('color');
  },

  _normalizeColor(value) {
    // Hex to rgb
    const hexMatch = value.match(/^#([0-9a-f]{3,8})$/);
    if (hexMatch) {
      return this._hexToRgb(hexMatch[1]);
    }

    // Normalize rgb/rgba spacing
    const rgbMatch = value.match(/^(rgba?)\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/);
    if (rgbMatch) {
      const [, fn, r, g, b, a] = rgbMatch;
      if (a !== undefined && parseFloat(a) !== 1) {
        return `rgba(${r}, ${g}, ${b}, ${a})`;
      }
      return `rgb(${r}, ${g}, ${b})`;
    }

    return value;
  },

  _hexToRgb(hex) {
    let r, g, b, a;
    if (hex.length === 3) {
      r = parseInt(hex[0] + hex[0], 16);
      g = parseInt(hex[1] + hex[1], 16);
      b = parseInt(hex[2] + hex[2], 16);
    } else if (hex.length === 6) {
      r = parseInt(hex.slice(0, 2), 16);
      g = parseInt(hex.slice(2, 4), 16);
      b = parseInt(hex.slice(4, 6), 16);
    } else if (hex.length === 8) {
      r = parseInt(hex.slice(0, 2), 16);
      g = parseInt(hex.slice(2, 4), 16);
      b = parseInt(hex.slice(4, 6), 16);
      a = parseInt(hex.slice(6, 8), 16) / 255;
      if (a !== 1) {
        return `rgba(${r}, ${g}, ${b}, ${parseFloat(a.toFixed(2))})`;
      }
    } else {
      return `#${hex}`;
    }
    return `rgb(${r}, ${g}, ${b})`;
  },

  _normalizeFontWeight(value) {
    const map = {
      'thin': '100', 'hairline': '100',
      'extra-light': '200', 'ultralight': '200',
      'light': '300',
      'normal': '400', 'regular': '400',
      'medium': '500',
      'semi-bold': '600', 'semibold': '600', 'demi-bold': '600',
      'bold': '700',
      'extra-bold': '800', 'ultrabold': '800',
      'black': '900', 'heavy': '900'
    };
    return map[value] || value;
  },

  _normalizeFontFamily(value) {
    // Take primary font, lowercase, strip quotes
    const primary = value.split(',')[0].trim().replace(/['"]/g, '');
    return primary.toLowerCase();
  },

  _remToPx(value, rootFontSize) {
    return value.replace(/([\d.]+)rem/g, (_, num) => {
      return (parseFloat(num) * rootFontSize) + 'px';
    });
  },

  _isPxProperty(prop) {
    const pxProps = [
      'font-size', 'line-height', 'letter-spacing',
      'width', 'height', 'min-width', 'max-width', 'min-height', 'max-height',
      'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
      'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
      'gap', 'row-gap', 'column-gap',
      'top', 'right', 'bottom', 'left',
      'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width',
      'border-top-left-radius', 'border-top-right-radius',
      'border-bottom-right-radius', 'border-bottom-left-radius'
    ];
    return pxProps.includes(prop);
  }
};

if (typeof window !== 'undefined') {
  window.Normalizer = Normalizer;
}
