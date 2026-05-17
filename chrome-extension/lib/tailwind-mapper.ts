export type TailwindMode = 'off' | 'strict' | 'nearest';

export interface TailwindThemeConfig {
  spacing?: Record<string, string>;
  colors?: Record<string, string>;
  fontSize?: Record<string, string>;
  fontWeight?: Record<string, string>;
  borderRadius?: Record<string, string>;
  lineHeight?: Record<string, string>;
  letterSpacing?: Record<string, string>;
  opacity?: Record<string, string>;
  borderWidth?: Record<string, string>;
  boxShadow?: Record<string, string>;
}

export interface TailwindSuggestion {
  property: string;
  value: string;
  className: string;
  confidence: 'exact' | 'nearest' | 'arbitrary';
  distance: number;
  distanceLabel: string;
  source: 'project' | 'default' | 'arbitrary';
  family: string;
  reason: string;
}

export interface TailwindClassPatch {
  remove: string[];
  add: string[];
  before: string;
  after: string;
}

interface UtilityTarget {
  family: string;
  prefix: string;
  scale: keyof TailwindThemeConfig;
  type: 'length' | 'color' | 'number' | 'shadow';
  arbitrary?: (value: string) => string | null;
}

const DEFAULT_SPACING: Record<string, string> = {
  '0': '0px',
  px: '1px',
  '0.5': '0.125rem',
  '1': '0.25rem',
  '1.5': '0.375rem',
  '2': '0.5rem',
  '2.5': '0.625rem',
  '3': '0.75rem',
  '3.5': '0.875rem',
  '4': '1rem',
  '5': '1.25rem',
  '6': '1.5rem',
  '7': '1.75rem',
  '8': '2rem',
  '9': '2.25rem',
  '10': '2.5rem',
  '11': '2.75rem',
  '12': '3rem',
  '14': '3.5rem',
  '16': '4rem',
  '20': '5rem',
  '24': '6rem',
  '28': '7rem',
  '32': '8rem',
  '36': '9rem',
  '40': '10rem',
  '44': '11rem',
  '48': '12rem',
  '52': '13rem',
  '56': '14rem',
  '60': '15rem',
  '64': '16rem',
  '72': '18rem',
  '80': '20rem',
  '96': '24rem'
};

const DEFAULT_COLORS: Record<string, string> = {
  black: '#000000',
  white: '#ffffff',
  transparent: 'transparent',
  'slate-50': '#f8fafc',
  'slate-100': '#f1f5f9',
  'slate-200': '#e2e8f0',
  'slate-300': '#cbd5e1',
  'slate-400': '#94a3b8',
  'slate-500': '#64748b',
  'slate-600': '#475569',
  'slate-700': '#334155',
  'slate-800': '#1e293b',
  'slate-900': '#0f172a',
  'gray-50': '#f9fafb',
  'gray-100': '#f3f4f6',
  'gray-200': '#e5e7eb',
  'gray-300': '#d1d5db',
  'gray-400': '#9ca3af',
  'gray-500': '#6b7280',
  'gray-600': '#4b5563',
  'gray-700': '#374151',
  'gray-800': '#1f2937',
  'gray-900': '#111827',
  'red-500': '#ef4444',
  'red-600': '#dc2626',
  'orange-500': '#f97316',
  'amber-500': '#f59e0b',
  'yellow-500': '#eab308',
  'green-500': '#22c55e',
  'green-600': '#16a34a',
  'emerald-500': '#10b981',
  'teal-500': '#14b8a6',
  'cyan-500': '#06b6d4',
  'sky-500': '#0ea5e9',
  'blue-500': '#3b82f6',
  'blue-600': '#2563eb',
  'blue-700': '#1d4ed8',
  'indigo-500': '#6366f1',
  'violet-500': '#8b5cf6',
  'purple-500': '#a855f7',
  'fuchsia-500': '#d946ef',
  'pink-500': '#ec4899',
  'rose-500': '#f43f5e'
};

