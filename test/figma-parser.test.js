const test = require('node:test');
const assert = require('node:assert/strict');

const { loadBrowserScript } = require('../test-support/load-browser-script');

const { FigmaParser } = loadBrowserScript('chrome-extension/lib/figma-parser.js', ['FigmaParser']);

test('FigmaParser maps TEXT fills to color instead of background-color', () => {
  const parsed = FigmaParser.parse({
    type: 'TEXT',
    fills: [
      {
        type: 'SOLID',
        color: { r: 1, g: 0, b: 0 }
      }
    ],
    style: {
      fontFamily: 'Inter',
      fontSize: 16,
      fontWeight: 400
    }
  });

  assert.equal(parsed.styles.color, 'rgb(255, 0, 0)');
  assert.equal(parsed.styles['background-color'], undefined);
  assert.equal(parsed.sourceDeclarations.color, 'color: rgb(255, 0, 0);');
});

test('FigmaParser keeps authored declarations for shorthands and CSS variables', () => {
  const parsed = FigmaParser.parse(`
    padding: 1rem 2rem;
    color: var(--brand, #ff0000);
  `);

  assert.equal(parsed.styles['padding-top'], '1rem');
  assert.equal(parsed.styles['padding-right'], '2rem');
  assert.equal(parsed.rawStyles['padding-top'], '1rem');
  assert.equal(parsed.sourceDeclarations['padding-top'], 'padding-top: 1rem;');
  assert.equal(parsed.varMap.color.varName, '--brand');
  assert.equal(parsed.varMap.color.fallback, '#ff0000');
  assert.equal(parsed.varMap.color.original, 'var(--brand, #ff0000)');
  assert.equal(parsed.rawStyles.color, 'var(--brand, #ff0000)');
  assert.equal(parsed.sourceDeclarations.color, 'color: var(--brand, #ff0000);');
});

test('FigmaParser maps non-text fills to background-color and combines opacity', () => {
  const parsed = FigmaParser.parse({
    type: 'FRAME',
    opacity: 0.5,
    fills: [
      {
        type: 'SOLID',
        opacity: 0.5,
        color: { r: 0, g: 0.5, b: 1 }
      }
    ],
    cornerRadius: 8,
    paddingTop: 12,
    itemSpacing: 16
  });

  assert.equal(parsed.styles['background-color'], 'rgba(0, 128, 255, 0.25)');
  assert.equal(parsed.styles['border-top-left-radius'], '8px');
  assert.equal(parsed.styles['padding-top'], '12px');
  assert.equal(parsed.styles.gap, '16px');
});

test('FigmaParser parseMulti supports labeled comment blocks', () => {
  const blocks = FigmaParser.parseMulti(`
    /* Primary */
    color: #ff0000;

    /* Secondary */
    padding: 8px 12px;
  `);

  assert.equal(blocks.length, 2);
  assert.equal(blocks[0].label, 'Primary');
  assert.equal(blocks[0].styles.color, '#ff0000');
  assert.equal(blocks[1].label, 'Secondary');
  assert.equal(blocks[1].styles['padding-right'], '12px');
});

test('FigmaParser falls back to CSS parsing when JSON-like text is malformed', () => {
  const parsed = FigmaParser.parse('{"broken": true; color: #00ff00;');

  assert.equal(parsed.styles.color, '#00ff00');
});

test('FigmaParser parses valid JSON strings and boundingBox-based node sizing', () => {
  const parsed = FigmaParser.parse(JSON.stringify({
    document: {
      type: 'FRAME',
      boundingBox: {
        width: 99.6,
        height: 40.2
      },
      fills: [
        null,
        { visible: false, type: 'SOLID', color: { r: 1, g: 1, b: 1 } },
        { type: 'SOLID', color: { r: 0, g: 0, b: 0 } }
      ]
    }
  }));

  assert.equal(parsed.styles.width, '100px');
  assert.equal(parsed.styles.height, '40px');
  assert.equal(parsed.styles['background-color'], 'rgb(0, 0, 0)');
});

test('FigmaParser returns empty parse results for empty input and no-fill nodes', () => {
  const empty = FigmaParser.parse('');
  const noFillNode = FigmaParser.parse({
    type: 'FRAME',
    fills: [{ visible: false, type: 'SOLID', color: { r: 1, g: 1, b: 1 } }]
  });

  assert.equal(Object.keys(empty.styles).length, 0);
  assert.equal(Object.keys(noFillNode.styles).length, 0);
  assert.equal(FigmaParser._getPrimarySolidFill(null), null);
});

