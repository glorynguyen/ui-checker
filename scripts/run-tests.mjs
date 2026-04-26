import { spawnSync } from 'node:child_process';

const rawArgs = process.argv.slice(2);
const mode = ['watch', 'coverage'].includes(rawArgs[0]) ? rawArgs.shift() : 'test';

function takeOption(args, name) {
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

function takeMultiOption(args, name) {
  const values = [];
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

function resolveOption(args, cliName, envName) {
  const value = takeOption(args, cliName);
  return value ?? process.env[envName] ?? null;
}

function resolveMultiOption(args, cliName, envName) {
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

const args = [];

if (mode === 'coverage') {
  args.push('--experimental-test-coverage');

  const includeList = include.length > 0
    ? include
    : [
        'chrome-extension/lib/*.js',
        'chrome-extension/content/*.js'
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

const forwardedArgs = rawArgs.length > 0 ? rawArgs : ['test/*.test.js'];

args.push('--test', ...forwardedArgs);

const result = spawnSync(process.execPath, args, {
  cwd: process.cwd(),
  env: process.env,
  stdio: 'inherit'
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
