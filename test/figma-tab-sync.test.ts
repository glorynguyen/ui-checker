import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFigmaTabUrl, selectBestFigmaTab } from '../chrome-extension/lib/figma-tab-sync';

test('parseFigmaTabUrl extracts file key and normalizes dash node IDs', () => {
  const parsed = parseFigmaTabUrl('https://www.figma.com/design/abc123/Design-System?node-id=12-34&t=token');

  assert.deepEqual(parsed, {
    fileKey: 'abc123',
    nodeId: '12:34',
    url: 'https://www.figma.com/design/abc123/Design-System?node-id=12-34&t=token'
  });
});

test('parseFigmaTabUrl supports file URLs and already decoded node IDs', () => {
  const parsed = parseFigmaTabUrl('https://figma.com/file/fileKey/Page?node-id=1%3A2');

  assert.equal(parsed?.fileKey, 'fileKey');
  assert.equal(parsed?.nodeId, '1:2');
});

test('parseFigmaTabUrl ignores non-Figma URLs and Figma files without selected nodes', () => {
  assert.equal(parseFigmaTabUrl('https://example.com/design/abc?node-id=1-2'), null);
  assert.equal(parseFigmaTabUrl('https://www.figma.com/design/abc123/Design-System'), null);
  assert.equal(parseFigmaTabUrl('not a url'), null);
});

test('selectBestFigmaTab prefers active current-window Figma tabs with selected nodes', () => {
  const selected = selectBestFigmaTab([
    {
      id: 1,
      url: 'https://www.figma.com/design/first/File?node-id=1-2',
      active: false,
      currentWindow: true
    },
    {
      id: 2,
      url: 'https://www.figma.com/design/second/File?node-id=3-4',
      active: true,
      currentWindow: true
    },
    {
      id: 3,
      url: 'https://www.figma.com/design/third/File',
      active: true,
      currentWindow: true
    }
  ]);

  assert.equal(selected?.fileKey, 'second');
  assert.equal(selected?.nodeId, '3:4');
});

test('selectBestFigmaTab returns null when no usable Figma tab exists', () => {
  const selected = selectBestFigmaTab([
    { id: 1, url: 'https://example.com' },
    { id: 2, url: 'https://www.figma.com/design/fileKey/File' }
  ]);

  assert.equal(selected, null);
});
