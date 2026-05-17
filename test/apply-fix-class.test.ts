import test from 'node:test';
import assert from 'node:assert/strict';
import applyFixModule from '../vscode-bridge/apply-fix.ts';

const { findEditableClassList } = applyFixModule as any;

test('findEditableClassList finds a nearby static className with matching classes', () => {
  const source = `
export function Button() {
  return (
    <button className="px-3 py-2 text-sm text-blue-600">
      Save
    </button>
  );
}
`;

  const match = findEditableClassList(source, 2, 'px-3 py-2 text-sm text-blue-600');

  assert.equal(match?.currentValue, 'px-3 py-2 text-sm text-blue-600');
  assert.equal(source.slice(match!.start, match!.end), match!.currentValue);
});

test('findEditableClassList returns null when only dynamic class expressions exist', () => {
  const source = `
export function Button({ active }) {
  return <button className={active ? 'text-blue-600' : 'text-gray-500'} />;
}
`;

  assert.equal(findEditableClassList(source, 2, 'text-blue-600'), null);
});
