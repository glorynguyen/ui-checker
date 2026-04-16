/**
 * Comparator — Utility to compare DOM computed styles with Figma design node data.
 */
const Comparator = {
  compare(domStyles, figmaStyles) {
    const diffs = [];

    for (const prop in figmaStyles) {
      if (domStyles[prop] !== figmaStyles[prop]) {
        diffs.push({
          property: prop,
          expected: figmaStyles[prop],
          actual: domStyles[prop],
          status: 'mismatch'
        });
      }
    }

    return {
      match: diffs.length === 0,
      diffs
    };
  }
};

if (typeof window !== 'undefined') {
  window.Comparator = Comparator;
}
