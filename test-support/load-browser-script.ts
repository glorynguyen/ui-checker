import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createBrowserSandbox(overrides: any = {}) {
  const windowOverrides = overrides.window || {};
  const sandbox: any = {
    console,
    setTimeout,
    clearTimeout,
    structuredClone,
    ...overrides
  };

  delete sandbox.window;
  Object.assign(sandbox, windowOverrides);

  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;

  return sandbox;
}

export function loadBrowserScript(relativePath: string, exportNames: string[] = [], sandbox: any = createBrowserSandbox()) {
  const absolutePath = path.resolve(__dirname, '..', relativePath);
  const source = fs.readFileSync(absolutePath, 'utf8');
  vm.runInNewContext(source, sandbox, { filename: absolutePath });

  if (exportNames.length === 0) {
    return sandbox;
  }

  return exportNames.reduce((exportsMap: any, name: string) => {
    exportsMap[name] = sandbox[name];
    return exportsMap;
  }, {});
}
