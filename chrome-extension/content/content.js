// Content script: Element picker + style extraction
// Injected into every page. Activates picker on message from panel.

(function () {
  let pickerActive = false;
  let highlightEl = null;
  let tooltipEl = null;
  let lastTarget = null;

  // Curated CSS properties to extract (same list used in style-extractor logic)
  const CURATED_PROPERTIES = [
    // Spacing
    'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
    'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
    'gap', 'row-gap', 'column-gap',
    // Typography
    'font-family', 'font-size', 'font-weight', 'line-height',
    'letter-spacing', 'text-align', 'text-transform', 'text-decoration', 'color',
    // Sizing
    'width', 'height', 'min-width', 'max-width', 'min-height', 'max-height',
    // Layout
    'display', 'flex-direction', 'align-items', 'justify-content', 'flex-wrap',
    'position', 'top', 'right', 'bottom', 'left', 'z-index',
    // Visual
    'background-color', 'border-top-width', 'border-right-width',
    'border-bottom-width', 'border-left-width', 'border-top-style',
    'border-right-style', 'border-bottom-style', 'border-left-style',
    'border-top-color', 'border-right-color', 'border-bottom-color',
    'border-left-color', 'border-top-left-radius', 'border-top-right-radius',
    'border-bottom-right-radius', 'border-bottom-left-radius',
    'box-shadow', 'opacity', 'overflow'
  ];

  function createHighlight() {
    const el = document.createElement('div');
    el.id = '__figma-diff-highlight__';
    el.style.cssText = `
      position: fixed;
      pointer-events: none;
      z-index: 2147483647;
      border: 2px solid #4F46E5;
      background: rgba(79, 70, 229, 0.08);
      transition: all 0.05s ease-out;
      display: none;
    `;
    document.documentElement.appendChild(el);
    return el;
  }

  function createTooltip() {
    const el = document.createElement('div');
    el.id = '__figma-diff-tooltip__';
    el.style.cssText = `
      position: fixed;
      pointer-events: none;
      z-index: 2147483647;
      background: #1E1E1E;
      color: #fff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace;
      font-size: 11px;
      padding: 4px 8px;
      border-radius: 4px;
      white-space: nowrap;
      display: none;
    `;
    document.documentElement.appendChild(el);
    return el;
  }

  function getElementDescriptor(el) {
    let desc = el.tagName.toLowerCase();
    if (el.id) desc += `#${el.id}`;
    if (el.classList.length) desc += '.' + Array.from(el.classList).join('.');
    return desc;
  }

  function extractStyles(el) {
    const computed = window.getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    const styles = {};

    for (const prop of CURATED_PROPERTIES) {
      styles[prop] = computed.getPropertyValue(prop).trim();
    }

    return {
      element: getElementDescriptor(el),
      dimensions: {
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      },
      styles
    };
  }

  function onMouseMove(e) {
    const target = e.target;
    if (target === highlightEl || target === tooltipEl) return;
    if (target.id === '__figma-diff-highlight__' || target.id === '__figma-diff-tooltip__') return;

    lastTarget = target;
    const rect = target.getBoundingClientRect();

    highlightEl.style.display = 'block';
    highlightEl.style.top = rect.top + 'px';
    highlightEl.style.left = rect.left + 'px';
    highlightEl.style.width = rect.width + 'px';
    highlightEl.style.height = rect.height + 'px';

    const desc = getElementDescriptor(target);
    const dims = `${Math.round(rect.width)} x ${Math.round(rect.height)}`;
    tooltipEl.textContent = `${desc}  (${dims})`;
    tooltipEl.style.display = 'block';

    // Position tooltip above or below the element
    let tooltipTop = rect.top - 28;
    if (tooltipTop < 4) tooltipTop = rect.bottom + 4;
    tooltipEl.style.top = tooltipTop + 'px';
    tooltipEl.style.left = rect.left + 'px';
  }

  function onClick(e) {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    if (!lastTarget) return;

    // Skip iframes
    if (lastTarget.tagName === 'IFRAME') {
      return;
    }

    const data = extractStyles(lastTarget);
    chrome.runtime.sendMessage({ action: 'ELEMENT_SELECTED', data });
    deactivatePicker();
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') {
      chrome.runtime.sendMessage({ action: 'PICKER_CANCELLED' });
      deactivatePicker();
    }
  }

  function activatePicker() {
    if (pickerActive) return;
    pickerActive = true;

    highlightEl = createHighlight();
    tooltipEl = createTooltip();

    document.addEventListener('mousemove', onMouseMove, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKeyDown, true);
  }

  function deactivatePicker() {
    if (!pickerActive) return;
    pickerActive = false;
    lastTarget = null;

    document.removeEventListener('mousemove', onMouseMove, true);
    document.removeEventListener('click', onClick, true);
    document.removeEventListener('keydown', onKeyDown, true);

    if (highlightEl) { highlightEl.remove(); highlightEl = null; }
    if (tooltipEl) { tooltipEl.remove(); tooltipEl = null; }
  }

  // Listen for messages from the service worker / panel
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === 'START_PICKER') {
      activatePicker();
    } else if (msg.action === 'CANCEL_PICKER') {
      deactivatePicker();
    } else if (msg.action === 'QUERY_SELECTOR') {
      const el = document.querySelector(msg.selector);
      if (el) {
        const data = extractStyles(el);
        chrome.runtime.sendMessage({ action: 'ELEMENT_SELECTED', data });
      } else {
        chrome.runtime.sendMessage({ action: 'SELECTOR_NOT_FOUND', selector: msg.selector });
      }
    } else if (msg.action === 'BATCH_EXTRACT') {
      const MAX_BATCH = 50;
      let elements;
      if (msg.mode === 'children') {
        const parent = document.querySelector(msg.selector);
        elements = parent ? Array.from(parent.children) : [];
      } else {
        elements = Array.from(document.querySelectorAll(msg.selector));
      }

      if (elements.length === 0) {
        chrome.runtime.sendMessage({ action: 'BATCH_EMPTY', selector: msg.selector });
      } else {
        const truncated = elements.length > MAX_BATCH;
        const batch = elements.slice(0, MAX_BATCH).map(el => extractStyles(el));
        chrome.runtime.sendMessage({
          action: 'BATCH_EXTRACTED',
          data: batch,
          total: elements.length,
          truncated
        });
      }
    }
  });
})();
