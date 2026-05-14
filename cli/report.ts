import { writeFile } from 'node:fs/promises';
import { UiCheckerCheckReport, UiCheckerReport } from './types';

export function buildRunReport(checks: UiCheckerCheckReport[]): UiCheckerReport {
  const passed = checks.filter((check) => check.status === 'passed').length;
  const failed = checks.filter((check) => check.status === 'failed').length;
  const errored = checks.filter((check) => check.status === 'errored').length;
  let status: UiCheckerReport['status'] = 'passed';

  if (failed > 0) {
    status = 'failed';
  }
  if (errored > 0) {
    status = 'errored';
  }

  return {
    status,
    summary: {
      total: checks.length,
      passed,
      failed,
      errored
    },
    checks
  };
}

export async function writeJsonReport(path: string, report: UiCheckerReport) {
  await writeFile(path, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

export async function writeMarkdownReport(path: string, report: UiCheckerReport) {
  await writeFile(path, renderMarkdownReport(report), 'utf8');
}

export function renderMarkdownReport(report: UiCheckerReport) {
  const lines: string[] = [];
  lines.push('## UI Checker CI Report');
  lines.push('');
  lines.push(`Status: ${report.status}`);
  lines.push('');
  lines.push('| Check | Status | Matched | Mismatched | Missing |');
  lines.push('|---|---|---:|---:|---:|');

  for (const check of report.checks) {
    const summary = check.diff
      ? check.diff.summary
      : { matched: 0, mismatched: 0, missing: 0 };
    lines.push(`| ${escapeCell(check.name)} | ${check.status} | ${summary.matched} | ${summary.mismatched} | ${summary.missing} |`);
  }

  for (const check of report.checks) {
    lines.push('');
    lines.push(`### ${check.name}`);
    lines.push('');
    lines.push(`URL: \`${check.url}\``);
    lines.push(`Selector: \`${check.selector}\``);
    lines.push(`Figma node: \`${check.figmaNodeId}\``);

    if (check.error) {
      lines.push('');
      lines.push(`Error: ${check.error}`);
      continue;
    }

    const mismatches = check.diff
      ? check.diff.results.filter((result) => result.status === 'mismatch' || result.status === 'missing')
      : [];
    if (mismatches.length === 0) {
      lines.push('');
      lines.push('No mismatches.');
      continue;
    }

    lines.push('');
    lines.push('| Property | Expected | Actual | Severity |');
    lines.push('|---|---|---|---|');
    for (const result of mismatches) {
      const expected = result.expected === null ? 'n/a' : result.expected;
      const actual = result.actual === null ? 'n/a' : result.actual;
      const severity = result.severity === undefined ? result.status : result.severity;
      lines.push(`| ${escapeCell(result.property)} | ${escapeCell(expected)} | ${escapeCell(actual)} | ${severity} |`);
    }
  }

  lines.push('');
  return lines.join('\n');
}

function escapeCell(value: string) {
  return value.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}
