import { spawnSync } from 'node:child_process';

const rawArgs = process.argv.slice(2);
const mode = ['watch', 'coverage'].includes(rawArgs[0]) ? (rawArgs.shift() as string) : 'test';

function takeOption(args: string[], name: string): string | null {
  const prefix = `${name}=`;
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === name) {
      const next = args[i + 1];
      args.splice(i, 2);
      return next;
    }
    if (arg.startsWith(prefix)) {
      args.splice(i, 1);
      return arg.slice(prefix.length);
    }
  }
  return null;
}

function takeMultiOption(args: string[], name: string): string[] {
  const values: string[] = [];
  while (true) {
    const value = takeOption(args, name);
    if (value === null) break;
    values.push(
      ...value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    );
  }
  return values;
}

function resolveOption(args: string[], cliName: string, envName: string): string | null {
  const value = takeOption(args, cliName);
  return value ?? process.env[envName] ?? null;
}

function resolveMultiOption(args: string[], cliName: string, envName: string): string[] {
  const values = takeMultiOption(args, cliName);
  if (values.length > 0) return values;
  const envValue = process.env[envName];
  if (!envValue) return [];
  return envValue
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

const include = resolveMultiOption(rawArgs, '--include', 'TEST_COVERAGE_INCLUDE');
const exclude = resolveMultiOption(rawArgs, '--exclude', 'TEST_COVERAGE_EXCLUDE');
const lines = resolveOption(rawArgs, '--lines', 'TEST_COVERAGE_LINES');
const functions = resolveOption(rawArgs, '--functions', 'TEST_COVERAGE_FUNCTIONS');
const branches = resolveOption(rawArgs, '--branches', 'TEST_COVERAGE_BRANCHES');

const args: string[] = [];

if (mode === 'coverage') {
  args.push('--experimental-test-coverage');

  const includeList = include.length > 0
    ? include
    : [
        'chrome-extension/lib/*.ts',
        'chrome-extension/content/*.ts'
      ];

  for (const pattern of includeList) {
    args.push(`--test-coverage-include=${pattern}`);
  }

  for (const pattern of exclude) {
    args.push(`--test-coverage-exclude=${pattern}`);
  }

  if (lines) args.push(`--test-coverage-lines=${lines}`);
  if (functions) args.push(`--test-coverage-functions=${functions}`);
  if (branches) args.push(`--test-coverage-branches=${branches}`);
}

if (mode === 'watch') {
  args.push('--watch');
}

const forwardedArgs = rawArgs.length > 0 ? rawArgs : ['test/*.test.ts'];

// Use tsx to run the tests
args.push('--import', 'tsx', '--test', ...forwardedArgs);

const result = spawnSync(process.execPath, args, {
  cwd: process.cwd(),
  env: process.env,
  stdio: 'inherit'
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
