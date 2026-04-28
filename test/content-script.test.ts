import test from 'node:test';
import assert from 'node:assert/strict';
import { loadBrowserScript, createBrowserSandbox } from '../test-support/load-browser-script.js';
import { createContentScriptSandbox, createMockElement } from '../test-support/content-script-harness.js';

function loadContentScriptHarness(options = {}) {
  const harness = createContentScriptSandbox(options);
  const sandbox = createBrowserSandbox(harness.sandbox);
  loadBrowserScript('chrome-extension/dist/content/content.js', [], sandbox);
  assert.equal(harness.messageListeners.length, 1);

  return {
    ...harness,
    listener: harness.messageListeners[0]
  };
}

test('content script extracts selected element styles and root font size via QUERY_SELECTOR', () => {
  const button = createMockElement({
    tagName: 'BUTTON',
    id: 'cta',
    classNames: ['primary', 'large'],
    dataset: { figmaId: '12:34' },
    rect: { left: 12, top: 30, width: 145, height: 52 },
    computedStyles: {
      'font-size': '1rem',
      color: 'rgb(255, 0, 0)',
      'padding-top': '12px'
    }
  });

  const harness = loadContentScriptHarness({
    selectorMap: {
      '#cta': button
    },
    rootFontSize: '10px'
  });

  harness.listener({ action: 'QUERY_SELECTOR', selector: '#cta' }, null, () => {});

  assert.equal(harness.sentMessages.length, 1);
  const message = harness.sentMessages[0];
  assert.equal(message.action, 'ELEMENT_SELECTED');
  assert.equal(message.data.element, 'button#cta.primary.large');
  assert.equal(message.data.figmaId, '12:34');
  assert.equal(message.data.rootFontSize, 10);
  assert.equal(message.data.dimensions.width, 145);
  assert.equal(message.data.styles['font-size'], '1rem');
});

test('content script reports selector misses and returns rect data for selected elements', () => {
  const card = createMockElement({
    tagName: 'DIV',
    classNames: ['card'],
    rect: { left: 40, top: 60, width: 200, height: 100 },
    computedStyles: {
      display: 'flex'
    }
  });

  const harness = loadContentScriptHarness({
    selectorMap: {
      '.card': card
    }
  });

  harness.listener({ action: 'QUERY_SELECTOR', selector: '.missing' }, null, () => {});
  assert.equal(harness.sentMessages[0].action, 'SELECTOR_NOT_FOUND');
  assert.equal(harness.sentMessages[0].selector, '.missing');

  harness.listener({ action: 'QUERY_SELECTOR', selector: '.card' }, null, () => {});

  let response: any = null;
  const keepAlive = harness.listener(
    { action: 'GET_ELEMENT_RECT', selector: '.card' },
    null,
    (payload: any) => {
      response = payload;
    }
  );

  assert.equal(keepAlive, true);
  assert.ok(response);
  assert.equal(response.rect.x, 45);
  assert.equal(response.rect.y, 68);
  assert.equal(response.rect.viewportX, 40);
  assert.equal(response.devicePixelRatio, 2);
});

test('content script picker handlers react to mouse, click, and escape events', () => {
  const card = createMockElement({
    tagName: 'SECTION',
    classNames: ['hero'],
    rect: { left: 8, top: 32, width: 300, height: 120 },
    computedStyles: {
      color: 'rgb(0, 0, 0)'
    }
  });

  const harness = loadContentScriptHarness({
    rootFontSize: '14px'
  });

  harness.listener({ action: 'START_PICKER' }, null, () => {});
  assert.ok(harness.listeners.has('mousemove'));
  assert.ok(harness.listeners.has('click'));
  assert.ok(harness.listeners.has('keydown'));
  assert.equal(harness.appendedNodes.length, 2);

  harness.listeners.get('mousemove')({ target: card });
  assert.equal(harness.appendedNodes[0].style.display, 'block');
  assert.equal(harness.appendedNodes[1].textContent, 'section.hero  (300 x 120)');

  harness.listeners.get('click')({
    target: card,
    preventDefault() {},
    stopPropagation() {},
    stopImmediatePropagation() {}
  });

  const selectionMessage = harness.sentMessages.find((message: any) => message.action === 'ELEMENT_SELECTED');
  assert.ok(selectionMessage);
  assert.equal(selectionMessage.data.element, 'section.hero');
  assert.equal(harness.listeners.size, 0);

  harness.listener({ action: 'START_PICKER' }, null, () => {});
  harness.listeners.get('keydown')({ key: 'Escape' });
  const cancelMessage = harness.sentMessages.find((message: any) => message.action === 'PICKER_CANCELLED');
  assert.ok(cancelMessage);
  assert.equal(harness.listeners.size, 0);
  assert.equal(harness.appendedNodes[0].removeCalled, true);
  assert.equal(harness.appendedNodes[1].removeCalled, true);
});

test('content script returns an error when no rect target is available', () => {
  const harness = loadContentScriptHarness();

  let response: any = null;
  harness.listener(
    { action: 'GET_ELEMENT_RECT', selector: '.missing' },
    null,
    (payload: any) => {
      response = payload;
    }
  );

  assert.ok(response);
  assert.equal(response.error, true);
});
