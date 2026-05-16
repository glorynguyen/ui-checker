import assert from 'node:assert/strict';
import test from 'node:test';
import { findEditableDeclaration } from './apply-fix.ts';

function replaceTarget(text: string, target: NonNullable<ReturnType<typeof findEditableDeclaration>>, value: string) {
  return text.slice(0, target.start) + value + text.slice(target.end);
}

test('findEditableDeclaration locates plain CSS declarations near the source line', () => {
  const text = [
    '.card {',
    '  color: red;',
    '  padding-left: 12px;',
    '}'
  ].join('\n');

  const target = findEditableDeclaration(text, 2, 'padding-left');

  assert.ok(target);
  assert.equal(text.slice(target.start, target.end), '12px');
  assert.match(replaceTarget(text, target, '16px'), /padding-left: 16px;/);
});

test('findEditableDeclaration locates CSS-in-JS camelCase declarations', () => {
  const text = [
    'const styles = {',
    "  paddingLeft: '12px',",
    '  backgroundColor: "red",',
    '};'
  ].join('\n');

  const target = findEditableDeclaration(text, 1, 'padding-left');

  assert.ok(target);
  assert.equal(text.slice(target.start, target.end), '12px');
  assert.match(replaceTarget(text, target, '16px'), /paddingLeft: '16px',/);
});

test('findEditableDeclaration refuses properties outside the nearby edit window', () => {
  const lines = Array.from({ length: 200 }, (_, index) => {
    if (index === 0) return 'padding-left: 12px;';
    if (index === 199) return 'color: red;';
    return `.line-${index} {}`;
  });

  assert.equal(findEditableDeclaration(lines.join('\n'), 199, 'padding-left'), null);
});

test('findEditableDeclaration handles boundary lines and escaped property names', () => {
  const text = [
    'custom.prop: 1px;',
    'padding-left: 12px;'
  ].join('\n');

  const firstLine = findEditableDeclaration(text, -20, 'custom.prop');
  const lastLine = findEditableDeclaration(text, 81, 'padding-left');

  assert.ok(firstLine);
  assert.equal(text.slice(firstLine.start, firstLine.end), '1px');
  assert.ok(lastLine);
  assert.equal(text.slice(lastLine.start, lastLine.end), '12px');
});

test('findEditableDeclaration ignores partial property names', () => {
  const text = 'my-padding-left: 12px;';

  assert.equal(findEditableDeclaration(text, 0, 'padding-left'), null);
});
