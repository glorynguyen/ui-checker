// @ui-checker/runtime
//
// Dev-only: walk the React fiber tree after each commit and stamp host DOM
// nodes with `data-uic-loc` (path:line:col) and `data-uic-name` (component
// name). The bridge reads these to skip fuzzy search and open the exact file.
//
// Auto-no-ops in production and in any environment where React's dev JSX
// runtime did not populate `_debugSource` on fibers.

interface DebugSource {
  fileName: string;
  lineNumber: number;
  columnNumber?: number;
}

interface Fiber {
  stateNode: unknown;
  child: Fiber | null;
  sibling: Fiber | null;
  return: Fiber | null;
  type: unknown;
  _debugSource?: DebugSource;
  _debugOwner?: Fiber | null;
}

interface FiberRoot {
  current: Fiber;
}

interface DevToolsHook {
  onCommitFiberRoot?: (id: number, root: FiberRoot, ...rest: unknown[]) => void;
  inject?: (renderer: unknown) => number;
  supportsFiber?: boolean;
  renderers?: Map<number, unknown>;
  [key: string]: unknown;
}

const ATTR_LOC = 'data-uic-loc';
const ATTR_NAME = 'data-uic-name';
const HOOK_KEY = '__REACT_DEVTOOLS_GLOBAL_HOOK__';

let pathPrefix: string | null = null;
let scheduled = false;
let pendingRoot: FiberRoot | null = null;

function getComponentName(fiber: Fiber): string | null {
  let owner = fiber._debugOwner;
  while (owner) {
    const t = owner.type as { displayName?: string; name?: string } | string | null;
    if (t) {
      if (typeof t === 'function' || typeof t === 'object') {
        const name = (t as { displayName?: string; name?: string }).displayName
          || (t as { displayName?: string; name?: string }).name;
        if (name) return name;
      }
    }
    owner = owner._debugOwner ?? null;
  }
  return null;
}

function commonPrefix(a: string, b: string): string {
  let i = 0;
  const len = Math.min(a.length, b.length);
  while (i < len && a.charCodeAt(i) === b.charCodeAt(i)) i++;
  // Trim back to the last path separator so we never split mid-segment.
  while (i > 0 && a[i - 1] !== '/' && a[i - 1] !== '\\') i--;
  return a.slice(0, i);
}

function relativize(absPath: string): string {
  if (pathPrefix === null) {
    pathPrefix = absPath;
  } else if (pathPrefix && !absPath.startsWith(pathPrefix)) {
    pathPrefix = commonPrefix(pathPrefix, absPath);
  }
  if (pathPrefix && absPath.startsWith(pathPrefix)) {
    return absPath.slice(pathPrefix.length);
  }
  return absPath;
}

function stampNode(el: HTMLElement, source: DebugSource, name: string | null) {
  const rel = relativize(source.fileName);
  const col = source.columnNumber ?? 0;
  const loc = `${rel}:${source.lineNumber}:${col}`;
  if (el.getAttribute(ATTR_LOC) !== loc) {
    el.setAttribute(ATTR_LOC, loc);
  }
  if (name && el.getAttribute(ATTR_NAME) !== name) {
    el.setAttribute(ATTR_NAME, name);
  }
}

function walk(fiber: Fiber | null) {
  let node: Fiber | null = fiber;
  while (node) {
    if (node._debugSource && node.stateNode instanceof Element) {
      stampNode(node.stateNode as HTMLElement, node._debugSource, getComponentName(node));
    }
    if (node.child) {
      walk(node.child);
    }
    node = node.sibling;
  }
}

function flushScheduled() {
  scheduled = false;
  const root = pendingRoot;
  pendingRoot = null;
  if (!root) return;
  try {
    walk(root.current);
  } catch (err) {
    console.warn('[ui-checker/runtime] walk failed:', err);
  }
}

function scheduleWalk(root: FiberRoot) {
  pendingRoot = root;
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(flushScheduled);
}

function patchHook(hook: DevToolsHook) {
  const existing = hook.onCommitFiberRoot;
  hook.onCommitFiberRoot = function (id, root, ...rest) {
    try {
      scheduleWalk(root as FiberRoot);
    } catch (err) {
      console.warn('[ui-checker/runtime] commit hook failed:', err);
    }
    if (typeof existing === 'function') {
      try {
        return existing.call(this, id, root as FiberRoot, ...rest);
      } catch (err) {
        console.warn('[ui-checker/runtime] downstream hook threw:', err);
      }
    }
  };
}

function install() {
  if (typeof window === 'undefined') return;
  if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'production') {
    return;
  }

  const w = window as unknown as Record<string, DevToolsHook | undefined>;
  let hook = w[HOOK_KEY];

  if (!hook) {
    // Install a minimal hook so we receive future commits. Must run before
    // React itself runs; document this constraint in the README.
    hook = {
      supportsFiber: true,
      inject: () => 1,
      renderers: new Map(),
    };
    w[HOOK_KEY] = hook;
  }

  patchHook(hook);
}

install();

export {};
