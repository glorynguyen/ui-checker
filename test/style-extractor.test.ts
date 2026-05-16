import test from 'node:test';
import assert from 'node:assert/strict';
import { StyleExtractor, getPropertyGroup, ALL_PROPERTIES, PROPERTY_GROUPS } from '../chrome-extension/lib/style-extractor.js';

test('StyleExtractor.getPropertyGroup returns the correct group for known properties', () => {
  assert.strictEqual(getPropertyGroup('margin-top'), 'Spacing');
  assert.strictEqual(getPropertyGroup('font-size'), 'Typography');
  assert.strictEqual(getPropertyGroup('width'), 'Sizing');
  assert.strictEqual(getPropertyGroup('display'), 'Layout');
  assert.strictEqual(getPropertyGroup('background-color'), 'Visual');
});

test('StyleExtractor.getPropertyGroup returns "Other" for unknown properties', () => {
  assert.strictEqual(getPropertyGroup('opacity-unlikely-prop'), 'Other');
  assert.strictEqual(getPropertyGroup('float'), 'Other');
});

test('StyleExtractor.ALL_PROPERTIES contains all properties from groups', () => {
  const flattened = Object.values(PROPERTY_GROUPS).flat();
  assert.strictEqual(ALL_PROPERTIES.length, flattened.length);
  for (const prop of flattened) {
    assert.ok(ALL_PROPERTIES.includes(prop));
  }
});

test('StyleExtractor object exports match individual exports', () => {
  assert.strictEqual(StyleExtractor.getPropertyGroup, getPropertyGroup);
  assert.strictEqual(StyleExtractor.ALL_PROPERTIES, ALL_PROPERTIES);
  assert.strictEqual(StyleExtractor.PROPERTY_GROUPS, PROPERTY_GROUPS);
});
