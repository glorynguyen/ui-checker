import test from 'node:test';
import assert from 'node:assert/strict';
import tailwindConfigModule from '../vscode-bridge/tailwind-config.ts';

const { parseTailwindTheme } = tailwindConfigModule as any;

test('parseTailwindTheme extracts common nested Tailwind theme values safely', () => {
  const theme = parseTailwindTheme(`
    module.exports = {
      theme: {
        extend: {
          colors: {
            brand: '#0057ff',
            neutral: {
              950: '#050505'
            }
          },
          spacing: {
            18: '4.5rem'
          },
          fontSize: {
            tiny: ['0.6875rem', { lineHeight: '1rem' }]
          },
          borderRadius: {
            card: '10px'
          }
        }
      }
    }
  `);

  assert.equal(theme.colors?.brand, '#0057ff');
  assert.equal(theme.colors?.['neutral-950'], '#050505');
  assert.equal(theme.spacing?.['18'], '4.5rem');
  assert.equal(theme.fontSize?.tiny, '0.6875rem');
  assert.equal(theme.borderRadius?.card, '10px');
});
