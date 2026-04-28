import test from 'node:test';
import assert from 'node:assert/strict';
import { DiffEngine } from '../chrome-extension/lib/diff-engine';

test('DiffEngine respects spacing tolerance before flagging mismatches', () => {
  const report = DiffEngine.compare(
    { 'padding-top': '16px' },
    { 'padding-top': '17px' },
    { spacing: 2 }
  );

  assert.equal(report.summary.matched, 1);
  assert.equal(report.results[0].status, 'match');
  assert.match(report.results[0].note || '', /tolerance/);
});

test('DiffEngine reports missing properties and color mismatches clearly', () => {
  const report = DiffEngine.compare(
    {
      color: 'rgb(255, 0, 0)',
      'font-size': '16px'
    },
    {
      color: 'rgb(0, 0, 0)'
    }
  );

  const colorResult = report.results.find((result) => result.property === 'color')!;
  const sizeResult = report.results.find((result) => result.property === 'font-size')!;

  assert.equal(colorResult.status, 'mismatch');
  assert.equal(colorResult.severity, 'major');
  assert.equal(sizeResult.status, 'missing');
  assert.equal(report.summary.missing, 1);
});

test('DiffEngine treats subpixel differences as matches and classifies small spacing gaps as minor', () => {
  const report = DiffEngine.compare(
    {
      width: '100px',
      'margin-top': '16px'
    },
    {
      width: '100.4px',
      'margin-top': '19px'
    }
  );

  const widthResult = report.results.find((result) => result.property === 'width')!;
  const marginResult = report.results.find((result) => result.property === 'margin-top')!;

  assert.equal(widthResult.status, 'match');
  assert.match(widthResult.note || '', /subpixel rounding/);
  assert.equal(marginResult.status, 'mismatch');
  assert.equal(marginResult.severity, 'minor');
});

test('DiffEngine handles non-rgb colors and larger numeric deltas as major mismatches', () => {
  const report = DiffEngine.compare(
    {
      color: 'transparent',
      'font-size': '16px',
      'border-top-left-radius': '8px'
    },
    {
      color: 'currentcolor',
      'font-size': '20px',
      'border-top-left-radius': '12px'
    }
  );

  const colorResult = report.results.find((result) => result.property === 'color')!;
  const fontSizeResult = report.results.find((result) => result.property === 'font-size')!;
  const radiusResult = report.results.find((result) => result.property === 'border-top-left-radius')!;

  assert.equal(colorResult.status, 'mismatch');
  assert.equal(colorResult.severity, 'major');
  assert.equal(fontSizeResult.severity, 'major');
  assert.equal(radiusResult.severity, 'major');
});

test('DiffEngine reports exact matches in the summary', () => {
  const report = DiffEngine.compare(
    {
      display: 'flex',
      width: '120px'
    },
    {
      display: 'flex',
      width: '120px'
    }
  );

  assert.equal(report.summary.total, 2);
  assert.equal(report.summary.matched, 2);
  assert.equal(report.summary.mismatched, 0);
  assert.equal(report.summary.missing, 0);
  assert.equal(report.results[0].status, 'match');
  assert.equal(report.results[1].status, 'match');
});

test('DiffEngine treats non-numeric string differences as major mismatches', () => {
  const report = DiffEngine.compare(
    {
      display: 'grid'
    },
    {
      display: 'flex'
    }
  );

  assert.equal(report.results[0].status, 'mismatch');
  assert.equal(report.results[0].severity, 'major');
});

test('DiffEngine handles exact rgb matches and within-tolerance color differences', () => {
  const exactReport = DiffEngine.compare(
    {
      color: 'rgb(10, 20, 30)'
    },
    {
      color: 'rgb(10, 20, 30)'
    }
  );

  const toleranceReport = DiffEngine.compare(
    {
      color: 'rgb(10, 20, 30)'
    },
    {
      color: 'rgb(13, 24, 33)'
    },
    {
      color: 5
    }
  );

  assert.equal(exactReport.results[0].status, 'match');
  assert.equal(toleranceReport.results[0].status, 'match');
  assert.match(toleranceReport.results[0].note || '', /color tolerance/);
});