const DEFAULT_FONT_SIZE: Record<string, string> = {
  xs: '0.75rem',
  sm: '0.875rem',
  base: '1rem',
  lg: '1.125rem',
  xl: '1.25rem',
  '2xl': '1.5rem',
  '3xl': '1.875rem',
  '4xl': '2.25rem',
  '5xl': '3rem',
  '6xl': '3.75rem',
  '7xl': '4.5rem',
  '8xl': '6rem',
  '9xl': '8rem'
};

const DEFAULT_THEME: Required<TailwindThemeConfig> = {
  spacing: DEFAULT_SPACING,
  colors: DEFAULT_COLORS,
  fontSize: DEFAULT_FONT_SIZE,
  fontWeight: {
    thin: '100',
    extralight: '200',
    light: '300',
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    extrabold: '800',
    black: '900'
  },
  borderRadius: {
    none: '0px',
    sm: '0.125rem',
    DEFAULT: '0.25rem',
    md: '0.375rem',
    lg: '0.5rem',
    xl: '0.75rem',
    '2xl': '1rem',
    '3xl': '1.5rem',
    full: '9999px'
  },
  lineHeight: {
    none: '1',
    tight: '1.25',
    snug: '1.375',
    normal: '1.5',
    relaxed: '1.625',
    loose: '2',
    '3': '0.75rem',
    '4': '1rem',
    '5': '1.25rem',
    '6': '1.5rem',
    '7': '1.75rem',
    '8': '2rem',
    '9': '2.25rem',
    '10': '2.5rem'
  },
  letterSpacing: {
    tighter: '-0.05em',
    tight: '-0.025em',
    normal: '0em',
    wide: '0.025em',
    wider: '0.05em',
    widest: '0.1em'
  },
  opacity: {
    '0': '0',
    '5': '0.05',
    '10': '0.1',
    '20': '0.2',
    '25': '0.25',
    '30': '0.3',
    '40': '0.4',
    '50': '0.5',
    '60': '0.6',
    '70': '0.7',
    '75': '0.75',
    '80': '0.8',
    '90': '0.9',
    '95': '0.95',
    '100': '1'
  },
  borderWidth: {
    DEFAULT: '1px',
    '0': '0px',
    '2': '2px',
    '4': '4px',
    '8': '8px'
  },
  boxShadow: {
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    DEFAULT: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
    none: 'none'
  }
};

