import test from 'node:test';
import assert from 'node:assert/strict';
import {
  findSourceLocSuffixMatch,
  parseSourceLoc,
  sourceLocMatch,
} from './source-loc.ts';

test('parseSourceLoc reads project-relative path, line, and column', () => {
  const loc = parseSourceLoc('non-sitecore/SubNavigation/SubnavigationDesktop.tsx:240:17');

  assert.equal(loc?.rawPath, 'non-sitecore/SubNavigation/SubnavigationDesktop.tsx');
  assert.equal(loc?.line, 240);
  assert.equal(loc?.column, 17);
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
