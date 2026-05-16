import test from 'node:test';
import assert from 'node:assert/strict';
import {
  findSourceLocSuffixMatch,
  parseSourceLoc,
  sourceLocBasename,
  sourceLocMatch,
} from './source-loc.ts';

test('parseSourceLoc reads project-relative path, line, and column', () => {
  const loc = parseSourceLoc('non-sitecore/SubNavigation/SubnavigationDesktop.tsx:240:17');

  assert.equal(loc?.rawPath, 'non-sitecore/SubNavigation/SubnavigationDesktop.tsx');
  assert.equal(loc?.line, 240);
  assert.equal(loc?.column, 17);
});

test('parseSourceLoc rejects malformed and empty source locations', () => {
  assert.equal(parseSourceLoc('Button.tsx:12'), null);
  assert.equal(parseSourceLoc(':12:3'), null);
});

test('findSourceLocSuffixMatch resolves package-relative runtime paths in monorepos', () => {
  const match = findSourceLocSuffixMatch(
    'non-sitecore/SubNavigation/SubnavigationDesktop.tsx',
    [
      '/repo/apps/web/src/components/Footer.tsx',
      '/repo/apps/web/src/components/non-sitecore/SubNavigation/SubnavigationDesktop.tsx',
      '/repo/apps/web/src/components/non-sitecore/SubNavigation/SubnavigationMobile.tsx'
    ]
  );

  assert.equal(match, '/repo/apps/web/src/components/non-sitecore/SubNavigation/SubnavigationDesktop.tsx');
});

test('findSourceLocSuffixMatch handles exact matches, tie sorting, and misses', () => {
  assert.equal(
    findSourceLocSuffixMatch('src/Button.tsx', ['src/Button.tsx']),
    'src/Button.tsx'
  );
  assert.equal(
    findSourceLocSuffixMatch('src/Button.tsx', [
      '/repo/b/src/Button.tsx',
      '/repo/a/src/Button.tsx'
    ]),
    '/repo/a/src/Button.tsx'
  );
  assert.equal(findSourceLocSuffixMatch('src/Missing.tsx', ['/repo/src/Button.tsx']), null);
});

test('sourceLocMatch converts one-based source positions to VS Code positions', () => {
  const loc = parseSourceLoc('non-sitecore/SubNavigation/SubnavigationDesktop.tsx:240:17');
  assert.ok(loc);

  assert.deepEqual(sourceLocMatch('/repo/SubnavigationDesktop.tsx', loc), {
    file: '/repo/SubnavigationDesktop.tsx',
    line: 239,
    column: 16,
    score: 9999
  });
});

test('sourceLocMatch clamps zero-based editor positions', () => {
  assert.deepEqual(sourceLocMatch('/repo/Button.tsx', { rawPath: 'Button.tsx', line: 0, column: 0 }), {
    file: '/repo/Button.tsx',
    line: 0,
    column: 0,
    score: 9999
  });
});

test('sourceLocBasename normalizes slashes and trims path wrappers', () => {
  assert.equal(sourceLocBasename('./src/components/Button.tsx/'), 'Button.tsx');
  assert.equal(sourceLocBasename('src\\components\\Card.tsx'), 'Card.tsx');
});
