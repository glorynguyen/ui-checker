/**
 * Comparator — Utility to compare DOM computed styles with Figma design node data.
 */
export const Comparator = {
  compare(domStyles: Record<string, string>, figmaStyles: Record<string, string>) {
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
