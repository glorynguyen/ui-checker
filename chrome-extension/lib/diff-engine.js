// Diff Engine — compares two normalized style objects and produces a
// structured diff report with severity classification.

const DiffEngine = {
  defaultTolerance: {
    spacing: 2,      // ±px
    color: 5,        // ±per channel
    borderRadius: 2  // ±px
  },

  compare(expected, actual, tolerance = {}) {
    const tol = { ...this.defaultTolerance, ...tolerance };
    const results = [];

    // Compare all properties from expected (Figma)
    const allProps = new Set([...Object.keys(expected), ...Object.keys(actual)]);
    // Only diff properties that exist in expected
    for (const prop of Object.keys(expected)) {
      const exp = expected[prop];
      const act = actual[prop] !== undefined ? actual[prop] : null;

      if (act === null || act === undefined) {
        results.push({
          property: prop,
          status: 'missing',
          expected: exp,
          actual: null,
          severity: 'major'
        });
        continue;
      }

      if (exp === act) {
        results.push({
          property: prop,
          status: 'match',
          expected: exp,
          actual: act
        });
        continue;
      }

      // Tolerance-aware comparison
      const comparison = this._compareWithTolerance(prop, exp, act, tol);
      results.push({
        property: prop,
        ...comparison
      });
    }

    // Summary
    const matched = results.filter(r => r.status === 'match').length;
    const mismatched = results.filter(r => r.status === 'mismatch').length;
    const missing = results.filter(r => r.status === 'missing').length;

    return {
      summary: {
        total: results.length,
        matched,
        mismatched,
        missing
      },
      results
    };
  },

  _compareWithTolerance(prop, expected, actual, tolerance) {
    // Color comparison
    if (this._isColorProperty(prop)) {
      return this._compareColors(expected, actual, tolerance.color);
    }

    // Numeric comparison with px tolerance
    const expNum = parseFloat(expected);
    const actNum = parseFloat(actual);

    if (!isNaN(expNum) && !isNaN(actNum)) {
      const diff = Math.abs(expNum - actNum);

      // Subpixel — negligible
      if (diff < 1) {
        return {
          status: 'match',
          expected,
          actual,
          note: 'subpixel rounding'
        };
      }

      const spacingTol = this._isSpacingProperty(prop) ? tolerance.spacing : 0;
      const radiusTol = this._isRadiusProperty(prop) ? tolerance.borderRadius : 0;
      const tol = Math.max(spacingTol, radiusTol);

      if (tol > 0 && diff <= tol) {
        return {
          status: 'match',
          expected,
          actual,
          note: `within ±${tol}px tolerance`
        };
      }

      // Classify severity
      const severity = this._classifyNumericSeverity(prop, diff);
      return { status: 'mismatch', expected, actual, severity };
    }

    // String comparison — exact mismatch
    return {
      status: 'mismatch',
      expected,
      actual,
      severity: 'major'
    };
  },

  _compareColors(expected, actual, channelTolerance) {
    const expRgb = this._parseRgb(expected);
    const actRgb = this._parseRgb(actual);

    if (!expRgb || !actRgb) {
      return {
        status: expected === actual ? 'match' : 'mismatch',
        expected,
        actual,
        severity: 'major'
      };
    }

    const dr = Math.abs(expRgb.r - actRgb.r);
    const dg = Math.abs(expRgb.g - actRgb.g);
    const db = Math.abs(expRgb.b - actRgb.b);
    const maxDiff = Math.max(dr, dg, db);

    if (maxDiff === 0) {
      return { status: 'match', expected, actual };
    }

    if (maxDiff <= channelTolerance) {
      return {
        status: 'match',
        expected,
        actual,
        note: `within ±${channelTolerance} color tolerance`
      };
    }

    return {
      status: 'mismatch',
      expected,
      actual,
      severity: maxDiff > 10 ? 'major' : 'minor'
    };
  },

  _parseRgb(value) {
    const m = value.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (!m) return null;
    return { r: parseInt(m[1]), g: parseInt(m[2]), b: parseInt(m[3]) };
  },

  _isColorProperty(prop) {
    return prop === 'color' || prop === 'background-color' ||
           (prop.includes('border') && prop.includes('color'));
  },

  _isSpacingProperty(prop) {
    return prop.startsWith('margin') || prop.startsWith('padding') ||
           prop === 'gap' || prop === 'row-gap' || prop === 'column-gap' ||
           prop === 'top' || prop === 'right' || prop === 'bottom' || prop === 'left';
  },

  _isRadiusProperty(prop) {
    return prop.includes('radius');
  },

  _classifyNumericSeverity(prop, diff) {
    if (prop === 'font-size' && diff > 2) return 'major';
    if (prop === 'font-weight') return 'major';
    if (this._isSpacingProperty(prop) && diff <= 4) return 'minor';
    if (this._isRadiusProperty(prop) && diff <= 2) return 'minor';
    return 'major';
  }
};

if (typeof window !== 'undefined') {
  window.DiffEngine = DiffEngine;
}
