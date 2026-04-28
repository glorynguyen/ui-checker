import test from 'node:test';
import assert from 'node:assert/strict';
import { FigmaParser } from '../chrome-extension/lib/figma-parser';

test('FigmaParser parses CSS text and extracts var() metadata', () => {
  const css = `
    color: var(--blue-500, #3B82F6);
    padding: 16px;
  `;
  const { styles, varMap } = FigmaParser.parse(css);

  assert.equal(styles['color'], '#3B82F6');
  assert.equal(varMap['color'].varName, '--blue-500');
  assert.equal(varMap['color'].fallback, '#3B82F6');
  assert.equal(styles['padding-top'], '16px');
});

test('FigmaParser expands box shorthands (padding/margin)', () => {
  const { styles: p2 } = FigmaParser.parse('padding: 10px 20px;');
  assert.equal(p2['padding-top'], '10px');
  assert.equal(p2['padding-right'], '20px');
  assert.equal(p2['padding-bottom'], '10px');
  assert.equal(p2['padding-left'], '20px');

  const { styles: p4 } = FigmaParser.parse('margin: 1px 2px 3px 4px;');
  assert.equal(p4['margin-top'], '1px');
  assert.equal(p4['margin-right'], '2px');
  assert.equal(p4['margin-bottom'], '3px');
  assert.equal(p4['margin-left'], '4px');
});

test('FigmaParser expands border shorthands into individual sides and properties', () => {
  const { styles } = FigmaParser.parse('border: 1px solid rgb(0, 0, 0);');
  assert.equal(styles['border-top-width'], '1px');
  assert.equal(styles['border-top-style'], 'solid');
  assert.equal(styles['border-top-color'], 'rgb(0, 0, 0)');
  assert.equal(styles['border-bottom-width'], '1px');
});

test('FigmaParser expands border-radius shorthands', () => {
  const { styles: r1 } = FigmaParser.parse('border-radius: 8px;');
  assert.equal(r1['border-top-left-radius'], '8px');
  assert.equal(r1['border-bottom-right-radius'], '8px');

  const { styles: r2 } = FigmaParser.parse('border-radius: 4px 8px;');
  assert.equal(r2['border-top-left-radius'], '4px');
  assert.equal(r2['border-top-right-radius'], '8px');
  assert.equal(r2['border-bottom-right-radius'], '4px');
  assert.equal(r2['border-bottom-left-radius'], '8px');
});

test('FigmaParser expands gap shorthands', () => {
  const { styles: g1 } = FigmaParser.parse('gap: 16px;');
  assert.equal(g1['row-gap'], '16px');
  assert.equal(g1['column-gap'], '16px');

  const { styles: g2 } = FigmaParser.parse('gap: 20px 10px;');
  assert.equal(g2['row-gap'], '20px');
  assert.equal(g2['column-gap'], '10px');
});

test('FigmaParser maps simple background values to background-color', () => {
  const { styles } = FigmaParser.parse('background: #FF0000;');
  assert.equal(styles['background-color'], '#FF0000');
});

test('FigmaParser parses node objects from the Figma API', () => {
  const node = {
    document: {
      type: 'RECTANGLE',
      absoluteBoundingBox: { width: 100, height: 200 },
      fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0 }, opacity: 1 }],
      cornerRadius: 8,
      paddingTop: 16,
      itemSpacing: 12
    }
  };
  const { styles } = FigmaParser.parse(node);
  assert.equal(styles['width'], '100px');
  assert.equal(styles['height'], '200px');
  assert.equal(styles['background-color'], 'rgb(255, 0, 0)');
  assert.equal(styles['border-top-left-radius'], '8px');
  assert.equal(styles['padding-top'], '16px');
  assert.equal(styles['gap'], '12px');
});

test('FigmaParser handles text node objects correctly', () => {
  const node = {
    document: {
      type: 'TEXT',
      fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 1 } }],
      style: {
        fontFamily: 'Inter',
        fontSize: 16,
        fontWeight: 700,
        lineHeightPx: 19.2
      }
    }
  };
  const { styles } = FigmaParser.parse(node);
  assert.equal(styles['color'], 'rgb(0, 0, 255)');
  assert.equal(styles['font-family'], 'Inter');
  assert.equal(styles['font-size'], '16px');
  assert.equal(styles['font-weight'], '700');
  assert.equal(styles['line-height'], '19px');
});

test('FigmaParser parses multi-block CSS comments into labeled blocks', () => {
  const css = `
    /* Header */
    color: red;
    
    /* Body */
    color: blue;
  `;
  const blocks = FigmaParser.parseMulti(css);
  assert.equal(blocks.length, 2);
  assert.equal(blocks[0].label, 'Header');
  assert.equal(blocks[0].styles['color'], 'red');
  assert.equal(blocks[1].label, 'Body');
  assert.equal(blocks[1].styles['color'], 'blue');
});