test('FigmaParser expands margin, gap, border-radius, and border shorthands across branch cases', () => {
  const parsed = FigmaParser.parse(`
    margin: 4px 8px 12px;
    gap: 10px;
    border-radius: 2px 4px 6px;
    border: 1px solid #ccc;
    background: linear-gradient(red, blue);
  `);

  assert.equal(parsed.styles['margin-top'], '4px');
  assert.equal(parsed.styles['margin-right'], '8px');
  assert.equal(parsed.styles['margin-bottom'], '12px');
  assert.equal(parsed.styles['margin-left'], '8px');
  assert.equal(parsed.styles['row-gap'], '10px');
  assert.equal(parsed.styles['column-gap'], '10px');
  assert.equal(parsed.styles['border-top-left-radius'], '2px');
  assert.equal(parsed.styles['border-top-right-radius'], '4px');
  assert.equal(parsed.styles['border-bottom-right-radius'], '6px');
  assert.equal(parsed.styles['border-bottom-left-radius'], '4px');
  assert.equal(parsed.styles['border-left-width'], '1px');
  assert.equal(parsed.styles['border-left-style'], 'solid');
  assert.equal(parsed.styles['border-left-color'], '#ccc');
  assert.equal(parsed.styles.background, 'linear-gradient(red, blue)');
});

test('FigmaParser helper branches cover fallback shorthand cases and color detection', () => {
  assert.equal(JSON.stringify(FigmaParser._expandBoxShorthand('padding', '8px')), JSON.stringify({
    'padding-top': '8px',
    'padding-right': '8px',
    'padding-bottom': '8px',
    'padding-left': '8px'
  }));

  assert.equal(JSON.stringify(FigmaParser._expandBoxShorthand('padding', '1px 2px 3px 4px')), JSON.stringify({
    'padding-top': '1px',
    'padding-right': '2px',
    'padding-bottom': '3px',
    'padding-left': '4px'
  }));

  assert.equal(JSON.stringify(FigmaParser._expandBoxShorthand('padding', '1px 2px 3px 4px 5px')), JSON.stringify({
    padding: '1px 2px 3px 4px 5px'
  }));

  assert.equal(JSON.stringify(FigmaParser._expandBorderRadius('5px 10px')), JSON.stringify({
    'border-top-left-radius': '5px',
    'border-top-right-radius': '10px',
    'border-bottom-right-radius': '5px',
    'border-bottom-left-radius': '10px'
  }));

  assert.equal(JSON.stringify(FigmaParser._expandBorderRadius('1px 2px 3px 4px')), JSON.stringify({
    'border-top-left-radius': '1px',
    'border-top-right-radius': '2px',
    'border-bottom-right-radius': '3px',
    'border-bottom-left-radius': '4px'
  }));

  assert.equal(JSON.stringify(FigmaParser._expandBorderRadius('1px 2px 3px 4px 5px')), JSON.stringify({
    'border-radius': '1px 2px 3px 4px 5px'
  }));

  assert.equal(JSON.stringify(FigmaParser._expandBorder('solid red')), JSON.stringify({
    border: 'solid red'
  }));

  assert.equal(FigmaParser._isColorValue('#fff'), true);
  assert.equal(FigmaParser._isColorValue('rgba(0,0,0,0.5)'), true);
  assert.equal(FigmaParser._isColorValue('hsla(0, 0%, 0%, 0.5)'), true);
  assert.equal(FigmaParser._isColorValue('currentColor'), true);
  assert.equal(FigmaParser._isColorValue('linear-gradient(red, blue)'), false);
});

test('FigmaParser parseMulti falls back to double-newline blocks without comments', () => {
  const blocks = FigmaParser.parseMulti(`
    color: #111111;

    border-radius: 4px;
  `);

  assert.equal(blocks.length, 2);
  assert.equal(blocks[0].label, 'Element 1');
  assert.equal(blocks[0].styles.color, '#111111');
  assert.equal(blocks[1].label, 'Element 2');
  assert.equal(blocks[1].styles['border-top-left-radius'], '4px');
  assert.equal(FigmaParser.parseMulti('   ').length, 0);
});
