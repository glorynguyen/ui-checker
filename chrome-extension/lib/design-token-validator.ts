import { Normalizer } from './normalizer';

export interface DesignToken {
  name: string;
  value: string;
  normalizedValue: string;
  path: string;
  type: 'color' | 'dimension' | 'font-weight' | 'font-family' | 'unknown';
}

export interface TokenValidationResult {
  status: 'tokenized' | 'hardcoded' | 'unmapped';
  token?: DesignToken;
  suggestions: DesignToken[];
}

export interface TokenCoverageSummary {
  total: number;
  tokenized: number;
  hardcoded: number;
  unmapped: number;
  coveragePercent: number;
}

type TokenCandidate = {
  name: string;
  value: string;
  path: string;
  type?: string;
};

export const DesignTokenValidator = {
  parse(input: string | Record<string, unknown>): DesignToken[] {
    const data = typeof input === 'string' ? JSON.parse(input) : input;
    const candidates: TokenCandidate[] = [];
    this._walk(data, [], candidates);

    const seen = new Set<string>();
    const tokens: DesignToken[] = [];

    for (const candidate of candidates) {
      const value = String(candidate.value).trim();
      if (!value) continue;

      const inferredType = this._inferType(candidate.path, candidate.type, value);
      const normalizedValue = this._normalizeTokenValue(inferredType, value);
      const key = `${candidate.path}=${normalizedValue}`;
      if (seen.has(key)) continue;
      seen.add(key);

      tokens.push({
        name: candidate.name,
        value,
        normalizedValue,
        path: candidate.path,
        type: inferredType
      });
    }

    return tokens;
  },

  validateProperty(property: string, expected: string | null, tokens: DesignToken[], varName?: string): TokenValidationResult | null {
    if (!expected || tokens.length === 0) return null;

    if (varName) {
      const token = tokens.find((item) => this._tokenNameMatchesVar(item, varName));
      if (token) {
        return { status: 'tokenized', token, suggestions: [] };
      }
    }

    const normalizedExpected = Normalizer.normalizeValue(property, expected);
    if (!normalizedExpected) return null;

    const exactMatches = tokens.filter((token) => token.normalizedValue === normalizedExpected);
    if (exactMatches.length > 0) {
      return {
        status: varName ? 'tokenized' : 'hardcoded',
        token: exactMatches[0],
        suggestions: exactMatches.slice(0, 3)
      };
    }

    const suggestions = this._rankSuggestions(property, normalizedExpected, tokens);
    return {
      status: 'unmapped',
      suggestions
    };
  },

  summarizeValidations(results: Array<TokenValidationResult | null | undefined>): TokenCoverageSummary {
    const summary: TokenCoverageSummary = {
      total: 0,
      tokenized: 0,
      hardcoded: 0,
      unmapped: 0,
      coveragePercent: 0
    };

    for (const result of results) {
      if (!result) continue;
      summary.total += 1;
      summary[result.status] += 1;
    }

    summary.coveragePercent = summary.total === 0
      ? 0
      : Math.round((summary.tokenized / summary.total) * 100);

    return summary;
  },

  _walk(value: unknown, path: string[], candidates: TokenCandidate[]) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return;

    const node = value as Record<string, unknown>;
    const tokenValue = node.$value ?? node.value;

    if (typeof tokenValue === 'string' || typeof tokenValue === 'number') {
      candidates.push({
        name: path[path.length - 1] || String(tokenValue),
        value: String(tokenValue),
        path: path.join('.'),
        type: typeof node.$type === 'string' ? node.$type : typeof node.type === 'string' ? node.type : undefined
      });
      return;
    }

    for (const [key, child] of Object.entries(node)) {
      if (key.startsWith('$')) continue;

      if (typeof child === 'string' || typeof child === 'number') {
        candidates.push({
          name: key,
          value: String(child),
          path: [...path, key].join('.')
        });
      } else {
        this._walk(child, [...path, key], candidates);
      }
    }
  },

  _inferType(path: string, explicitType: string | undefined, value: string): DesignToken['type'] {
    const hint = `${explicitType || ''} ${path}`.toLowerCase();
    if (hint.includes('color') || /^#([\da-f]{3,8})$/i.test(value) || /^rgba?\(/i.test(value)) return 'color';
    if (hint.includes('font') && hint.includes('weight')) return 'font-weight';
    if (hint.includes('font') && hint.includes('family')) return 'font-family';
    if (/^-?\d+(\.\d+)?(px|rem|em|%)?$/.test(value.trim())) return 'dimension';
    return 'unknown';
  },

  _normalizeTokenValue(type: DesignToken['type'], value: string) {
    const propertyByType: Record<DesignToken['type'], string> = {
      color: 'color',
      dimension: 'width',
      'font-weight': 'font-weight',
      'font-family': 'font-family',
      unknown: 'color'
    };

    const prop = propertyByType[type];
    return Normalizer.normalizeValue(prop, value) || value.trim().toLowerCase();
  },

  _tokenNameMatchesVar(token: DesignToken, varName: string) {
    const cleanVar = varName.replace(/^--/, '').replace(/[-_]/g, '.').toLowerCase();
    const cleanToken = token.path.replace(/[-_]/g, '.').toLowerCase();
    return cleanToken === cleanVar || cleanToken.endsWith(`.${cleanVar}`);
  },

  _rankSuggestions(property: string, normalizedExpected: string, tokens: DesignToken[]) {
    if (this._isColorProperty(property)) {
      const target = this._parseRgb(normalizedExpected);
      if (!target) return [];

      return tokens
        .filter((token) => token.type === 'color')
        .map((token) => ({ token, distance: this._colorDistance(target, this._parseRgb(token.normalizedValue)) }))
        .filter((item) => item.distance !== null)
        .sort((a, b) => (a.distance as number) - (b.distance as number))
        .slice(0, 3)
        .map((item) => item.token);
    }

    const targetNum = parseFloat(normalizedExpected);
    if (!Number.isNaN(targetNum)) {
      return tokens
        .filter((token) => token.type === 'dimension' || token.type === 'font-weight')
        .map((token) => ({ token, distance: Math.abs(parseFloat(token.normalizedValue) - targetNum) }))
        .filter((item) => !Number.isNaN(item.distance))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 3)
        .map((item) => item.token);
    }

    return [];
  },

  _isColorProperty(prop: string) {
    return prop === 'color' || prop === 'background-color' ||
           (prop.includes('border') && prop.includes('color'));
  },

  _parseRgb(value: string) {
    const match = value.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (!match) return null;
    return { r: Number(match[1]), g: Number(match[2]), b: Number(match[3]) };
  },

  _colorDistance(a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number } | null) {
    if (!b) return null;
    return Math.sqrt(
      Math.pow(a.r - b.r, 2) +
      Math.pow(a.g - b.g, 2) +
      Math.pow(a.b - b.b, 2)
    );
  }
};