const TARGETS: Record<string, UtilityTarget> = {
  'padding-top': { family: 'padding-top', prefix: 'pt', scale: 'spacing', type: 'length', arbitrary: arbitraryLength('pt') },
  'padding-right': { family: 'padding-right', prefix: 'pr', scale: 'spacing', type: 'length', arbitrary: arbitraryLength('pr') },
  'padding-bottom': { family: 'padding-bottom', prefix: 'pb', scale: 'spacing', type: 'length', arbitrary: arbitraryLength('pb') },
  'padding-left': { family: 'padding-left', prefix: 'pl', scale: 'spacing', type: 'length', arbitrary: arbitraryLength('pl') },
  'margin-top': { family: 'margin-top', prefix: 'mt', scale: 'spacing', type: 'length', arbitrary: arbitraryLength('mt') },
  'margin-right': { family: 'margin-right', prefix: 'mr', scale: 'spacing', type: 'length', arbitrary: arbitraryLength('mr') },
  'margin-bottom': { family: 'margin-bottom', prefix: 'mb', scale: 'spacing', type: 'length', arbitrary: arbitraryLength('mb') },
  'margin-left': { family: 'margin-left', prefix: 'ml', scale: 'spacing', type: 'length', arbitrary: arbitraryLength('ml') },
  gap: { family: 'gap', prefix: 'gap', scale: 'spacing', type: 'length', arbitrary: arbitraryLength('gap') },
  'row-gap': { family: 'row-gap', prefix: 'gap-y', scale: 'spacing', type: 'length', arbitrary: arbitraryLength('gap-y') },
  'column-gap': { family: 'column-gap', prefix: 'gap-x', scale: 'spacing', type: 'length', arbitrary: arbitraryLength('gap-x') },
  width: { family: 'width', prefix: 'w', scale: 'spacing', type: 'length', arbitrary: arbitraryLength('w') },
  height: { family: 'height', prefix: 'h', scale: 'spacing', type: 'length', arbitrary: arbitraryLength('h') },
  'min-width': { family: 'min-width', prefix: 'min-w', scale: 'spacing', type: 'length', arbitrary: arbitraryLength('min-w') },
  'max-width': { family: 'max-width', prefix: 'max-w', scale: 'spacing', type: 'length', arbitrary: arbitraryLength('max-w') },
  'min-height': { family: 'min-height', prefix: 'min-h', scale: 'spacing', type: 'length', arbitrary: arbitraryLength('min-h') },
  'max-height': { family: 'max-height', prefix: 'max-h', scale: 'spacing', type: 'length', arbitrary: arbitraryLength('max-h') },
  top: { family: 'top', prefix: 'top', scale: 'spacing', type: 'length', arbitrary: arbitraryLength('top') },
  right: { family: 'right', prefix: 'right', scale: 'spacing', type: 'length', arbitrary: arbitraryLength('right') },
  bottom: { family: 'bottom', prefix: 'bottom', scale: 'spacing', type: 'length', arbitrary: arbitraryLength('bottom') },
  left: { family: 'left', prefix: 'left', scale: 'spacing', type: 'length', arbitrary: arbitraryLength('left') },
  'font-size': { family: 'font-size', prefix: 'text', scale: 'fontSize', type: 'length', arbitrary: arbitraryLength('text') },
  'font-weight': { family: 'font-weight', prefix: 'font', scale: 'fontWeight', type: 'number' },
  'line-height': { family: 'line-height', prefix: 'leading', scale: 'lineHeight', type: 'length', arbitrary: arbitraryLength('leading') },
  'letter-spacing': { family: 'letter-spacing', prefix: 'tracking', scale: 'letterSpacing', type: 'length', arbitrary: arbitraryLength('tracking') },
  'border-top-left-radius': { family: 'radius-tl', prefix: 'rounded-tl', scale: 'borderRadius', type: 'length', arbitrary: arbitraryLength('rounded-tl') },
  'border-top-right-radius': { family: 'radius-tr', prefix: 'rounded-tr', scale: 'borderRadius', type: 'length', arbitrary: arbitraryLength('rounded-tr') },
  'border-bottom-right-radius': { family: 'radius-br', prefix: 'rounded-br', scale: 'borderRadius', type: 'length', arbitrary: arbitraryLength('rounded-br') },
  'border-bottom-left-radius': { family: 'radius-bl', prefix: 'rounded-bl', scale: 'borderRadius', type: 'length', arbitrary: arbitraryLength('rounded-bl') },
  color: { family: 'text-color', prefix: 'text', scale: 'colors', type: 'color', arbitrary: arbitraryColor('text') },
  'background-color': { family: 'background-color', prefix: 'bg', scale: 'colors', type: 'color', arbitrary: arbitraryColor('bg') },
  'border-top-color': { family: 'border-color', prefix: 'border', scale: 'colors', type: 'color', arbitrary: arbitraryColor('border') },
  'border-right-color': { family: 'border-color', prefix: 'border', scale: 'colors', type: 'color', arbitrary: arbitraryColor('border') },
  'border-bottom-color': { family: 'border-color', prefix: 'border', scale: 'colors', type: 'color', arbitrary: arbitraryColor('border') },
  'border-left-color': { family: 'border-color', prefix: 'border', scale: 'colors', type: 'color', arbitrary: arbitraryColor('border') },
  'border-top-width': { family: 'border-top-width', prefix: 'border-t', scale: 'borderWidth', type: 'length', arbitrary: arbitraryLength('border-t') },
  'border-right-width': { family: 'border-right-width', prefix: 'border-r', scale: 'borderWidth', type: 'length', arbitrary: arbitraryLength('border-r') },
  'border-bottom-width': { family: 'border-bottom-width', prefix: 'border-b', scale: 'borderWidth', type: 'length', arbitrary: arbitraryLength('border-b') },
  'border-left-width': { family: 'border-left-width', prefix: 'border-l', scale: 'borderWidth', type: 'length', arbitrary: arbitraryLength('border-l') },
  opacity: { family: 'opacity', prefix: 'opacity', scale: 'opacity', type: 'number' },
  'box-shadow': { family: 'shadow', prefix: 'shadow', scale: 'boxShadow', type: 'shadow' }
};

