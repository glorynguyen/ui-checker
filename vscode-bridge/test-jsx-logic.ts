import assert from 'node:assert/strict';
import test from 'node:test';
import * as path from 'path';
import * as fs from 'fs';
import { tmpdir } from 'os';
import { extractJsxProps } from './jsx-parser.ts';

// Mocking enough of the environment to test the logic that would run in the extension
test('Logic check: extractJsxProps from a simulated file content', () => {
  const content = `
    import React from 'react';
    export const MyComponent = () => (
      <Button variant="primary" size="large">
        Click
      </Button>
    );
  `;
  
  const line = 3; // 0-based, so line 4 in the string
  const lines = content.split('\n');
  const offset = lines.slice(0, line).join('\n').length + 1;
  
  // The bridge would do this:
  const props = extractJsxProps(content, offset);
  
  assert.ok(props.find(p => p.name === 'variant' && p.value === 'primary'));
  assert.ok(props.find(p => p.name === 'size' && p.value === 'large'));
});

test('Logic check: extractJsxProps handles various tag starts', () => {
  const content = '  <Component prop="val" />';
  const offset = content.indexOf('<');
  const props = extractJsxProps(content, offset);
  assert.equal(props[0].name, 'prop');
  assert.equal(props[0].value, 'val');
});
