/**
 * Smart Search Logic for the VS Code Bridge.
 * Ranks workspace files based on CSS selector confidence.
 */
export interface SearchMatch {
  file: string;
  score: number;
  line: number;
}

export const SearchLogic = {
  // Common utility classes to down-rank (Tailwind, Bootstrap, etc.)
  utilityPrefixes: [
    'p-', 'm-', 'w-', 'h-', 'flex', 'grid', 'text-', 'bg-', 'border-',
    'hover:', 'focus:', 'dark:', 'relative', 'absolute', 'fixed',
    'items-', 'justify-', 'gap-', 'rounded', 'shadow', 'font-',
    'sm:', 'md:', 'lg:', 'xl:', '2xl:'
  ],

  isUtility(token: string) {
    const t = token.startsWith('.') ? token.slice(1) : token;
    // Check if it starts with any utility prefix or contains one after a colon (for Tailwind variants)
    return this.utilityPrefixes.some(p => t.startsWith(p) || (t.includes(':') && this.utilityPrefixes.some(up => t.split(':').pop()!.startsWith(up))));
  },

  /**
   * Assign a confidence score to a file based on how well it matches the selector tokens.
   */
  scoreFile(filePath: string, content: string, tokens: string[], activeFile: string | null = null): SearchMatch | null {
    let score = 0;
    let bestLine = 0;
    const lines = content.split('\n');

    const ids = tokens.filter(t => t.startsWith('#'));
    const classes = tokens.filter(t => t.startsWith('.'));
    const tags = tokens.filter(t => !t.startsWith('#') && !t.startsWith('.'));

    // 1. ID Match (Highest confidence)
    for (const id of ids) {
      if (content.includes(id.slice(1))) {
        score += 100;
        bestLine = this._findLine(lines, id.slice(1));
      }
    }

    // 2. Class Match
    for (const cls of classes) {
      const className = cls.slice(1);
      if (content.includes(className)) {
        score += this.isUtility(cls) ? 10 : 30;
        if (bestLine === 0) bestLine = this._findLine(lines, className);
      }
    }

    // 3. Tag Match
    for (const tag of tags) {
      if (content.includes(`<${tag}`) || content.includes(`${tag} {`)) {
        score += 5;
      }
    }

    // 4. Contextual Bonus
    if (score > 0) {
      if (activeFile && filePath === activeFile) score += 50;
      
      // Modern framework files get higher priority
      if (filePath.endsWith('.tsx') || filePath.endsWith('.jsx')) {
        score += 15;
      } else if (filePath.endsWith('.html') || filePath.endsWith('.vue') || filePath.endsWith('.svelte')) {
        score += 10;
      }
    }

    if (score === 0) return null;

    return { file: filePath, score, line: bestLine };
  },

  _findLine(lines: string[], pattern: string): number {
    const idx = lines.findIndex(l => l.includes(pattern));
    return idx >= 0 ? idx : 0;
  }
};
