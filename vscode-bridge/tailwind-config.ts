import * as fs from 'fs';
import * as path from 'path';
import type { TailwindThemeConfig } from '../chrome-extension/lib/tailwind-mapper';

const CONFIG_NAMES = [
  'tailwind.config.js',
  'tailwind.config.cjs',
  'tailwind.config.mjs',
  'tailwind.config.ts'
];

const SCALE_KEYS: Array<keyof TailwindThemeConfig> = [
  'spacing',
  'colors',
  'fontSize',
  'fontWeight',
  'borderRadius',
  'lineHeight',
  'letterSpacing',
  'opacity',
  'borderWidth',
  'boxShadow'
];

export interface TailwindConfigResult {
  found: boolean;
  file?: string;
  theme: TailwindThemeConfig;
  warning?: string;
}

export function findTailwindConfig(workspaceRoots: string[]): TailwindConfigResult {
  for (const root of workspaceRoots) {
    const direct = findDirectConfig(root);
    if (direct) return readTailwindConfig(direct);

    const shallow = findShallowConfig(root);
    if (shallow) return readTailwindConfig(shallow);
  }

  return {
    found: false,
    theme: {}
  };
}

export function readTailwindConfig(file: string): TailwindConfigResult {
  try {
    const text = fs.readFileSync(file, 'utf8');
    return {
      found: true,
      file,
      theme: parseTailwindTheme(text)
    };
  } catch (error: any) {
    return {
      found: false,
      file,
      theme: {},
      warning: error?.message || 'Could not read Tailwind config.'
    };
  }
}

export function parseTailwindTheme(text: string): TailwindThemeConfig {
  const theme: TailwindThemeConfig = {};
  const themeBody = extractObjectBody(text, 'theme') || text;
  const extendBody = extractObjectBody(themeBody, 'extend') || '';
  const searchable = [themeBody, extendBody].filter(Boolean);

  for (const key of SCALE_KEYS) {
    const merged: Record<string, string> = {};
    for (const body of searchable) {
      const scaleBody = extractObjectBody(body, key);
      if (!scaleBody) continue;
      Object.assign(merged, parseScaleEntries(scaleBody));
    }
    if (Object.keys(merged).length > 0) {
      (theme as any)[key] = merged;
    }
  }

  return theme;
}

function findDirectConfig(root: string) {
  for (const name of CONFIG_NAMES) {
    const candidate = path.join(root, name);
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  return null;
}

function findShallowConfig(root: string) {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    return null;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const direct = findDirectConfig(path.join(root, entry.name));
    if (direct) return direct;
  }
  return null;
}

function extractObjectBody(text: string, key: string) {
  const re = new RegExp(`(?:^|[,{\\s])${escapeRegExp(key)}\\s*:\\s*\\{`, 'm');
  const match = re.exec(text);
  if (!match) return null;

  const openIndex = match.index + match[0].lastIndexOf('{');
  const closeIndex = findMatchingBrace(text, openIndex);
  if (closeIndex < 0) return null;
  return text.slice(openIndex + 1, closeIndex);
}

function findMatchingBrace(text: string, openIndex: number) {
  let depth = 0;
  let quote: string | null = null;
  let escaped = false;

  for (let i = openIndex; i < text.length; i += 1) {
    const char = text[i];

    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }

    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      continue;
    }

    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }

  return -1;
}

function parseScaleEntries(body: string, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  let i = 0;

  while (i < body.length) {
    const keyMatch = /(?:^|,|\n)\s*(['"]?)([A-Za-z0-9_.-]+|DEFAULT)\1\s*:/.exec(body.slice(i));
    if (!keyMatch || keyMatch.index === undefined) break;

    const keyStart = i + keyMatch.index;
    const key = keyMatch[2];
    let valueStart = keyStart + keyMatch[0].length;
    while (/\s/.test(body[valueStart] || '')) valueStart += 1;

    const fullKey = prefix ? `${prefix}-${key}` : key;
    const firstChar = body[valueStart];

    if (firstChar === '{') {
      const close = findMatchingBrace(body, valueStart);
      if (close < 0) break;
      Object.assign(out, parseScaleEntries(body.slice(valueStart + 1, close), fullKey));
      i = close + 1;
      continue;
    }

    if (firstChar === '[') {
      const firstString = body.slice(valueStart).match(/\[\s*['"`]([^'"`]+)['"`]/);
      if (firstString) out[fullKey] = firstString[1];
      i = valueStart + 1;
      continue;
    }

    const literal = readStringLiteral(body, valueStart);
    if (literal) {
      out[fullKey] = literal.value;
      i = literal.end;
      continue;
    }

    i = valueStart + 1;
  }

  return out;
}

function readStringLiteral(text: string, start: number): { value: string; end: number } | null {
  const quote = text[start];
  if (quote !== '"' && quote !== "'" && quote !== '`') return null;

  let value = '';
  let escaped = false;
  for (let i = start + 1; i < text.length; i += 1) {
    const char = text[i];
    if (escaped) {
      value += char;
      escaped = false;
      continue;
    }
    if (char === '\\') {
      escaped = true;
      continue;
    }
    if (char === quote) {
      return { value, end: i + 1 };
    }
    value += char;
  }

  return null;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
