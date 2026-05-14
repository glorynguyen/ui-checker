import { readFile } from 'node:fs/promises';
import { UiCheckerConfig, UiCheckerFailOn } from './types';

const defaultFailOn: UiCheckerFailOn = {
  major: true,
  minorCount: 0,
  missing: true
};

export async function loadConfig(path: string): Promise<UiCheckerConfig> {
  const raw = await readFile(path, 'utf8');
  let data: unknown;

  try {
    data = JSON.parse(raw);
  } catch (error: any) {
    throw new Error(`Invalid config JSON: ${error.message}`);
  }

  return validateConfig(data);
}

export function validateConfig(data: unknown): UiCheckerConfig {
  const config = asRecord(data, 'config');
  const baseUrl = requiredString(config, 'baseUrl');
  const figmaTokenEnv = stringValue(config.figmaTokenEnv, 'FIGMA_TOKEN');
  const checksRaw = config.checks;

  if (!Array.isArray(checksRaw) || checksRaw.length === 0) {
    throw new Error('Config must include at least one check.');
  }

  const checks = checksRaw.map((item, index) => {
    const check = asRecord(item, `checks[${index}]`);
    return {
      name: requiredString(check, 'name', `checks[${index}]`),
      path: requiredString(check, 'path', `checks[${index}]`),
      selector: requiredString(check, 'selector', `checks[${index}]`),
      figmaFileKey: requiredString(check, 'figmaFileKey', `checks[${index}]`),
      figmaNodeId: requiredString(check, 'figmaNodeId', `checks[${index}]`)
    };
  });

  return {
    baseUrl,
    figmaTokenEnv,
    tolerance: {
      spacing: numberValue(asRecord(config.tolerance, 'tolerance', true).spacing, 2),
      color: numberValue(asRecord(config.tolerance, 'tolerance', true).color, 5),
      borderRadius: numberValue(asRecord(config.tolerance, 'tolerance', true).borderRadius, 2)
    },
    failOn: {
      major: booleanValue(asRecord(config.failOn, 'failOn', true).major, defaultFailOn.major),
      minorCount: numberValue(asRecord(config.failOn, 'failOn', true).minorCount, defaultFailOn.minorCount),
      missing: booleanValue(asRecord(config.failOn, 'failOn', true).missing, defaultFailOn.missing)
    },
    checks
  };
}

export function resolveFigmaToken(config: UiCheckerConfig, env = process.env): string {
  const token = env[config.figmaTokenEnv];
  if (!token) {
    throw new Error(`Missing Figma token. Set ${config.figmaTokenEnv}.`);
  }
  return token;
}

function asRecord(value: unknown, label: string, optional = false): Record<string, any> {
  if (value === undefined || value === null) {
    if (optional) return {};
    throw new Error(`${label} must be an object.`);
  }
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as Record<string, any>;
}

function requiredString(record: Record<string, any>, key: string, label = 'config') {
  const value = record[key];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${label}.${key} must be a non-empty string.`);
  }
  return value.trim();
}

function stringValue(value: unknown, fallback: string) {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  return trimmed;
}

function numberValue(value: unknown, fallback: number) {
  if (value === undefined) return fallback;
  if (value === null) return fallback;
  if (value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
}

function booleanValue(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback;
}
