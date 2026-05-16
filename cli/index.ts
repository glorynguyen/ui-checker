#!/usr/bin/env node
import { loadConfig, resolveFigmaToken } from './config';
import { writeHtmlReport, writeJsonReport, writeMarkdownReport } from './report';
import { runChecks } from './runner';

type CliArgs = {
  config: string;
  json?: string;
  markdown?: string;
  html?: string;
};

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const config = await loadConfig(args.config);
  const token = resolveFigmaToken(config);
  const report = await runChecks(config, token);

  if (args.json) await writeJsonReport(args.json, report);
  if (args.markdown) await writeMarkdownReport(args.markdown, report);
  if (args.html) await writeHtmlReport(args.html, report);

  if (!args.json && !args.markdown && !args.html) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  }

  process.exit(report.status === 'passed' ? 0 : report.status === 'failed' ? 1 : 2);
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { config: '' };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (arg === '--config') {
      args.config = requireValue(arg, next);
      index += 1;
    } else if (arg === '--json') {
      args.json = requireValue(arg, next);
      index += 1;
    } else if (arg === '--markdown') {
      args.markdown = requireValue(arg, next);
      index += 1;
    } else if (arg === '--html') {
      args.html = requireValue(arg, next);
      index += 1;
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!args.config) {
    throw new Error('Missing required --config path.');
  }

  return args;
}

function requireValue(name: string, value: string | undefined) {
  if (!value || value.startsWith('--')) {
    throw new Error(`${name} requires a value.`);
  }
  return value;
}

function printHelp() {
  process.stdout.write(`ui-checker-ci

Usage:
  ui-checker-ci --config ui-checker.config.json --json ui-checker-report.json --markdown ui-checker-report.md --html ui-checker-report.html

Options:
  --config     Path to the UI Checker CI config JSON.
  --json       Optional JSON report output path.
  --markdown   Optional Markdown report output path.
  --html       Optional HTML report output path.
`);
}

main().catch((error: any) => {
  process.stderr.write(`${error?.message || String(error)}\n`);
  process.exit(2);
});