const STATIC_UTILITIES: Record<string, Record<string, string>> = {
  display: {
    block: 'block',
    'inline-block': 'inline-block',
    inline: 'inline',
    flex: 'flex',
    'inline-flex': 'inline-flex',
    grid: 'grid',
    hidden: 'hidden'
  },
  position: {
    static: 'static',
    fixed: 'fixed',
    absolute: 'absolute',
    relative: 'relative',
    sticky: 'sticky'
  },
  'flex-direction': {
    row: 'flex-row',
    'row-reverse': 'flex-row-reverse',
    column: 'flex-col',
    'column-reverse': 'flex-col-reverse'
  },
  'align-items': {
    'flex-start': 'items-start',
    center: 'items-center',
    'flex-end': 'items-end',
    stretch: 'items-stretch',
    baseline: 'items-baseline'
  },
  'justify-content': {
    'flex-start': 'justify-start',
    center: 'justify-center',
    'flex-end': 'justify-end',
    'space-between': 'justify-between',
    'space-around': 'justify-around',
    'space-evenly': 'justify-evenly'
  },
  'flex-wrap': {
    nowrap: 'flex-nowrap',
    wrap: 'flex-wrap',
    'wrap-reverse': 'flex-wrap-reverse'
  },
  overflow: {
    visible: 'overflow-visible',
    hidden: 'overflow-hidden',
    scroll: 'overflow-scroll',
    auto: 'overflow-auto'
  },
  'text-align': {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
    justify: 'text-justify'
  },
  'text-transform': {
    uppercase: 'uppercase',
    lowercase: 'lowercase',
    capitalize: 'capitalize',
    none: 'normal-case'
  },
  'text-decoration': {
    underline: 'underline',
    'line-through': 'line-through',
    none: 'no-underline'
  }
};

