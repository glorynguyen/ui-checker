import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  RUNTIME_PACKAGE_NAME,
  RUNTIME_PACKAGE_VERSION,
  addRuntimeToPackageJson,
  findKnownRuntimeEntryFile,
  findNearestPackageJson,
  getRuntimeImportInsertLine,
} from './runtime-setup.ts';

function makeTempWorkspace() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ui-checker-runtime-setup-'));
}

function writeFile(filePath: string, contents = '') {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents);
}

function readJson(filePath: string) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

test('findKnownRuntimeEntryFile prefers React app entry before App fallback', () => {
  const root = makeTempWorkspace();
  const app = path.join(root, 'src', 'App.tsx');
  const main = path.join(root, 'src', 'main.tsx');
  writeFile(app);
  writeFile(main);

  assert.equal(findKnownRuntimeEntryFile(root), main);
});

test('findKnownRuntimeEntryFile supports Next app router layout', () => {
  const root = makeTempWorkspace();
  const layout = path.join(root, 'app', 'layout.tsx');
  writeFile(layout);

  assert.equal(findKnownRuntimeEntryFile(root), layout);
});

test('findKnownRuntimeEntryFile returns null when no known entry exists', () => {
  const root = makeTempWorkspace();
  writeFile(path.join(root, 'src', 'server.ts'));

  assert.equal(findKnownRuntimeEntryFile(root), null);
});

test('findNearestPackageJson uses closest package for monorepo apps', () => {
  const root = makeTempWorkspace();
  const rootPackage = path.join(root, 'package.json');
  const appPackage = path.join(root, 'apps', 'web', 'package.json');
  const entry = path.join(root, 'apps', 'web', 'src', 'main.tsx');
  writeFile(rootPackage, '{"name":"root"}\n');
  writeFile(appPackage, '{"name":"web"}\n');
  writeFile(entry);

  assert.equal(findNearestPackageJson(root, entry), appPackage);
});

test('findNearestPackageJson falls back to root package when entry is outside root', () => {
  const root = makeTempWorkspace();
  const outside = makeTempWorkspace();
  const rootPackage = path.join(root, 'package.json');
  const entry = path.join(outside, 'src', 'main.tsx');
  writeFile(rootPackage, '{"name":"root"}\n');
  writeFile(entry);

  assert.equal(findNearestPackageJson(root, entry), rootPackage);
});

test('findNearestPackageJson reports missing package.json clearly', () => {
  const root = makeTempWorkspace();
  const entry = path.join(root, 'src', 'main.tsx');
  writeFile(entry);

  assert.throws(
    () => findNearestPackageJson(root, entry),
    /Could not find package\.json/
  );
});

test('addRuntimeToPackageJson adds runtime as devDependency without removing existing deps', () => {
  const root = makeTempWorkspace();
  const packageJson = path.join(root, 'package.json');
  writeFile(packageJson, JSON.stringify({
    name: 'app',
    dependencies: {
      react: '^19.0.0'
    },
    devDependencies: {
      vite: '^6.0.0'
    }
  }, null, 2));

  const changed = addRuntimeToPackageJson(packageJson);
  const pkg = readJson(packageJson);

  assert.equal(changed, true);
  assert.equal(pkg.dependencies.react, '^19.0.0');
  assert.equal(pkg.devDependencies.vite, '^6.0.0');
  assert.equal(pkg.devDependencies[RUNTIME_PACKAGE_NAME], RUNTIME_PACKAGE_VERSION);
});

test('addRuntimeToPackageJson creates devDependencies and preserves compact formatting fallback', () => {
  const root = makeTempWorkspace();
  const packageJson = path.join(root, 'package.json');
  writeFile(packageJson, '{"name":"app"}\n');

  const changed = addRuntimeToPackageJson(packageJson);
  const written = fs.readFileSync(packageJson, 'utf8');
  const pkg = JSON.parse(written);

  assert.equal(changed, true);
  assert.equal(pkg.devDependencies[RUNTIME_PACKAGE_NAME], RUNTIME_PACKAGE_VERSION);
  assert.match(written, /\n  "devDependencies"/);
});

test('addRuntimeToPackageJson is a no-op when runtime already exists anywhere', () => {
  const root = makeTempWorkspace();
  const packageJson = path.join(root, 'package.json');
  const original = JSON.stringify({
    name: 'app',
    dependencies: {
      [RUNTIME_PACKAGE_NAME]: '^0.0.9'
    }
  }, null, 2) + '\n';
  writeFile(packageJson, original);

  const changed = addRuntimeToPackageJson(packageJson);

  assert.equal(changed, false);
  assert.equal(fs.readFileSync(packageJson, 'utf8'), original);
});

test('getRuntimeImportInsertLine inserts after shebang and directives', () => {
  const source = [
    '#!/usr/bin/env node',
    '"use client";',
    "'use strict';",
    'import React from "react";',
    ''
  ].join('\n');

  assert.equal(getRuntimeImportInsertLine(source), 3);
});

test('getRuntimeImportInsertLine handles files without shebang or directives', () => {
  assert.equal(getRuntimeImportInsertLine('import React from "react";\n'), 0);
  assert.equal(getRuntimeImportInsertLine(''), 0);
});
