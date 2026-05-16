import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadConfig, validateConfig, resolveFigmaToken } from '../cli/config';
import { classifyDiff } from '../cli/core/classify';
import { renderHtmlReport, renderMarkdownReport, buildRunReport, writeHtmlReport, writeJsonReport, writeMarkdownReport } from '../cli/report';
import { resolveCheckUrl, runChecks } from '../cli/runner';
import { extractExpression, waitForSelectorExpression } from '../cli/adapters/dom-extractor';

function baseConfig(overrides: Record<string, unknown> = {}) {
  return {
    baseUrl: 'http://localhost:6006',
    tolerance: {
      spacing: '4',
      color: 6,
      borderRadius: 'bad'
    },
    failOn: {
      major: false,
      minorCount: '2',
      missing: false
    },
    checks: [
      {
        name: 'Primary Button',
        path: '/button',
        selector: '[data-testid="primary"]',
        figmaFileKey: 'file',
        figmaNodeId: '1:2'
      }
    ],
    ...overrides
  };
}

test('CI config validation applies defaults and validates checks', () => {
  const config = validateConfig({
    baseUrl: 'http://localhost:6006',
    checks: [
      {
        name: 'Primary Button',
        path: '/button',
        selector: '[data-testid="primary"]',
        figmaFileKey: 'file',
        figmaNodeId: '1:2'
      }
    ]
  });

  assert.equal(config.figmaTokenEnv, 'FIGMA_TOKEN');
  assert.deepEqual(config.tolerance, { spacing: 2, color: 5, borderRadius: 2 });
  assert.deepEqual(config.failOn, { major: true, minorCount: 0, missing: true });
});

test('CI config validation accepts overrides and coerces number-like values', () => {
  const config = validateConfig(baseConfig({ figmaTokenEnv: 'CUSTOM_TOKEN' }));

  assert.equal(config.figmaTokenEnv, 'CUSTOM_TOKEN');
  assert.deepEqual(config.tolerance, { spacing: 4, color: 6, borderRadius: 2 });
  assert.deepEqual(config.failOn, { major: false, minorCount: 2, missing: false });

  const fallbackConfig = validateConfig(baseConfig({
    figmaTokenEnv: '   ',
    tolerance: { spacing: '', color: null, borderRadius: undefined },
    failOn: { major: 'yes', minorCount: null, missing: true }
  }));
  assert.equal(fallbackConfig.figmaTokenEnv, 'FIGMA_TOKEN');
  assert.deepEqual(fallbackConfig.tolerance, { spacing: 2, color: 5, borderRadius: 2 });
  assert.deepEqual(fallbackConfig.failOn, { major: true, minorCount: 0, missing: true });
});

test('CI config validation rejects empty check lists', () => {
  assert.throws(() => validateConfig({
    baseUrl: 'http://localhost:6006',
    checks: []
  }), /at least one check/);
  assert.throws(() => validateConfig(null), /config must be an object/);
  assert.throws(() => validateConfig([]), /config must be an object/);
  assert.throws(() => validateConfig({ checks: [{}] }), /config.baseUrl/);
  assert.throws(() => validateConfig({ baseUrl: 'x', checks: [null] }), /checks\[0\] must be an object/);
  assert.throws(() => validateConfig({ baseUrl: 'x', checks: [{}] }), /checks\[0\].name/);
  assert.throws(() => validateConfig({ baseUrl: 'x', checks: [{ name: 'x', path: '', selector: 'x', figmaFileKey: 'x', figmaNodeId: 'x' }] }), /checks\[0\].path/);
  assert.throws(() => validateConfig({ baseUrl: 'x', tolerance: 1, checks: [baseConfig().checks[0]] }), /tolerance must be an object/);
});

