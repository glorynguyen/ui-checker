export interface MockElement {
  tagName: string;
  id: string;
  classList: {
    length: number;
    [Symbol.iterator](): IterableIterator<string>;
  };
  dataset: Record<string, string>;
  parentElement: MockElement | null;
  isConnected: boolean;
  style: any;
  removeCalled: boolean;
  getAttribute(name: string): string | null;
  getBoundingClientRect(): {
    left: number;
    top: number;
    width: number;
    height: number;
    right: number;
    bottom: number;
  };
  remove(): void;
  __computedStyles: Record<string, string>;
  appendChild?: (node: any) => void;
  textContent?: string;
}

export function createMockElement({
  tagName = 'DIV',
  id = '',
  classNames = [] as string[],
  dataset = {} as Record<string, string>,
  attributes = {} as Record<string, string>,
  parentElement = null as MockElement | null,
  isConnected = true,
  rect = { left: 10, top: 20, width: 120, height: 48 },
  computedStyles = {} as Record<string, string>
} = {}): MockElement {
  const classList = {
    length: classNames.length,
    [Symbol.iterator]: function* iterator() {
      yield* classNames;
    }
  };

  return {
    tagName,
    id,
    classList,
    dataset,
    parentElement,
    isConnected,
    style: {},
    removeCalled: false,
    getAttribute(name: string) {
      return attributes[name] ?? null;
    },
    getBoundingClientRect() {
      return {
        ...rect,
        right: rect.left + rect.width,
        bottom: rect.top + rect.height
      };
    },
    remove() {
      this.removeCalled = true;
    },
    __computedStyles: computedStyles
  };
}

export function createContentScriptSandbox({
  selectorMap = {} as Record<string, MockElement>,
  idMap = {} as Record<string, MockElement>,
  throwSelectors = [] as string[],
  rootFontSize = '16px'
} = {}) {
  const listeners = new Map<string, any>();
  const messageListeners: any[] = [];
  const sentMessages: any[] = [];
  const appendedNodes: any[] = [];

  const documentElement = createMockElement({
    tagName: 'HTML',
    computedStyles: {
      'font-size': rootFontSize
    }
  });

  const document = {
    documentElement,
    createElement() {
      return createMockElement();
    },
    addEventListener(type: string, handler: any) {
      listeners.set(type, handler);
    },
    removeEventListener(type: string) {
      listeners.delete(type);
    },
    querySelector(selector: string) {
      if (throwSelectors.includes(selector)) {
        throw new Error(`Invalid selector: ${selector}`);
      }
      return selectorMap[selector] ?? null;
    },
    getElementById(id: string) {
      return idMap[id] ?? null;
    }
  };

  documentElement.appendChild = (node: any) => {
    appendedNodes.push(node);
  };

  const chrome = {
    runtime: {
      sendMessage(message: any) {
        sentMessages.push(message);
      },
      onMessage: {
        addListener(listener: any) {
          messageListeners.push(listener);
        }
      }
    }
  };

  const window = {
    document,
    chrome,
    scrollX: 5,
    scrollY: 8,
    devicePixelRatio: 2,
    getComputedStyle(target: MockElement) {
      return {
        fontSize: target === documentElement ? rootFontSize : undefined,
        getPropertyValue(property: string) {
          return target.__computedStyles?.[property] ?? '';
        }
      };
    }
  };

  return {
    sandbox: {
      window,
      document,
      chrome
    },
    appendedNodes,
    listeners,
    messageListeners,
    sentMessages
  };
}
