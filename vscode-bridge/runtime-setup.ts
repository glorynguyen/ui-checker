import * as fs from 'fs';
import * as path from 'path';

export const RUNTIME_PACKAGE_NAME = '@ui-checker/runtime';
export const RUNTIME_PACKAGE_VERSION = '^0.1.0';
export const RUNTIME_FALLBACK_INCLUDE = '**/{main,index,_app,layout,App}.{ts,tsx,js,jsx}';
export const RUNTIME_FALLBACK_EXCLUDE = '**/{node_modules,dist,build,.next,out}/**';

const ENTRY_POINTS = [
  'src/main.jsx',
  'src/main.tsx',
  'src/index.jsx',
  'src/index.tsx',
  'main.jsx',
  'main.tsx',
  'index.jsx',
  'index.tsx',
  'src/main.js',
  'src/main.ts',
  'src/index.js',
  'src/index.ts',
  'main.js',
  'main.ts',
  'index.js',
  'index.ts'
];

const NEXT_ENTRY_POINTS = [
  'src/pages/_app.jsx',
  'src/pages/_app.tsx',
  'pages/_app.jsx',
  'pages/_app.tsx',
  'src/app/layout.jsx',
  'src/app/layout.tsx',
  'app/layout.jsx',
  'app/layout.tsx'
];

const FALLBACK_ENTRY_POINTS = [
  'src/App.jsx',
  'src/App.tsx',
  'App.jsx',
  'App.tsx'
];

export function findKnownRuntimeEntryFile(rootPath: string) {
  for (const entryPoint of [...ENTRY_POINTS, ...NEXT_ENTRY_POINTS, ...FALLBACK_ENTRY_POINTS]) {
    const candidate = path.join(rootPath, entryPoint);
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

export function findNearestPackageJson(rootPath: string, entryFilePath: string) {
  let dir = path.dirname(entryFilePath);

  while (!path.relative(rootPath, dir).startsWith('..')) {
    const candidate = path.join(dir, 'package.json');
    if (fs.existsSync(candidate)) {
      return candidate;
    }

    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  const rootPackageJson = path.join(rootPath, 'package.json');
  if (fs.existsSync(rootPackageJson)) {
    return rootPackageJson;
  }

  throw new Error(`Could not find package.json. Please add ${RUNTIME_PACKAGE_NAME} to your project package.json manually.`);
}

export function addRuntimeToPackageJson(packageJsonPath: string) {
  const text = fs.readFileSync(packageJsonPath, 'utf8');
  const indentMatch = text.match(/\n(\s+)"[^"]+":/);
  const indent = indentMatch?.[1] ?? '  ';
  const pkg = JSON.parse(text);

  const dependencySections = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];
  const alreadyDeclared = dependencySections.some((section) => pkg[section]?.[RUNTIME_PACKAGE_NAME]);
  if (alreadyDeclared) {
    return false;
  }

  pkg.devDependencies = {
    ...(pkg.devDependencies ?? {}),
    [RUNTIME_PACKAGE_NAME]: RUNTIME_PACKAGE_VERSION
  };

  fs.writeFileSync(packageJsonPath, `${JSON.stringify(pkg, null, indent)}\n`);
  return true;
}

export function getRuntimeImportInsertLine(text: string) {
  const lines = text.split(/\r?\n/);
  let line = 0;

  if (lines[line]?.startsWith('#!')) {
    line++;
  }

  while (/^\s*['"]use (client|strict)['"];?\s*$/.test(lines[line] ?? '')) {
    line++;
  }

  return line;
}
