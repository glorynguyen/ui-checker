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