test('DiffEngine treats equivalent rgb and rgba values as exact color matches', () => {
  const report = DiffEngine.compare(
    {
      color: 'rgb(10, 20, 30)'
    },
    {
      color: 'rgba(10, 20, 30, 1)'
    }
  );

  assert.equal(report.results[0].status, 'match');
  assert.equal(report.results[0].expected, 'rgb(10, 20, 30)');
  assert.equal(report.results[0].actual, 'rgba(10, 20, 30, 1)');
});

test('DiffEngine handles exact matches for non-rgb colors', () => {
  const report = DiffEngine.compare(
    { color: 'inherit' },
    { color: 'inherit' }
  );

  assert.equal(report.results[0].status, 'match');
});

test('DiffEngine classifies numeric mismatch severities', () => {
  // font-size > 2px diff
  const f1 = DiffEngine.compare({ 'font-size': '16px' }, { 'font-size': '19px' });
  assert.equal(f1.results[0].severity, 'major');
  
  // font-weight mismatch
  const w1 = DiffEngine.compare({ 'font-weight': '400' }, { 'font-weight': '700' });
  assert.equal(w1.results[0].severity, 'major');

  // spacing <= 4px diff (minor)
  // Default tolerance is 2px. 10px vs 14px is 4px diff > 2px, so it is a mismatch.
  const s1 = DiffEngine.compare({ 'margin-top': '10px' }, { 'margin-top': '14px' });
  assert.equal(s1.results[0].status, 'mismatch');
  assert.equal(s1.results[0].severity, 'minor');

  // spacing > 4px diff (major)
  const s2 = DiffEngine.compare({ 'margin-top': '10px' }, { 'margin-top': '15px' });
  assert.equal(s2.results[0].severity, 'major');

  // radius <= 2px diff (minor)
  // Default radius tolerance is 2px. 4px vs 10px is 6px diff > 2px, so mismatch.
  const r1 = DiffEngine.compare({ 'border-top-left-radius': '4px' }, { 'border-top-left-radius': '10px' });
  if (r1.results[0].status !== 'mismatch') {
    console.log('DEBUG r1 mismatch status:', r1.results[0].status);
  }
  assert.equal(r1.results[0].status, 'mismatch');
  assert.equal(r1.results[0].severity, 'major'); // 6px diff > 2px is major

  // radius <= 2px diff is minor mismatch only if tolerance is 0 or if we force it.
  // Actually _classifyNumericSeverity(prop, diff) for radius: if diff <= 2 return minor.
  const rMinor = DiffEngine.compare({ 'border-top-left-radius': '4px' }, { 'border-top-left-radius': '6px' }, { borderRadius: 0 });
  assert.equal(rMinor.results[0].status, 'mismatch');
  assert.equal(rMinor.results[0].severity, 'minor');
});

test('DiffEngine handles color difference severities', () => {
  // Minor color diff (maxDiff <= 10)
  const c1 = DiffEngine.compare({ color: 'rgb(100, 100, 100)' }, { color: 'rgb(108, 108, 108)' });
  assert.equal(c1.results[0].severity, 'minor');

  // Major color diff (maxDiff > 10)
  const c2 = DiffEngine.compare({ color: 'rgb(100, 100, 100)' }, { color: 'rgb(115, 115, 115)' });
  assert.equal(c2.results[0].severity, 'major');
});

test('DiffEngine handles custom tolerance 0', () => {
  const report = DiffEngine.compare(
    { 'padding-top': '10px' },
    { 'padding-top': '11px' },
    { spacing: 0 }
  );
  assert.equal(report.results[0].status, 'mismatch');
});


