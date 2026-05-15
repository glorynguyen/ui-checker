import * as path from 'path';
import type { SearchMatch } from './search-logic';

export interface ParsedSourceLoc {
  rawPath: string;
  line: number;
  column: number;
}

export function parseSourceLoc(sourceLoc: string): ParsedSourceLoc | null {
  // Format: "<rel-or-abs-path>:<line>:<col>". Path may itself contain colons
  // on Windows; line/col are always the trailing two numeric segments.
  const m = sourceLoc.match(/^(.*):(\d+):(\d+)$/);
  if (!m) return null;

  const [, rawPath, lineStr, columnStr] = m;
  const line = parseInt(lineStr, 10);
  const column = parseInt(columnStr, 10);

  if (!rawPath || !Number.isFinite(line)) return null;

  return {
    rawPath,
    line,
    column: Number.isFinite(column) ? column : 1
  };
}

export function sourceLocMatch(file: string, loc: ParsedSourceLoc): SearchMatch {
  return {
    file,
    line: Math.max(0, loc.line - 1),
    column: Math.max(0, loc.column - 1),
    score: 9999
  };
}

export function normalizeSourcePath(filePath: string): string {
  return filePath.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+$/, '');
}

export function sourceLocBasename(rawPath: string): string {
  return path.basename(normalizeSourcePath(rawPath));
}

export function findSourceLocSuffixMatch(rawPath: string, filePaths: string[]): string | null {
  const normalizedRaw = normalizeSourcePath(rawPath);
  const suffix = `/${normalizedRaw}`;

  const matches = filePaths
    .filter((filePath) => {
      const normalizedFile = normalizeSourcePath(filePath);
      return normalizedFile === normalizedRaw || normalizedFile.endsWith(suffix);
    })
    .sort((a, b) => normalizeSourcePath(a).length - normalizeSourcePath(b).length || a.localeCompare(b));

  return matches[0] ?? null;
}
