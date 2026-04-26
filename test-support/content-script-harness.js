function createMockElement({
  tagName = 'DIV',
  id = '',
  classNames = [],
  dataset = {},
  attributes = {},
  rect = { left: 10, top: 20, width: 120, height: 48 },
  computedStyles = {}
} = {}) {
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
    style: {},
    removeCalled: false,
    getAttribute(name) {
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

function createContentScriptSandbox({ selectorMap = {}, rootFontSize = '16px' } = {}) {
  const listeners = new Map();
  const messageListeners = [];
  const sentMessages = [];
  const appendedNodes = [];

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
    addEventListener(type, handler) {
      listeners.set(type, handler);
    },
    removeEventListener(type) {
      listeners.delete(type);
    },
    querySelector(selector) {
      return selectorMap[selector] ?? null;
    }
  };

  documentElement.appendChild = (node) => {
    appendedNodes.push(node);
  };

  const chrome = {
    runtime: {
      sendMessage(message) {
        sentMessages.push(message);
      },
      onMessage: {
        addListener(listener) {
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
    getComputedStyle(target) {
      return {
        fontSize: target === documentElement ? rootFontSize : undefined,
        getPropertyValue(property) {
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

module.exports = {
  createMockElement,
  createContentScriptSandbox
};
