import test from 'node:test';
import assert from 'node:assert/strict';
import { TailwindMapper } from '../chrome-extension/lib/tailwind-mapper';

test('TailwindMapper maps common spacing values to default utilities', () => {
  const suggestion = TailwindMapper.suggest('padding-left', '16px', { mode: 'strict' });

  assert.equal(suggestion?.className, 'pl-4');
  assert.equal(suggestion?.confidence, 'exact');
  assert.equal(suggestion?.distance, 0);
});

test('TailwindMapper suggests nearest scale values with distance labels', () => {
  const suggestion = TailwindMapper.suggest('gap', '18px', { mode: 'nearest' });

  assert.equal(suggestion?.className, 'gap-4');
  assert.equal(suggestion?.confidence, 'nearest');
  assert.equal(suggestion?.distanceLabel, '2px off');
});

test('TailwindMapper falls back to arbitrary utilities when nearest scale is too far away', () => {
  const suggestion = TailwindMapper.suggest('width', '123px', { mode: 'nearest' });

  assert.equal(suggestion?.className, 'w-[123px]');
  assert.equal(suggestion?.confidence, 'arbitrary');
});

test('TailwindMapper respects project theme values over default-only output', () => {
  const suggestion = TailwindMapper.suggest('background-color', 'rgb(0, 87, 255)', {
    mode: 'strict',
    projectTheme: {
      colors: {
        brand: '#0057ff'
      }
    }
  });

  assert.equal(suggestion?.className, 'bg-brand');
  assert.equal(suggestion?.source, 'project');
});

test('TailwindMapper distinguishes text size classes from text color classes when building patches', () => {
  const sizeSuggestion = TailwindMapper.suggest('font-size', '16px', { mode: 'strict' })!;
  const sizePatch = TailwindMapper.buildClassPatch('text-blue-600 text-sm font-medium', sizeSuggestion);

  assert.deepEqual(sizePatch.remove, ['text-sm']);
  assert.equal(sizePatch.after, 'text-blue-600 font-medium text-base');

  const colorSuggestion = TailwindMapper.suggest('color', 'rgb(29, 78, 216)', { mode: 'strict' })!;
  const colorPatch = TailwindMapper.buildClassPatch('text-blue-600 text-sm font-medium', colorSuggestion);

  assert.deepEqual(colorPatch.remove, ['text-blue-600']);
  assert.equal(colorPatch.after, 'text-sm font-medium text-blue-700');
});

test('TailwindMapper maps static layout values to utilities', () => {
  const display = TailwindMapper.suggest('display', 'flex', { mode: 'strict' });
  const align = TailwindMapper.suggest('align-items', 'center', { mode: 'strict' });

  assert.equal(display?.className, 'flex');
  assert.equal(align?.className, 'items-center');
});