test('CI config loader parses files and reports invalid JSON', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ui-checker-config-test-'));
  try {
    const validPath = join(dir, 'valid.json');
    const invalidPath = join(dir, 'invalid.json');
    await import('node:fs/promises').then(({ writeFile }) => Promise.all([
      writeFile(validPath, JSON.stringify(baseConfig()), 'utf8'),
      writeFile(invalidPath, '{', 'utf8')
    ]));

    assert.equal((await loadConfig(validPath)).checks[0].name, 'Primary Button');
    await assert.rejects(() => loadConfig(invalidPath), /Invalid config JSON/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('CI token resolution reads configured environment variable', () => {
  const config = validateConfig({
    baseUrl: 'http://localhost:6006',
    figmaTokenEnv: 'CUSTOM_FIGMA_TOKEN',
    checks: [
      {
        name: 'Primary Button',
        path: '/button',
        selector: '.button',
        figmaFileKey: 'file',
        figmaNodeId: '1:2'
      }
    ]
  });

  assert.equal(resolveFigmaToken(config, { CUSTOM_FIGMA_TOKEN: 'token' }), 'token');
  assert.throws(() => resolveFigmaToken(config, {}), /CUSTOM_FIGMA_TOKEN/);
});

test('CI diff classification respects major, minor, and missing thresholds', () => {
  const report = {
    summary: { total: 3, matched: 1, mismatched: 2, missing: 0 },
    results: [
      { property: 'color', status: 'match', expected: 'red', actual: 'red' },
      { property: 'padding-left', status: 'mismatch', expected: '16px', actual: '14px', severity: 'minor' },
      { property: 'padding-right', status: 'mismatch', expected: '16px', actual: '14px', severity: 'minor' }
    ]
  } as const;

  assert.equal(classifyDiff(report, { major: true, minorCount: 1, missing: true }), 'failed');
  assert.equal(classifyDiff(report, { major: true, minorCount: 2, missing: true }), 'passed');
  assert.equal(classifyDiff(report, { major: false, minorCount: 2, missing: true }), 'passed');
  assert.equal(classifyDiff({
    summary: { total: 1, matched: 0, mismatched: 1, missing: 0 },
    results: [{ property: 'width', status: 'mismatch', expected: '10px', actual: '20px', severity: 'major' }]
  }, { major: false, minorCount: 0, missing: true }), 'passed');
});

test('CI diff classification handles major and missing failures', () => {
  assert.equal(classifyDiff({
    summary: { total: 0, matched: 0, mismatched: 0, missing: 0 },
    results: []
  }, { major: true, minorCount: 0, missing: true }), 'passed');

  assert.equal(classifyDiff({
    summary: { total: 1, matched: 0, mismatched: 1, missing: 0 },
    results: [{ property: 'width', status: 'mismatch', expected: '10px', actual: '20px' }]
  }, { major: true, minorCount: 0, missing: true }), 'passed');

  assert.equal(classifyDiff({
    summary: { total: 1, matched: 0, mismatched: 0, missing: 1 },
    results: [{ property: 'width', status: 'missing', expected: '10px', actual: null, severity: 'major' }]
  }, { major: false, minorCount: 99, missing: true }), 'failed');

  assert.equal(classifyDiff({
    summary: { total: 1, matched: 0, mismatched: 0, missing: 1 },
    results: [{ property: 'width', status: 'missing', expected: '10px', actual: null, severity: 'major' }]
  }, { major: false, minorCount: 99, missing: false }), 'passed');

  assert.equal(classifyDiff({
    summary: { total: 1, matched: 0, mismatched: 1, missing: 0 },
    results: [{ property: 'width', status: 'mismatch', expected: '10px', actual: '20px', severity: 'major' }]
  }, { major: true, minorCount: 99, missing: false }), 'failed');
});

test('CI report rendering includes failed mismatch details', () => {
  const report = buildRunReport([
    {
      name: 'Primary Button',
      status: 'failed',
      url: 'http://localhost/button',
      selector: '.button',
      figmaFileKey: 'file',
      figmaNodeId: '1:2',
      diff: {
        summary: { total: 1, matched: 0, mismatched: 1, missing: 0 },
        results: [
          { property: 'padding-left', status: 'mismatch', expected: '16px', actual: '12px', severity: 'major' }
        ]
      }
    }
  ]);

  const markdown = renderMarkdownReport(report);

  assert.match(markdown, /Status: failed/);
  assert.match(markdown, /Primary Button/);
  assert.match(markdown, /padding-left/);
});

test('CI report rendering covers passed and errored checks and escapes table cells', async () => {
  const report = buildRunReport([
    {
      name: 'Clean | Button',
      status: 'passed',
      url: 'http://localhost/clean',
      selector: '.clean',
      figmaFileKey: 'file',
      figmaNodeId: '1:2',
      diff: {
        summary: { total: 1, matched: 1, mismatched: 0, missing: 0 },
        results: [{ property: 'color', status: 'match', expected: 'red', actual: 'red' }]
      }
    },
    {
      name: 'Broken Button',
      status: 'errored',
      url: 'http://localhost/broken',
      selector: '.broken',
      figmaFileKey: 'file',
      figmaNodeId: '1:3',
      error: 'Selector missing'
    }
  ]);
  const markdown = renderMarkdownReport(report);

  assert.equal(report.status, 'errored');
  assert.match(markdown, /Clean \\| Button/);
  assert.match(markdown, /No mismatches/);
  assert.match(markdown, /Error: Selector missing/);

  const dir = await mkdtemp(join(tmpdir(), 'ui-checker-report-test-'));
  try {
    const jsonPath = join(dir, 'report.json');
    const mdPath = join(dir, 'report.md');
    const htmlPath = join(dir, 'report.html');
    await writeJsonReport(jsonPath, report);
    await writeMarkdownReport(mdPath, report);
    await writeHtmlReport(htmlPath, report);
    assert.match(await readFile(jsonPath, 'utf8'), /"status": "errored"/);
    assert.match(await readFile(mdPath, 'utf8'), /Selector missing/);
    assert.match(await readFile(htmlPath, 'utf8'), /UI Checker CI Report/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }

  const noDiffReport = buildRunReport([
    {
      name: 'No\nDiff Yet',
      status: 'passed',
      url: 'http://localhost/no-diff',
      selector: '.no-diff',
      figmaFileKey: 'file',
      figmaNodeId: '1:4'
    }
  ]);
  assert.match(renderMarkdownReport(noDiffReport), /No Diff Yet/);
  assert.match(renderMarkdownReport(noDiffReport), /No mismatches/);

  assert.match(renderMarkdownReport(buildRunReport([
    {
      name: 'Missing Value',
      status: 'failed',
      url: 'http://localhost/missing',
      selector: '.missing',
      figmaFileKey: 'file',
      figmaNodeId: '1:5',
      diff: {
        summary: { total: 1, matched: 0, mismatched: 0, missing: 1 },
        results: [{ property: 'width', status: 'missing', expected: null, actual: null }]
      }
    }
  ])), /n\/a/);
});

test('CI HTML report escapes content and summarizes mismatches', () => {
  const report = buildRunReport([
    {
      name: '<Button>',
      status: 'failed',
      url: 'http://localhost/button',
      selector: '.primary',
      figmaFileKey: 'file',
      figmaNodeId: '1:2',
      diff: {
        summary: { total: 2, matched: 1, mismatched: 1, missing: 0 },
        results: [
          { property: 'color', status: 'match', expected: 'red', actual: 'red' },
          { property: 'padding-left', status: 'mismatch', expected: '16px', actual: '12px', severity: 'major' }
        ]
      }
    }
  ]);

  const html = renderHtmlReport(report);

  assert.match(html, /Status: <strong>failed<\/strong>/);
  assert.match(html, /&lt;Button&gt;/);
  assert.match(html, /padding-left/);
  assert.match(html, /16px/);
  assert.doesNotMatch(html, /<Button>/);
});

test('CI URL resolution supports relative paths and absolute URLs', () => {
  assert.equal(resolveCheckUrl('http://localhost:6006', '/button'), 'http://localhost:6006/button');
  assert.equal(resolveCheckUrl('http://localhost:6006/root/', 'button'), 'http://localhost:6006/root/button');
  assert.equal(resolveCheckUrl('http://localhost:6006', 'https://example.com/button'), 'https://example.com/button');
});

test('CI runner executes checks with injectable DOM and Figma dependencies', async () => {
  const report = await runChecks(validateConfig(baseConfig()), 'token', {
    extractDomStyles: async (url, selector) => ({
      url,
      selector,
      rootFontSize: 16,
      dimensions: { width: 100, height: 40 },
      styles: {
        width: '100px',
        height: '40px',
        'background-color': 'rgb(255, 0, 0)'
      }
    }),
    getFigmaNode: async () => ({
      absoluteBoundingBox: { width: 100, height: 40 },
      fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0 } }]
    })
  });

  assert.equal(report.status, 'passed');
  assert.equal(report.checks[0].diff?.summary.matched, 3);
});

test('CI runner handles an empty check list passed programmatically', async () => {
  const report = await runChecks({
    baseUrl: 'http://localhost:6006',
    figmaTokenEnv: 'FIGMA_TOKEN',
    tolerance: {},
    failOn: { major: true, minorCount: 0, missing: true },
    checks: []
  }, 'token');

  assert.equal(report.status, 'passed');
  assert.equal(report.summary.total, 0);
});

test('CI runner returns errored check reports for dependency failures', async () => {
  const report = await runChecks(validateConfig(baseConfig()), 'token', {
    extractDomStyles: async () => {
      throw new Error('DOM unavailable');
    },
    getFigmaNode: async () => ({})
  });

  assert.equal(report.status, 'errored');
  assert.equal(report.checks[0].error, 'DOM unavailable');

  const stringErrorReport = await runChecks(validateConfig(baseConfig()), 'token', {
    extractDomStyles: async () => {
      throw 'string failure';
    },
    getFigmaNode: async () => ({})
  });

  assert.equal(stringErrorReport.checks[0].error, 'string failure');

  const nullErrorReport = await runChecks(validateConfig(baseConfig()), 'token', {
    extractDomStyles: async () => {
      throw null;
    },
    getFigmaNode: async () => ({})
  });

  assert.equal(nullErrorReport.checks[0].error, 'null');
});

test('CI DOM extractor expressions include selector wait and style extraction logic', () => {
  const waitExpression = waitForSelectorExpression('.card', 123);
  const extraction = extractExpression('.card');

  assert.match(waitExpression, /Selector not found/);
  assert.match(waitExpression, /123/);
  assert.match(extraction, /getComputedStyle/);
  assert.match(extraction, /rootFontSize/);
  assert.match(extraction, /".card"/);
});