export const TailwindMapper = {
  defaultTheme: DEFAULT_THEME,

  mergeTheme(projectTheme: TailwindThemeConfig | null | undefined): Required<TailwindThemeConfig> {
    const theme: Required<TailwindThemeConfig> = { ...DEFAULT_THEME };
    for (const key of Object.keys(DEFAULT_THEME) as Array<keyof TailwindThemeConfig>) {
      theme[key] = { ...(DEFAULT_THEME[key] || {}), ...((projectTheme?.[key] as Record<string, string>) || {}) } as any;
    }
    return theme;
  },

  suggest(property: string, value: string | null | undefined, options: {
    mode?: TailwindMode;
    projectTheme?: TailwindThemeConfig | null;
    rootFontSize?: number;
    maxLengthDistance?: number;
    maxColorDistance?: number;
  } = {}): TailwindSuggestion | null {
    const mode = options.mode ?? 'nearest';
    if (mode === 'off' || value === null || value === undefined) return null;

    const normalizedValue = String(value).trim().toLowerCase();
    if (!normalizedValue || normalizedValue === 'n/a') return null;

    const staticUtility = STATIC_UTILITIES[property]?.[normalizedValue];
    if (staticUtility) {
      return {
        property,
        value: normalizedValue,
        className: staticUtility,
        confidence: 'exact',
        distance: 0,
        distanceLabel: 'exact utility',
        source: 'default',
        family: property,
        reason: `${property} maps directly to ${staticUtility}`
      };
    }

    const target = TARGETS[property];
    if (!target) return null;

    const theme = this.mergeTheme(options.projectTheme);
    const scale = theme[target.scale] || {};
    const match = findBestScaleMatch(
      normalizedValue,
      scale,
      target.type,
      options.rootFontSize ?? 16
    );

    const maxLengthDistance = options.maxLengthDistance ?? 4;
    const maxColorDistance = options.maxColorDistance ?? 36;
    const maxDistance = target.type === 'color' ? maxColorDistance : maxLengthDistance;

    if (match && (match.distance === 0 || (mode === 'nearest' && match.distance <= maxDistance))) {
      const className = classFromPrefix(target.prefix, match.key);
      return {
        property,
        value: normalizedValue,
        className,
        confidence: match.distance === 0 ? 'exact' : 'nearest',
        distance: match.distance,
        distanceLabel: formatDistance(match.distance, target.type),
        source: projectDefinesScaleValue(options.projectTheme, target.scale, match.key) ? 'project' : 'default',
        family: target.family,
        reason: match.distance === 0
          ? `${normalizedValue} exactly matches ${className}`
          : `${className} is the nearest ${target.scale} value`
      };
    }

    if (mode === 'nearest' && target.arbitrary) {
      const arbitraryClass = target.arbitrary(normalizedValue);
      if (arbitraryClass) {
        return {
          property,
          value: normalizedValue,
          className: arbitraryClass,
          confidence: 'arbitrary',
          distance: Number.POSITIVE_INFINITY,
          distanceLabel: 'arbitrary value',
          source: 'arbitrary',
          family: target.family,
          reason: `No close scale match; use an arbitrary Tailwind value`
        };
      }
    }

    return null;
  },

  buildClassPatch(currentClassList: string | null | undefined, suggestion: TailwindSuggestion, projectTheme?: TailwindThemeConfig | null): TailwindClassPatch {
    const classes = splitClasses(currentClassList || '');
    const theme = this.mergeTheme(projectTheme);
    const remove = classes.filter((className) => classConflicts(className, suggestion, theme));
    const kept = classes.filter((className) => !remove.includes(className));
    if (!kept.includes(suggestion.className)) {
      kept.push(suggestion.className);
    }
    return {
      remove,
      add: kept.includes(suggestion.className) && classes.includes(suggestion.className) ? [] : [suggestion.className],
      before: classes.join(' '),
      after: kept.join(' ')
    };
  }
};

function findBestScaleMatch(value: string, scale: Record<string, string>, type: UtilityTarget['type'], rootFontSize: number) {
  let best: { key: string; distance: number } | null = null;
  for (const [key, rawScaleValue] of Object.entries(scale)) {
    const distance = valueDistance(value, rawScaleValue, type, rootFontSize);
    if (distance === null) continue;
    if (!best || distance < best.distance) {
      best = { key, distance };
    }
  }
  return best;
}

function valueDistance(a: string, b: string, type: UtilityTarget['type'], rootFontSize: number): number | null {
  if (type === 'color') {
    const ca = parseColor(a);
    const cb = parseColor(b);
    if (!ca || !cb) return a === b ? 0 : null;
    return Math.abs(ca.r - cb.r) + Math.abs(ca.g - cb.g) + Math.abs(ca.b - cb.b);
  }

  if (type === 'shadow') {
    return normalizeShadow(a) === normalizeShadow(b) ? 0 : null;
  }

  const na = type === 'number' ? parseFloat(a) : lengthToPx(a, rootFontSize);
  const nb = type === 'number' ? parseFloat(b) : lengthToPx(b, rootFontSize);
  if (!Number.isFinite(na) || !Number.isFinite(nb)) return a === b ? 0 : null;
  return Math.abs(na - nb);
}