test('FigmaParser falls back to double-newline splitting for multi-block parsing', () => {
  const css = `
    width: 100px;

    width: 200px;
  `;
  const blocks = FigmaParser.parseMulti(css);
  assert.equal(blocks.length, 2);
  assert.equal(blocks[0].styles['width'], '100px');
  assert.equal(blocks[1].styles['width'], '200px');
});

test('FigmaParser falls back to CSS parsing when JSON is malformed', () => {
  const malformed = '{ invalid json';
  const { styles } = FigmaParser.parse(malformed);
  assert.ok(styles);
});

test('FigmaParser handles nodes with no valid fills', () => {
  const node = {
    type: 'RECTANGLE',
    fills: [{ type: 'IMAGE', visible: true }] // Non-SOLID
  };
  const { styles } = FigmaParser.parse(node);
  assert.equal(styles['background-color'], undefined);
});

test('FigmaParser handles var() without fallback', () => {
  const { styles } = FigmaParser.parse('color: var(--my-var);');
  // Should keep the raw value as fallback if none provided
  assert.equal(styles['color'], 'var(--my-var)');
});

test('FigmaParser expands single-value box shorthands', () => {
  const { styles } = FigmaParser.parse('padding: 15px;');
  assert.equal(styles['padding-top'], '15px');
  assert.equal(styles['padding-right'], '15px');
  assert.equal(styles['padding-bottom'], '15px');
  assert.equal(styles['padding-left'], '15px');
});

test('FigmaParser expands two-value box shorthands', () => {
  const { styles } = FigmaParser.parse('margin: 10px 5px;');
  assert.equal(styles['margin-top'], '10px');
  assert.equal(styles['margin-bottom'], '10px');
  assert.equal(styles['margin-left'], '5px');
  assert.equal(styles['margin-right'], '5px');
});

test('FigmaParser expands three-value box shorthands', () => {
  const { styles } = FigmaParser.parse('padding: 10px 20px 30px;');
  assert.equal(styles['padding-top'], '10px');
  assert.equal(styles['padding-right'], '20px');
  assert.equal(styles['padding-bottom'], '30px');
  assert.equal(styles['padding-left'], '20px');
});

test('FigmaParser handles text nodes with no style object', () => {
  const node = {
    type: 'TEXT',
    fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 }, visible: true }]
  };
  const { styles } = FigmaParser.parse(node);
  assert.equal(styles['color'], 'rgb(0, 0, 0)');
  assert.ok(!styles['font-size']);
});

test('FigmaParser handles invisible fills', () => {
  const node = {
    type: 'RECTANGLE',
    fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 }, visible: false }]
  };
  const { styles } = FigmaParser.parse(node);
  assert.equal(styles['background-color'], undefined);
});

test('FigmaParser handles boundingBox as fallback', () => {
  const node = {
    boundingBox: { width: 50, height: 60 }
  };
  const { styles } = FigmaParser.parse(node);
  assert.equal(styles['width'], '50px');
  assert.equal(styles['height'], '60px');
});

test('FigmaParser handles rgba with opacity < 1', () => {
  const node = {
    type: 'RECTANGLE',
    fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0 }, opacity: 0.5 }]
  };
  const { styles } = FigmaParser.parse(node);
  assert.equal(styles['background-color'], 'rgba(255, 0, 0, 0.5)');
});

test('FigmaParser handles various CSS text edge cases', () => {
  assert.deepEqual(FigmaParser.parse(''), { styles: {}, varMap: {}, rawStyles: {}, sourceDeclarations: {} });
  assert.deepEqual(FigmaParser.parse('  '), { styles: {}, varMap: {}, rawStyles: {}, sourceDeclarations: {} });
  
  const { styles } = FigmaParser.parse('color:; :red; width: 100px');
  assert.equal(styles['width'], '100px');
  assert.ok(!styles['color']);
});

test('FigmaParser handles non-color background', () => {
  const { styles } = FigmaParser.parse('background: url(image.png);');
  assert.equal(styles['background'], 'url(image.png)');
});

test('FigmaParser expands 4-value box shorthand', () => {
  const { styles } = FigmaParser.parse('padding: 1px 2px 3px 4px;');
  assert.equal(styles['padding-top'], '1px');
  assert.equal(styles['padding-right'], '2px');
  assert.equal(styles['padding-bottom'], '3px');
  assert.equal(styles['padding-left'], '4px');
});

