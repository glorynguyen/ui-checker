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
  // All prefixes end with '-' or ':' to avoid false matches
  utilityPrefixes: [
    'p-', 'px-', 'py-', 'pt-', 'pr-', 'pb-', 'pl-',
    'm-', 'mx-', 'my-', 'mt-', 'mr-', 'mb-', 'ml-',
    'w-', 'h-', 'min-w-', 'min-h-', 'max-w-', 'max-h-',
    'flex-', 'grid-', 'grid-cols-', 'grid-rows-', 'col-', 'row-',
    'text-', 'bg-', 'border-', 'border-t-', 'border-r-', 'border-b-', 'border-l-',
    'rounded-', 'shadow-', 'font-',
    'items-', 'justify-', 'gap-', 'gap-x-', 'gap-y-',
    'hover:', 'focus:', 'active:', 'disabled:', 'dark:', 'light:',
    'sm:', 'md:', 'lg:', 'xl:', '2xl:', '3xl:',
    'before:', 'after:', 'first:', 'last:', 'odd:', 'even:',
    'group-hover:', 'group-focus:', 'peer-hover:', 'peer-focus:',
    'aria-', 'data-',
    'translate-', 'rotate-', 'scale-', 'skew-',
    'transition-', 'duration-', 'ease-', 'delay-',
    'opacity-', 'z-', 'order-', 'place-', 'content-', 'self-',
    'overflow-', 'overscroll-', 'scroll-',
    'inset-', 'top-', 'right-', 'bottom-', 'left-',
    'cursor-', 'select-', 'resize-',
    'list-',
    'columns-', 'break-', 'box-',
    'aspect-', 'object-',
    'whitespace-',
    'decoration-',
    'leading-', 'tracking-',
    'indent-', 'align-',
    'fill-', 'stroke-', 'stroke-width-',
    'outline-', 'ring-', 'ring-offset-',
    'blur-', 'brightness-', 'contrast-', 'drop-shadow-', 'grayscale-', 'hue-rotate-',
    'invert-', 'saturate-', 'sepia-', 'backdrop-',
  ],

  // Exact utility class names (no prefix, complete match)
  utilityExact: new Set([
    'flex', 'grid', 'block', 'inline', 'inline-block', 'hidden',
    'table', 'table-row', 'table-cell',
    'relative', 'absolute', 'fixed', 'sticky', 'static',
    'container', 'box-border', 'box-content',
    'sr-only', 'not-sr-only',
    'antialiased', 'subpixel-antialiased',
    'invisible', 'visible',
    'pointer-events-none', 'pointer-events-auto',
    'appearance-none',
    'isolate',
    'object-contain', 'object-cover',
    'overflow-ellipsis', 'truncate',
    'content-none',
    'underline', 'overline', 'line-through', 'no-underline',
    'uppercase', 'lowercase', 'capitalize', 'normal-case',
    'italic', 'not-italic',
    'ordinal', 'slashed-zero', 'lining-nums', 'oldstyle-nums',
    'proportional-nums', 'tabular-nums', 'diagonal-fractions', 'stacked-fractions',
    'whitespace-nowrap', 'whitespace-pre', 'whitespace-pre-line', 'whitespace-pre-wrap',
  ]),

  isUtility(token: string): boolean {
    const t = token.startsWith('.') ? token.slice(1) : token;

    // Check exact matches first
    if (this.utilityExact.has(t)) return true;

    // Handle nested custom variants: custom-theme:bg-red-500
    const segments = t.split(':');
    const finalClass = segments.pop() || t;

    // A class is a utility if it starts with a prefix AND:
    // 1. It is followed by a number (e.g. p-4, m-2)
    // 2. It is followed by a square bracket (e.g. p-[10px])
    // 3. Or it is one of the variants (hover:, sm:, etc.)
    if (this.utilityPrefixes.some(p => {
      if (p.endsWith(':')) return t.startsWith(p);
      if (finalClass.startsWith(p)) {
        const after = finalClass.slice(p.length);
        return /^\d/.test(after) || after.startsWith('[');
      }
      return false;
    })) return true;

    return false;
  },

  /**
   * Assign a confidence score to a file based on how well it matches the selector tokens.
   */
  scoreFile(
    filePath: string,
    content: string,
    tokens: string[],
    activeFile: string | null = null,
    property?: string,
    value?: string,
    ancestorTokens?: string[][],
    sourceName?: string
  ): SearchMatch | null {
    const isCssFile = filePath.endsWith('.css') || filePath.endsWith('.scss') || filePath.endsWith('.less');
    const lines = content.split('\n');
    let totalScore = 0;

    const lineScores = new Array(lines.length).fill(0);
    const lineMatchCount = new Array(lines.length).fill(0);
    const lineTokens = new Array(lines.length).fill(null).map(() => new Set<string>());
    const lineHasSemanticMatch = new Array(lines.length).fill(false);

    const ids = tokens.filter(t => t.startsWith('#')).map(t => t.slice(1));
    const classes = tokens.filter(t => t.startsWith('.')).map(t => t.slice(1));
    const tags = tokens.filter(t => !t.startsWith('#') && !t.startsWith('.'));

    // ─── 1. ID Match (Highest confidence) ───
    for (const id of ids) {
      const escaped = this._escapeRegExp(id);
      let found = false;

      const cssIdRegex = new RegExp(`#${escaped}(?![a-zA-Z0-9_\\-])`);
      const jsIdRegex = new RegExp(`id\\s*[:=]\\s*["']${escaped}["']`);

      lines.forEach((line, i) => {
        let lineMatched = false;

        for (const match of line.matchAll(/id=["']([^"']*)["']/g)) {
          if (match[1].trim().split(/\s+/).includes(id)) {
            lineMatched = true;
            break;
          }
        }

        if (!lineMatched && (cssIdRegex.test(line) || jsIdRegex.test(line))) {
          lineMatched = true;
        }

        if (lineMatched) {
          lineScores[i] += 100;
          lineMatchCount[i]++;
          lineTokens[i].add(`#${id}`);
          lineHasSemanticMatch[i] = true;
          found = true;
        }
      });

      if (found) totalScore += 100;
    }

    // ─── 2. Class Match ───
    for (const cls of classes) {
      const isUtil = this.isUtility('.' + cls);
      const weight = isUtil ? 10 : 30;
      const escaped = this._escapeRegExp(cls);

      const cssClassRegex = new RegExp(`\\.${escaped}(?![a-zA-Z0-9_\\-:])`);
      const wordRegex = new RegExp(`(?<![a-zA-Z0-9_\\-:])${escaped}(?![a-zA-Z0-9_\\-:])`);

      if (wordRegex.test(content) || cssClassRegex.test(content)) {
        totalScore += weight;
        
        lines.forEach((line, i) => {
          let lineMatched = false;

          for (const match of line.matchAll(/class(?:Name)?=["']([^"']*)["']/g)) {
            if (match[1].split(/\s+/).includes(cls)) {
              lineMatched = true;
              break;
            }
          }

          if (!lineMatched && (cssClassRegex.test(line) || wordRegex.test(line))) {
            lineMatched = true;
          }

          if (lineMatched) {
            lineScores[i] += weight;
            lineMatchCount[i]++;
            lineTokens[i].add(`.${cls}`);
            if (!isUtil) lineHasSemanticMatch[i] = true;
          }
        });
      }
    }

    // ─── 3. Tag Match ───
    for (const tag of tags) {
      const escaped = this._escapeRegExp(tag);
      const htmlTagRegex = new RegExp(`<\\/?${escaped}(?=[\\s/>])`);
      const cssTagRegex = isCssFile ? new RegExp(`(^|[\\s,>+~])${escaped}([\\s,.:{]|$)`) : null;
      
      let found = false;

      lines.forEach((line, i) => {
        if (htmlTagRegex.test(line) || (cssTagRegex && cssTagRegex.test(line))) {
          lineScores[i] += 5;
          lineMatchCount[i]++;
          lineTokens[i].add(tag);
          found = true;
        }
      });

      if (found) totalScore += 5;
    }

    // ─── 4. Property/Value Match (Deep Visual Context) ───
    let propertyFileBonus = 0;

    if (property) {
      const propEscaped = this._escapeRegExp(property);
      const valEscaped = value ? this._escapeRegExp(value) : null;

      const kvRegex = valEscaped
        ? new RegExp(`${propEscaped}\\s*[:=]\\s*["'\\{\\(]*${valEscaped}(?![a-zA-Z0-9_\\-])`, 'i')
        : null;
      const kRegex = !valEscaped
        ? new RegExp(`${propEscaped}\\s*[:=]`, 'i')
        : null;

      lines.forEach((line, i) => {
        let propMatch = false;

        if (kvRegex && kvRegex.test(line)) propMatch = true;
        else if (kRegex && kRegex.test(line)) propMatch = true;

        if (propMatch) {
          if (lineMatchCount[i] > 0) {
            lineScores[i] += 50;
          } else {
            lineScores[i] += 20;
          }
          propertyFileBonus = 10;
        }
      });
    }

    totalScore += propertyFileBonus;

    // ─── 5. Co-occurrence Bonus ───
    for (let i = 0; i < lines.length; i++) {
      const tokenCount = lineTokens[i].size;
      if (tokenCount > 1 && lineHasSemanticMatch[i]) {
        const coOccurBonus = (tokenCount - 1) * 25;
        lineScores[i] += coOccurBonus;
        totalScore += coOccurBonus;
      }
    }

    // ─── 5b. Ancestor Disambiguation Bonus ───
    if (totalScore > 0 && ancestorTokens && ancestorTokens.length > 0) {
      let ancestorHits = 0;
      for (const ancTokens of ancestorTokens) {
        ancestorHits += this._scoreAncestor(content, ancTokens, isCssFile);
      }
      totalScore += ancestorHits;
    }

    // ─── 5c. Component Name Hint (from data-uic-name) ───
    // Used as a fallback when the exact data-uic-loc path didn't resolve.
    if (totalScore > 0 && sourceName && /^[A-Za-z_$][\w$]*$/.test(sourceName)) {
      const escaped = this._escapeRegExp(sourceName);
      const declRegex = new RegExp(
        `(?:function\\s+${escaped}\\b|class\\s+${escaped}\\b|const\\s+${escaped}\\s*=|export\\s+default\\s+(?:function\\s+)?${escaped}\\b)`
      );
      lines.forEach((line, i) => {
        if (declRegex.test(line)) {
          lineScores[i] += 60;
          lineMatchCount[i]++;
          totalScore += 60;
        }
      });
    }

    // ─── 6. Contextual Bonus ───
    if (totalScore > 0) {
      if (activeFile && filePath === activeFile) {
        totalScore += 50;
      }

      const baseScore = totalScore;
      if (filePath.endsWith('.tsx') || filePath.endsWith('.jsx')) {
        totalScore += Math.min(baseScore * 0.2, 15);
      } else if (
        filePath.endsWith('.html') ||
        filePath.endsWith('.vue') ||
        filePath.endsWith('.svelte') ||
        filePath.endsWith('.astro')
      ) {
        totalScore += Math.min(baseScore * 0.15, 10);
      } else if (isCssFile) {
        totalScore += Math.min(baseScore * 0.1, 8);
      }
    }

    if (totalScore === 0) return null;

    // ─── 7. Find the Best Line ───
    let bestLineIdx = -1;
    let maxLineScore = -1;

    for (let i = 0; i < lineScores.length; i++) {
      let effectiveLineScore = lineScores[i];
      if (lineMatchCount[i] > 1) {
        effectiveLineScore += lineMatchCount[i] * 20;
      }

      if (lineMatchCount[i] > 0) {
        for (let j = Math.max(0, i - 3); j <= Math.min(lines.length - 1, i + 3); j++) {
          if (j !== i && lineMatchCount[j] > 0) {
            effectiveLineScore += 5; 
          }
        }
      }

      if (effectiveLineScore > maxLineScore) {
        maxLineScore = effectiveLineScore;
        bestLineIdx = i;
      }
    }

    if (bestLineIdx === -1) {
      bestLineIdx = lineMatchCount.findIndex(c => c > 0);
      if (bestLineIdx === -1) bestLineIdx = 0;
    }

    return { file: filePath, score: Math.round(totalScore), line: bestLineIdx };
  },

  _escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  },

  _scoreAncestor(content: string, ancestorTokens: string[], isCssFile: boolean): number {
    let score = 0;
    for (const tok of ancestorTokens) {
      if (tok.startsWith('#')) {
        const id = this._escapeRegExp(tok.slice(1));
        const re = new RegExp(`(?:#${id}(?![a-zA-Z0-9_\\-])|id\\s*[:=]\\s*["']${id}["'])`);
        if (re.test(content)) score += 15;
      } else if (tok.startsWith('.')) {
        if (this.isUtility(tok)) continue;
        const cls = this._escapeRegExp(tok.slice(1));
        const re = new RegExp(`(?:\\.${cls}(?![a-zA-Z0-9_\\-])|(^|["'\\s])${cls}(?![a-zA-Z0-9_\\-]))`);
        if (re.test(content)) score += 10;
      } else {
        // Tag ancestor
        const escaped = this._escapeRegExp(tok);
        const htmlRe = new RegExp(`<\\/?${escaped}(?=[\\s/>])`);
        const cssRe = isCssFile ? new RegExp(`(^|[\\s,>+~])${escaped}([\\s,.:{]|$)`) : null;
        if (htmlRe.test(content) || (cssRe && cssRe.test(content))) {
          score += 5;
        }
      }
    }
    return Math.min(score, 20); // Cap per ancestor
  },

  _fileMentionsAncestor(content: string, ancestorTokens: string[]): boolean {
    return this._scoreAncestor(content, ancestorTokens, false) > 0;
  },

  _findLine(lines: string[], pattern: string): number {
    const idx = lines.findIndex(l => l.includes(pattern));
    return idx >= 0 ? idx : 0;
  }
};