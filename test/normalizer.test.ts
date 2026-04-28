import test from 'node:test';
import assert from 'node:assert/strict';
import { Normalizer } from '../chrome-extension/lib/normalizer';

test('Normalizer resolves var() fallbacks and lowercases strings', () => {
  const input = {
    color: 'var(--brand, #FF0000)',
    'text-transform': 'UPPERCASE'
  };
  const normalized = Normalizer.normalize(input);
  
  assert.equal(normalized['color'], 'rgb(255, 0, 0)');
  assert.equal(normalized['text-transform'], 'uppercase');
});

test('Normalizer converts rem values to px based on root font size', () => {
  const input = { 'font-size': '2rem' };
  const normalized = Normalizer.normalize(input, 16);
  assert.equal(normalized['font-size'], '32px');
});

test('Normalizer standardizes font-weight keywords to numeric strings', () => {
  assert.equal(Normalizer.normalizeValue('font-weight', 'Bold'), '700');
  assert.equal(Normalizer.normalizeValue('font-weight', 'Regular'), '400');
  assert.equal(Normalizer.normalizeValue('font-weight', 'Medium'), '500');
});

test('Normalizer handles hex colors including shorthand and alpha', () => {
  assert.equal(Normalizer.normalizeValue('color', '#fff'), 'rgb(255, 255, 255)');
  assert.equal(Normalizer.normalizeValue('color', '#000000'), 'rgb(0, 0, 0)');
  assert.equal(Normalizer.normalizeValue('color', '#ff000080'), 'rgba(255, 0, 0, 0.5)');
});

test('Normalizer normalizes font-family to the primary font name', () => {
  assert.equal(Normalizer.normalizeValue('font-family', '"Inter", sans-serif'), 'inter');
  assert.equal(Normalizer.normalizeValue('font-family', 'Roboto, Arial'), 'roboto');
});

test('Normalizer strips units from zero values', () => {
  assert.equal(Normalizer.normalizeValue('margin-top', '0px'), '0');
  assert.equal(Normalizer.normalizeValue('padding', '0rem'), '0');
});

test('Normalizer handles line-height "normal" based on font-size', () => {
  const styles = { 'font-size': '20px', 'line-height': 'normal' };
  const normalized = Normalizer.normalize(styles);
  assert.equal(normalized['line-height'], '24px'); // 20 * 1.2
});

test('Normalizer appends px to bare numbers for known dimension properties', () => {
  assert.equal(Normalizer.normalizeValue('width', '100'), '100px');
  assert.equal(Normalizer.normalizeValue('gap', '16.5'), '16.5px');
  // Should not append to non-px props
  assert.equal(Normalizer.normalizeValue('opacity', '0.5'), '0.5');
});

test('Normalizer handles border "none" variants', () => {
  assert.equal(Normalizer.normalizeValue('border-width', 'none'), '0');
  assert.equal(Normalizer.normalizeValue('border-style', 'none'), 'none');
  assert.equal(Normalizer.normalizeValue('border-top', '0px none rgb(0, 0, 0)'), 'none');
});

test('Normalizer handles "auto" value correctly', () => {
  assert.equal(Normalizer.normalizeValue('width', 'auto'), 'auto');
});

test('Normalizer handles border-color in _isColorProperty', () => {
  // #fff should be normalized to rgb(255, 255, 255) for border-color
  assert.equal(Normalizer.normalizeValue('border-color', '#fff'), 'rgb(255, 255, 255)');
  assert.equal(Normalizer.normalizeValue('border-top-color', '#000'), 'rgb(0, 0, 0)');
});

test('Normalizer returns null for null or undefined input', () => {
  assert.equal(Normalizer.normalizeValue('color', null), null);
  assert.equal(Normalizer.normalizeValue('color', undefined), null);
});

test('Normalizer handles various color formats and edge cases', () => {
  assert.equal(Normalizer.normalizeValue('color', 'rgb(255,255,255)'), 'rgb(255, 255, 255)');
  assert.equal(Normalizer.normalizeValue('color', 'rgba(255, 255, 255, 1)'), 'rgb(255, 255, 255)');
  assert.equal(Normalizer.normalizeValue('color', 'invalid-color'), 'invalid-color');
  assert.equal(Normalizer.normalizeValue('color', '#zzzzzz'), '#zzzzzz');
});

test('Normalizer handles border width/style/color branches', () => {
  assert.equal(Normalizer.normalizeValue('border-top-width', 'none'), '0');
  assert.equal(Normalizer.normalizeValue('border-top-style', 'none'), 'none');
  assert.equal(Normalizer.normalizeValue('border-right', 'none'), 'none');
});

test('Normalizer handles font-weight keyword fallback', () => {
  assert.equal(Normalizer.normalizeValue('font-weight', 'something-else'), 'something-else');
});

test('Normalizer handles unit normalization for zero', () => {
  assert.equal(Normalizer.normalizeValue('margin', '0%'), '0');
  assert.equal(Normalizer.normalizeValue('margin', '0pt'), '0');
});

test('Normalizer handles missing font-size for line-height normal', () => {
  const styles = { 'line-height': 'normal' };
  const normalized = Normalizer.normalize(styles);
  assert.equal(normalized['line-height'], '19px'); // round(16 * 1.2)
});

test('Normalizer handles hex8 with alpha 1', () => {
  assert.equal(Normalizer.normalizeValue('color', '#ff0000ff'), 'rgb(255, 0, 0)');
});


