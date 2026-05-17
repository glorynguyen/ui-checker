export interface EditableDeclaration {
  start: number;
  end: number;
  replacementPrefix: string;
  replacementSuffix: string;
}

export interface EditableClassList {
  start: number;
  end: number;
  currentValue: string;
}

export function findEditableDeclaration(text: string, sourceLine: number, cssProperty: string): EditableDeclaration | null {
  const lines = text.split(/\r?\n/);
  const startLine = Math.max(0, sourceLine - 80);
  const endLine = Math.min(lines.length - 1, sourceLine + 80);
  const offsets: number[] = [];
  let running = 0;
  for (const line of lines) {
    offsets.push(running);
    running += line.length + 1;
  }

  const cssName = escapeRegExp(cssProperty);
  const camelName = cssProperty.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  const patterns = [
    new RegExp(`(?<![a-zA-Z0-9_-])(${cssName}\\s*:\\s*)([^;,\\n}]+)([;,])`),
    new RegExp(`(?<![a-zA-Z0-9_$])(${escapeRegExp(camelName)}\\s*:\\s*['"]?)([^'",\\n}]+)(['"]?[,}])`)
  ];

  for (let lineNo = startLine; lineNo <= endLine; lineNo += 1) {
    /* c8 ignore next -- lineNo is clamped to existing split lines. */
    const line = lines[lineNo] || '';
    for (const pattern of patterns) {
      const match = pattern.exec(line);
      if (!match || match.index === undefined) continue;

      const valueStart = offsets[lineNo] + match.index + match[1].length;
      const valueEnd = valueStart + match[2].length;
      return {
        start: valueStart,
        end: valueEnd,
        replacementPrefix: '',
        replacementSuffix: ''
      };
    }
  }

  return null;
}

export function findEditableClassList(text: string, sourceLine: number, currentClassList?: string): EditableClassList | null {
  const lines = text.split(/\r?\n/);
  const startLine = Math.max(0, sourceLine - 80);
  const endLine = Math.min(lines.length - 1, sourceLine + 80);
  const offsets: number[] = [];
  let running = 0;
  for (const line of lines) {
    offsets.push(running);
    running += line.length + 1;
  }

  const currentClasses = splitClasses(currentClassList || '');
  let fallback: EditableClassList | null = null;
  let bestScore = -1;

  for (let lineNo = startLine; lineNo <= endLine; lineNo += 1) {
    const line = lines[lineNo] || '';
    for (const match of line.matchAll(/\bclass(?:Name)?\s*=\s*(["'`])([^"'`]*?)\1/g)) {
      if (match.index === undefined) continue;
      const value = match[2] || '';
      const valueStart = offsets[lineNo] + match.index + match[0].indexOf(value);
      const candidate = { start: valueStart, end: valueStart + value.length, currentValue: value };
      const score = scoreClassList(value, currentClasses);

      if (!fallback) fallback = candidate;
      if (score > bestScore) {
        bestScore = score;
        fallback = candidate;
      }
      if (currentClasses.length > 0 && score === currentClasses.length) {
        return candidate;
      }
    }
  }

  return fallback;
}

function scoreClassList(value: string, expectedClasses: string[]) {
  if (expectedClasses.length === 0) return 0;
  const found = new Set(splitClasses(value));
  return expectedClasses.filter((className) => found.has(className)).length;
}

function splitClasses(classList: string) {
  return classList.split(/\s+/).map((item) => item.trim()).filter(Boolean);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