test('FigmaParser expands complex border-radius', () => {
  const { styles: s3 } = FigmaParser.parse('border-radius: 1px 2px 3px;');
  assert.equal(s3['border-top-left-radius'], '1px');
  assert.equal(s3['border-top-right-radius'], '2px');
  assert.equal(s3['border-bottom-right-radius'], '3px');
  assert.equal(s3['border-bottom-left-radius'], '2px');

  const { styles: s4 } = FigmaParser.parse('border-radius: 1px 2px 3px 4px;');
  assert.equal(s4['border-top-left-radius'], '1px');
  assert.equal(s4['border-top-right-radius'], '2px');
  assert.equal(s4['border-bottom-right-radius'], '3px');
  assert.equal(s4['border-bottom-left-radius'], '4px');
});

test('FigmaParser handles malformed border shorthand', () => {
  const { styles } = FigmaParser.parse('border: 1px solid;');
  assert.equal(styles['border'], '1px solid');
});

test('FigmaParser handles hsla and other colors', () => {
  const { styles } = FigmaParser.parse('background: hsla(120, 100%, 50%, 0.3);');
  assert.equal(styles['background-color'], 'hsla(120, 100%, 50%, 0.3)');
  
  const { styles: s2 } = FigmaParser.parse('background: inherit;');
  assert.equal(s2['background-color'], 'inherit');
});

test('FigmaParser parseMulti handles blocks without labels and fallback labels', () => {
  const css = 'width: 100px; \n\n height: 200px;';
  const blocks = FigmaParser.parseMulti(css);
  assert.equal(blocks.length, 2);
  assert.equal(blocks[0].label, 'Element 1');
  assert.equal(blocks[1].label, 'Element 2');
});

test('FigmaParser _extractVarInfo with no match', () => {
  assert.equal(FigmaParser._extractVarInfo('not a var'), null);
});

test('FigmaParser _expandBoxShorthand with default branch', () => {
  const result = FigmaParser._expandBoxShorthand('padding', '1px 2px 3px 4px 5px');
  assert.deepEqual(result, { 'padding': '1px 2px 3px 4px 5px' });
});

test('FigmaParser _expandBorderRadius with default branch', () => {
  const result = FigmaParser._expandBorderRadius('1px 2px 3px 4px 5px');
  assert.deepEqual(result, { 'border-radius': '1px 2px 3px 4px 5px' });
});

test('FigmaParser _expandBorder with no match', () => {
  const result = (FigmaParser as any)._expandBorder('1px solid');
  assert.deepEqual(result, { 'border': '1px solid' });
});

test('FigmaParser parse with null input', () => {
  const result = FigmaParser.parse(null);
  assert.deepEqual(result, { styles: {}, varMap: {}, rawStyles: {}, sourceDeclarations: {} });
});

test('FigmaParser parse with empty string', () => {
  const result = FigmaParser.parse('');
  assert.deepEqual(result, { styles: {}, varMap: {}, rawStyles: {}, sourceDeclarations: {} });
});

test('FigmaParser parse with valid JSON string', () => {
  const json = JSON.stringify({ absoluteBoundingBox: { width: 100, height: 200 } });
  const result = FigmaParser.parse(json);
  assert.equal(result.styles['width'], '100px');
  assert.equal(result.styles['height'], '200px');
});

test('FigmaParser _parseNodeObject with doc.document branch', () => {
  const node = { document: { type: 'FRAME', absoluteBoundingBox: { width: 10, height: 10 } } };
  const result = (FigmaParser as any)._parseNodeObject(node);
  assert.equal(result.styles['width'], '10px');
});

test('FigmaParser typography branches', () => {
  const node = {
    style: {
      fontFamily: 'Arial',
      fontSize: 12,
      fontWeight: 400,
      lineHeightPx: 14,
      letterSpacing: 0.5,
      textAlignHorizontal: 'CENTER'
    }
  };
  const { styles } = FigmaParser.parse(node);
  assert.equal(styles['font-family'], 'Arial');
  assert.equal(styles['font-size'], '12px');
  assert.equal(styles['font-weight'], '400');
  assert.equal(styles['line-height'], '14px');
  assert.equal(styles['letter-spacing'], '0.5px');
  assert.equal(styles['text-align'], 'center');
});

test('FigmaParser opacity and color branches', () => {
  // _combineOpacity with undefined
  const alpha = (FigmaParser as any)._combineOpacity(undefined, undefined);
  assert.equal(alpha, 1);

  // _figmaColorToRgb with alpha !== 1
  const color = (FigmaParser as any)._figmaColorToRgb({ r: 1, g: 0, b: 0 }, 0.5);
  assert.equal(color, 'rgba(255, 0, 0, 0.5)');
});


test('FigmaParser _isColorValue hsla and inherit', () => {
  assert.ok((FigmaParser as any)._isColorValue('hsla(1, 2%, 3%, 0.4)'));
  assert.ok((FigmaParser as any)._isColorValue('inherit'));
});







