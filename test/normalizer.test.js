const test = require('node:test');
const assert = require('node:assert/strict');

const { loadBrowserScript } = require('../test-support/load-browser-script');

const { Normalizer } = loadBrowserScript('chrome-extension/lib/normalizer.js', ['Normalizer']);

test('Normalizer uses the provided root font size when converting rem values', () => {
  const normalized = Normalizer.normalize(
    {
      'font-size': '1rem',
      'padding-top': '1.5rem',
      'padding-right': '2rem'
    },
    10
  );

  assert.equal(normalized['font-size'], '10px');
  assert.equal(normalized['padding-top'], '15px');
  assert.equal(normalized['padding-right'], '20px');
});

test('Normalizer keeps color and font-family comparisons stable', () => {
  const normalized = Normalizer.normalize({
    color: '#ff0000',
    'font-family': '"Inter", sans-serif',
    'font-weight': 'bold'
  });

  assert.equal(normalized.color, 'rgb(255, 0, 0)');
  assert.equal(normalized['font-family'], 'inter');
  assert.equal(normalized['font-weight'], '700');
});

test('Normalizer handles line-height normal, zero units, border none, and 8-digit hex colors', () => {
  const normalized = Normalizer.normalize(
    {
      'font-size': '20px',
      'line-height': 'normal',
      'margin-top': '0px',
      'border-top-width': '0px none rgb(0, 0, 0)',
      'border-top-style': 'none',
      color: '#ff000080'
    },
    16
  );

  assert.equal(normalized['line-height'], '24px');
  assert.equal(normalized['margin-top'], '0px');
  assert.equal(normalized['border-top-width'], '0px');
  assert.equal(normalized.color, 'rgba(255, 0, 0, 0.5)');
});

test('Normalizer handles rgb spacing, rgba alpha variants, and non-color passthrough', () => {
  assert.equal(
    Normalizer.normalizeValue('color', 'rgb( 10 , 20 , 30 )'),
    'rgb(10, 20, 30)'
  );

  assert.equal(
    Normalizer.normalizeValue('color', 'rgba(10, 20, 30, 0.25)'),
    'rgba(10, 20, 30, 0.25)'
  );

  assert.equal(
    Normalizer.normalizeValue('color', 'rgba(10, 20, 30, 1)'),
    'rgb(10, 20, 30)'
  );

  assert.equal(
    Normalizer.normalizeValue('color', 'linear-gradient(red, blue)'),
    'linear-gradient(red, blue)'
  );
});

test('Normalizer converts 3-digit hex values and preserves invalid hex input', () => {
  assert.equal(
    Normalizer.normalizeValue('color', '#abc'),
    'rgb(170, 187, 204)'
  );

  assert.equal(
    Normalizer._hexToRgb('abcd1'),
    '#abcd1'
  );
});
