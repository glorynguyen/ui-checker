import test from 'node:test';
import assert from 'node:assert/strict';
import {
  enumerateSearchableFiles,
  type FileEnumeratorDeps,
  type Uri,
  type WorkspaceConfiguration,
} from './file-enumerator.ts';

// --- helpers ---

function mockUri(fsPath: string): Uri {
  return { fsPath };
}

function mockConfig(values: Record<string, unknown>): WorkspaceConfiguration {
  return { get: <T>(key: string): T | undefined => (key in values ? (values[key] as T) : undefined) };
}

function makeDeps(
  configs: Record<string, Record<string, unknown>> = {},
  overrides: Partial<FileEnumeratorDeps> = {}
): FileEnumeratorDeps {
  return {
    getConfiguration: (section) => mockConfig(configs[section] ?? {}),
    findFiles: async () => [],
    readFile: async () => new Uint8Array(),
    ...overrides,
  };
}

// --- tests ---

test('empty workspace returns empty array', async () => {
  const result = await enumerateSearchableFiles(makeDeps());
  assert.deepEqual(result, []);
});

test('uses configured extensions in include glob', async () => {
  let capturedInclude = '';
  const deps = makeDeps(
    { 'ui-checker-bridge': { searchExtensions: ['tsx', 'vue'] } },
    {
      findFiles: async (include) => {
        capturedInclude = include;
        return [];
      },
    }
  );
  await enumerateSearchableFiles(deps);
  assert.ok(capturedInclude.includes('tsx'), 'should include tsx');
  assert.ok(capturedInclude.includes('vue'), 'should include vue');
  assert.ok(!capturedInclude.includes('css'), 'should not include non-configured extension');
});

test('default extensions are used when setting is absent', async () => {
  let capturedInclude = '';
  const deps = makeDeps(
    {},
    { findFiles: async (include) => { capturedInclude = include; return []; } }
  );
  await enumerateSearchableFiles(deps);
  assert.ok(capturedInclude.includes('tsx'));
  assert.ok(capturedInclude.includes('css'));
  assert.ok(capturedInclude.includes('scss'));
});

test('safety excludes are always present in exclude glob', async () => {
  let capturedExclude = '';
  const deps = makeDeps(
    {},
    { findFiles: async (_, exclude) => { capturedExclude = exclude; return []; } }
  );
  await enumerateSearchableFiles(deps);
  for (const pattern of ['**/node_modules/**', '**/.next/**', '**/dist/**', '**/coverage/**']) {
    assert.ok(capturedExclude.includes(pattern), `missing safety exclude: ${pattern}`);
  }
});

test('user additionalExcludePatterns are added to exclude glob', async () => {
  let capturedExclude = '';
  const deps = makeDeps(
    { 'ui-checker-bridge': { additionalExcludePatterns: ['**/storybook/**', '**/.cache/**'] } },
    { findFiles: async (_, exclude) => { capturedExclude = exclude; return []; } }
  );
  await enumerateSearchableFiles(deps);
  assert.ok(capturedExclude.includes('**/storybook/**'));
  assert.ok(capturedExclude.includes('**/.cache/**'));
});

test('files.exclude patterns from VS Code config are merged into exclude glob', async () => {
  let capturedExclude = '';
  const deps = makeDeps(
    { files: { exclude: { '**/vendor/**': true, '**/.idea/**': false } } },
    { findFiles: async (_, exclude) => { capturedExclude = exclude; return []; } }
  );
  await enumerateSearchableFiles(deps);
  assert.ok(capturedExclude.includes('**/vendor/**'), 'enabled files.exclude entry should be included');
  assert.ok(!capturedExclude.includes('**/.idea/**'), 'disabled files.exclude entry should be skipped');
});

test('files over maxFileSize are skipped', async () => {
  const uri = mockUri('/workspace/bundle.min.js');
  const big = new Uint8Array(2 * 1_048_576); // 2 MB
  const deps = makeDeps(
    { 'ui-checker-bridge': { maxFileSize: 1_048_576 } },
    { findFiles: async () => [uri], readFile: async () => big }
  );
  const result = await enumerateSearchableFiles(deps);
  assert.equal(result.length, 0);
});

test('files within size limit are returned', async () => {
  const uri = mockUri('/workspace/Component.tsx');
  const small = new TextEncoder().encode('<div className="foo" />');
  const deps = makeDeps(
    {},
    { findFiles: async () => [uri], readFile: async () => small }
  );
  const result = await enumerateSearchableFiles(deps);
  assert.equal(result.length, 1);
  assert.equal(result[0].filePath, '/workspace/Component.tsx');
  assert.ok(result[0].content.includes('foo'));
});

test('unreadable files are skipped without throwing', async () => {
  const uris = [mockUri('/workspace/good.tsx'), mockUri('/workspace/bad.tsx')];
  const goodBytes = new TextEncoder().encode('.card {}');
  const deps = makeDeps(
    {},
    {
      findFiles: async () => uris,
      readFile: async (uri) => {
        if (uri.fsPath.includes('bad')) throw new Error('EACCES');
        return goodBytes;
      },
    }
  );
  const result = await enumerateSearchableFiles(deps);
  assert.equal(result.length, 1);
  assert.equal(result[0].filePath, '/workspace/good.tsx');
});
