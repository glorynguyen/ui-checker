import test from 'node:test';
import assert from 'node:assert/strict';
import { DesignTokenValidator } from '../chrome-extension/lib/design-token-validator';

test('DesignTokenValidator parses flat token JSON and normalizes values', () => {
  const tokens = DesignTokenValidator.parse(JSON.stringify({
    'color.primary': '#336699',
    'space.4': '16px',
    'font.weight.bold': 700
  }));

  assert.equal(tokens.length, 3);
  assert.equal(tokens.find((token) => token.path === 'color.primary')?.normalizedValue, 'rgb(51, 102, 153)');
  assert.equal(tokens.find((token) => token.path === 'space.4')?.normalizedValue, '16px');
  assert.equal(tokens.find((token) => token.path === 'font.weight.bold')?.normalizedValue, '700');
});

test('DesignTokenValidator parses nested W3C-style token JSON', () => {
  const tokens = DesignTokenValidator.parse({
    color: {
      primary: {
        $type: 'color',
        $value: '#ff0000'
      }
    },
    size: {
      sm: {
        value: '0.5rem'
      }
    }
  });

  assert.equal(tokens.length, 2);
  assert.equal(tokens[0].path, 'color.primary');
  assert.equal(tokens[0].type, 'color');
  assert.equal(tokens[1].normalizedValue, '8px');
});

test('DesignTokenValidator walks mixed token objects and skips metadata-like nodes', () => {
  const tokens = DesignTokenValidator.parse({
    $schema: 'https://tokens.example/schema.json',
    color: {
      primary: '#112233',
      ignoredArray: ['#000000'],
      ignoredNull: null
    },
    typography: {
      family: {
        type: 'fontFamily',
        value: 'Inter'
      }
    },
    motion: {
      easing: {
        value: 'ease-out'
      }
    }
  });

  assert.equal(tokens.find((token) => token.path === 'color.primary')?.normalizedValue, 'rgb(17, 34, 51)');
  assert.equal(tokens.find((token) => token.path === 'typography.family')?.type, 'font-family');
  assert.equal(tokens.find((token) => token.path === 'motion.easing')?.type, 'unknown');
  assert.equal(tokens.some((token) => token.path.includes('$schema')), false);
  assert.equal(tokens.some((token) => token.path.includes('ignoredArray')), false);
});

test('DesignTokenValidator flags hardcoded values that match imported tokens', () => {
  const tokens = DesignTokenValidator.parse({
    color: {
      primary: {
        $value: '#336699'
      }
    }
  });

  const result = DesignTokenValidator.validateProperty('background-color', 'rgb(51, 102, 153)', tokens);

  assert.equal(result?.status, 'hardcoded');
  assert.equal(result?.token?.path, 'color.primary');
});

test('DesignTokenValidator recognizes CSS variable token usage by name', () => {
  const tokens = DesignTokenValidator.parse({
    color: {
      primary: {
        $value: '#336699'
      }
    }
  });

  const result = DesignTokenValidator.validateProperty('background-color', '#336699', tokens, '--color-primary');

  assert.equal(result?.status, 'tokenized');
  assert.equal(result?.token?.path, 'color.primary');
});

test('DesignTokenValidator suggests closest color token for unmapped values', () => {
  const tokens = DesignTokenValidator.parse({
    color: {
      blue: { $value: '#336699' },
      red: { $value: '#cc0000' }
    }
  });

  const result = DesignTokenValidator.validateProperty('color', 'rgb(50, 100, 150)', tokens);

  assert.equal(result?.status, 'unmapped');
  assert.equal(result?.suggestions[0].path, 'color.blue');
});

test('DesignTokenValidator summarizes token coverage across validation results', () => {
  const summary = DesignTokenValidator.summarizeValidations([
    { status: 'tokenized', suggestions: [] },
    { status: 'hardcoded', suggestions: [] },
    { status: 'unmapped', suggestions: [] },
    null
  ]);

  assert.deepEqual(summary, {
    total: 3,
    tokenized: 1,
    hardcoded: 1,
    unmapped: 1,
    coveragePercent: 33
  });
});
