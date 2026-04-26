const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function createBrowserSandbox(overrides = {}) {
  const windowOverrides = overrides.window || {};
  const sandbox = {
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

function loadBrowserScript(relativePath, exportNames = [], sandbox = createBrowserSandbox()) {
  const absolutePath = path.resolve(__dirname, '..', relativePath);
  const source = fs.readFileSync(absolutePath, 'utf8');
  vm.runInNewContext(source, sandbox, { filename: absolutePath });

  if (exportNames.length === 0) {
    return sandbox;
  }

  return exportNames.reduce((exportsMap, name) => {
    exportsMap[name] = sandbox[name];
    return exportsMap;
  }, {});
}

module.exports = {
  createBrowserSandbox,
  loadBrowserScript
};