function lengthToPx(value: string, rootFontSize: number): number {
  const trimmed = value.trim().toLowerCase();
  if (trimmed === '0') return 0;
  const match = trimmed.match(/^(-?\d+(?:\.\d+)?)(px|rem|em)?$/);
  if (!match) return Number.NaN;
  const numeric = parseFloat(match[1]);
  const unit = match[2] || 'px';
  if (unit === 'px') return numeric;
  if (unit === 'rem' || unit === 'em') return numeric * rootFontSize;
  return Number.NaN;
}

function parseColor(value: string) {
  const v = value.trim().toLowerCase();
  const hex = v.match(/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/);
  if (hex) {
    let h = hex[1];
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16)
    };
  }

  const rgb = v.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (rgb) {
    return { r: parseInt(rgb[1]), g: parseInt(rgb[2]), b: parseInt(rgb[3]) };
  }

  return null;
}

function classFromPrefix(prefix: string, key: string) {
  if (key === 'DEFAULT') return prefix;
  return `${prefix}-${key}`;
}

function formatDistance(distance: number, type: UtilityTarget['type']) {
  if (distance === 0) return 'exact';
  if (type === 'color') return `${distance} rgb total`;
  if (type === 'number') return `${trimNumber(distance)}`;
  if (type === 'shadow') return 'exact shadow';
  return `${trimNumber(distance)}px off`;
}

function trimNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, '');
}

function projectDefinesScaleValue(theme: TailwindThemeConfig | null | undefined, scale: keyof TailwindThemeConfig, key: string) {
  return Boolean(theme?.[scale] && Object.prototype.hasOwnProperty.call(theme[scale], key));
}

function arbitraryLength(prefix: string) {
  return (value: string) => {
    if (/^-?\d+(\.\d+)?(px|rem|em|%)?$/.test(value) || value === 'auto') {
      return `${prefix}-[${value}]`;
    }
    return null;
  };
}

function arbitraryColor(prefix: string) {
  return (value: string) => {
    const color = parseColor(value);
    if (!color) return null;
    const hex = `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`;
    return `${prefix}-[${hex}]`;
  };
}

function toHex(value: number) {
  return Math.max(0, Math.min(255, value)).toString(16).padStart(2, '0');
}

function normalizeShadow(value: string) {
  return value.replace(/\s+/g, ' ').replace(/,\s+/g, ',').trim().toLowerCase();
}

function splitClasses(classList: string) {
  return classList.split(/\s+/).map((item) => item.trim()).filter(Boolean);
}

function classConflicts(className: string, suggestion: TailwindSuggestion, theme: Required<TailwindThemeConfig>) {
  if (className === suggestion.className) return true;
  const base = className.split(':').pop() || className;
  const target = TARGETS[suggestion.property];

  if (target) {
    if (target.scale === 'colors') {
      return isColorUtility(base, target.prefix, theme.colors);
    }
    if (target.scale === 'fontSize') {
      return isScaleUtility(base, target.prefix, theme.fontSize);
    }
    return base.startsWith(`${target.prefix}-`) || base === target.prefix;
  }

  const staticValues = STATIC_UTILITIES[suggestion.property];
  if (!staticValues) return false;
  return Object.values(staticValues).includes(base);
}

function isScaleUtility(base: string, prefix: string, scale: Record<string, string>) {
  if (base === prefix && Object.prototype.hasOwnProperty.call(scale, 'DEFAULT')) return true;
  if (!base.startsWith(`${prefix}-`)) return false;
  const suffix = base.slice(prefix.length + 1);
  return suffix.startsWith('[') || Object.prototype.hasOwnProperty.call(scale, suffix);
}

function isColorUtility(base: string, prefix: string, colors: Record<string, string>) {
  if (!base.startsWith(`${prefix}-`)) return false;
  const suffix = base.slice(prefix.length + 1);
  return suffix.startsWith('[') || Object.prototype.hasOwnProperty.call(colors, suffix);
}
