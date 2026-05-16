import assert from 'node:assert/strict';
import test from 'node:test';
import { extractJsxProps } from './jsx-parser.ts';

test('extractJsxProps parses various prop types from a JSX tag', () => {
  const text = '<Button variant="primary" size={16} disabled active=\'yes\'>Click</Button>';
  const props = extractJsxProps(text, 0);

  assert.deepEqual(props, [
    { name: 'variant', value: 'primary', isExpression: false },
    { name: 'size', value: '16', isExpression: true },
    { name: 'disabled', value: true, isExpression: false },
    { name: 'active', value: 'yes', isExpression: false }
  ]);
});

test('extractJsxProps handles multi-line tags and complex expressions', () => {
  const text = `
    <Card
      title="Hello"
      onClose={() => console.log('close')}
      expanded={state === 'open'}
    />
  `;
  const props = extractJsxProps(text, 5); // pointing to <Card

  assert.equal(props.find(p => p.name === 'title')?.value, 'Hello');
  assert.equal(props.find(p => p.name === 'onClose')?.isExpression, true);
  assert.equal(props.find(p => p.name === 'expanded')?.value, "state === 'open'");
});

test('extractJsxProps ignores common React/DOM metadata props', () => {
  const text = '<div className="foo" style={{color: "red"}} key="1" ref={ref}></div>';
  const props = extractJsxProps(text, 0);

  assert.equal(props.length, 0);
});

test('extractJsxProps handles self-closing tags', () => {
  const text = '<img src="foo.png" />';
  const props = extractJsxProps(text, 0);

  assert.deepEqual(props, [
    { name: 'src', value: 'foo.png', isExpression: false }
  ]);
});
