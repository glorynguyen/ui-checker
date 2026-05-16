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

export async function writeHtmlReport(path: string, report: UiCheckerReport) {
  await writeFile(path, renderHtmlReport(report), 'utf8');
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

export function renderHtmlReport(report: UiCheckerReport) {
  const checks = report.checks.map((check) => {
    const summary = check.diff
      ? check.diff.summary
      : { matched: 0, mismatched: 0, missing: 0 };
    const mismatches = check.diff
      ? check.diff.results.filter((result) => result.status === 'mismatch' || result.status === 'missing')
      : [];

    return `
      <section class="check ${escapeHtml(check.status)}">
        <header>
          <div>
            <h2>${escapeHtml(check.name)}</h2>
            <p><code>${escapeHtml(check.selector)}</code> -> <code>${escapeHtml(check.figmaNodeId)}</code></p>
          </div>
          <span class="badge">${escapeHtml(check.status)}</span>
        </header>
        <div class="stats">
          <span><strong>${summary.matched}</strong> matched</span>
          <span><strong>${summary.mismatched}</strong> mismatched</span>
          <span><strong>${summary.missing}</strong> missing</span>
        </div>
        ${check.error ? `<p class="error">${escapeHtml(check.error)}</p>` : renderMismatchTable(mismatches)}
      </section>
    `;
  }).join('\n');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>UI Checker CI Report</title>
  <style>
    body { margin: 0; padding: 32px; font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #14161a; color: #e7ebf2; }
    main { max-width: 1120px; margin: 0 auto; }
    h1 { margin: 0 0 8px; font-size: 28px; }
    h2 { margin: 0; font-size: 16px; }
    code { color: #8ed4ff; }
    .summary, .check { border: 1px solid #303744; border-radius: 8px; background: #1d2027; padding: 18px; margin-bottom: 16px; }
    .summary-grid, .stats { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 14px; }
    .summary-grid span, .stats span { border: 1px solid #303744; border-radius: 8px; padding: 10px 12px; color: #aab4c3; }
    strong { color: #ffffff; }
    header { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; }
    .badge { border-radius: 999px; padding: 5px 10px; font-size: 11px; font-weight: 700; text-transform: uppercase; background: #303744; }
    .passed .badge { color: #3ccf91; background: rgba(60,207,145,.12); }
    .failed .badge { color: #ff6b81; background: rgba(255,107,129,.12); }
    .errored .badge { color: #ffca62; background: rgba(255,202,98,.12); }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; overflow: hidden; border-radius: 8px; }
    th, td { border-bottom: 1px solid #303744; padding: 10px; text-align: left; vertical-align: top; }
    th { color: #aab4c3; font-size: 12px; text-transform: uppercase; letter-spacing: .08em; }
    td { font-family: "SFMono-Regular", Consolas, monospace; font-size: 12px; }
    .error { color: #ffca62; }
    .empty { color: #3ccf91; }
  </style>
</head>
<body>
  <main>
    <section class="summary">
      <h1>UI Checker CI Report</h1>
      <p>Status: <strong>${escapeHtml(report.status)}</strong></p>
      <div class="summary-grid">
        <span><strong>${report.summary.total}</strong> total</span>
        <span><strong>${report.summary.passed}</strong> passed</span>
        <span><strong>${report.summary.failed}</strong> failed</span>
        <span><strong>${report.summary.errored}</strong> errored</span>
      </div>
    </section>
    ${checks}
  </main>
</body>
</html>
`;
}

function renderMismatchTable(results: NonNullable<UiCheckerCheckReport['diff']>['results']) {
  if (results.length === 0) {
    return '<p class="empty">No mismatches.</p>';
  }

  const rows = results.map((result) => `
    <tr>
      <td>${escapeHtml(result.property)}</td>
      <td>${escapeHtml(result.expected === null ? 'n/a' : result.expected)}</td>
      <td>${escapeHtml(result.actual === null ? 'n/a' : result.actual)}</td>
      <td>${escapeHtml(result.severity || result.status)}</td>
    </tr>
  `).join('\n');

  return `
    <table>
      <thead><tr><th>Property</th><th>Expected</th><th>Actual</th><th>Severity</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
