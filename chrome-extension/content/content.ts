// Content script: Element picker + style extraction
// Injected into every page. Activates picker on message from panel.

(function () {
  let pickerActive = false;
  let highlightEl: HTMLElement | null = null;
  let tooltipEl: HTMLElement | null = null;
  let lastTarget: HTMLElement | null = null;
  let selectedElement: HTMLElement | null = null; // Persists after picker deactivates

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

  function getElementDescriptor(el: HTMLElement) {
    let desc = el.tagName.toLowerCase();
    if (el.id) desc += `#${el.id}`;
    if (el.classList.length) desc += '.' + Array.from(el.classList).join('.');
    return desc;
  }

  // Walk up the DOM and collect up to MAX descriptors for ancestors that carry
  // an id or at least one class. Bare-tag ancestors (e.g. a plain <div>) are
  // skipped because they add no disambiguation signal — only structural noise.
  function collectAncestors(el: HTMLElement, max = 2): string[] {
    const out: string[] = [];
    let cur = el.parentElement;
    while (cur && out.length < max && cur !== document.documentElement) {
      if (cur.id || cur.classList.length) {
        out.push(getElementDescriptor(cur));
      }
      cur = cur.parentElement;
    }
    return out;
  }

  // Walk up the DOM (capped) to find the nearest element with a ui-checker
  // source-location attribute. The clicked target is often a leaf primitive
  // that React's dev runtime did not stamp directly; the wrapping component's
  // host node typically carries the attribute.
  function findNearestSourceLoc(el: HTMLElement, maxHops = 8): { sourceLoc: string | null; sourceName: string | null } {
    let cur: HTMLElement | null = el;
    let hops = 0;
    while (cur && hops < maxHops) {
      const loc = cur.getAttribute('data-uic-loc');
      if (loc) {
        return { sourceLoc: loc, sourceName: cur.getAttribute('data-uic-name') };
      }
      cur = cur.parentElement;
      hops++;
    }
    return { sourceLoc: null, sourceName: null };
  }

  function extractStyles(el: HTMLElement) {
    const computed = window.getComputedStyle(el);
    const rootComputed = window.getComputedStyle(document.documentElement);
    const rect = el.getBoundingClientRect();
    const styles: Record<string, string> = {};

    for (const prop of CURATED_PROPERTIES) {
      styles[prop] = computed.getPropertyValue(prop).trim();
    }

    const { sourceLoc, sourceName } = findNearestSourceLoc(el);

    return {
      element: getElementDescriptor(el),
      ancestors: collectAncestors(el),
      classList: Array.from(el.classList).join(' '),
      figmaId: el.dataset.figmaId || el.getAttribute('data-figma-id') || null,
      sourceLoc,
      sourceName,
      rootFontSize: parseFloat(rootComputed.fontSize) || 16,
      dimensions: {
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      },
      styles
    };
  }

  function onMouseMove(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (target === highlightEl || target === tooltipEl) return;
    if (target.id === '__figma-diff-highlight__' || target.id === '__figma-diff-tooltip__') return;

    lastTarget = target;
    const rect = target.getBoundingClientRect();

    if (highlightEl) {
      highlightEl.style.display = 'block';
      highlightEl.style.top = rect.top + 'px';
      highlightEl.style.left = rect.left + 'px';
      highlightEl.style.width = rect.width + 'px';
      highlightEl.style.height = rect.height + 'px';
    }

    if (tooltipEl) {
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
  }

  function onClick(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    if (!lastTarget) return;

    // Skip iframes
    if (lastTarget.tagName === 'IFRAME') {
      return;
    }

    selectedElement = lastTarget;
    const data = extractStyles(lastTarget);
    chrome.runtime.sendMessage({ action: 'ELEMENT_SELECTED', data });
    deactivatePicker();
  }

  function onKeyDown(e: KeyboardEvent) {
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
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === 'START_PICKER') {
      activatePicker();
    } else if (msg.action === 'CANCEL_PICKER') {
      deactivatePicker();
    } else if (msg.action === 'QUERY_SELECTOR') {
      const el = document.querySelector(msg.selector) as HTMLElement | null;
      if (el) {
        selectedElement = el;
        const data = extractStyles(el);
        chrome.runtime.sendMessage({ action: 'ELEMENT_SELECTED', data });
      } else {
        chrome.runtime.sendMessage({ action: 'SELECTOR_NOT_FOUND', selector: msg.selector });
      }
    } else if (msg.action === 'GET_ELEMENT_RECT') {
      // Return the bounding rect via sendResponse
      console.log('[Content] GET_ELEMENT_RECT, selector:', msg.selector, 'selectedElement:', !!selectedElement, 'lastTarget:', !!lastTarget);
      let target: HTMLElement | null = selectedElement || lastTarget;
      if (msg.selector) {
        const queried = document.querySelector(msg.selector) as HTMLElement | null;
        console.log('[Content] querySelector result:', !!queried, 'for selector:', msg.selector);
        target = queried || target;
      }
      if (target) {
        const rect = target.getBoundingClientRect();
        console.log('[Content] Sending rect:', { viewportX: Math.round(rect.left), viewportY: Math.round(rect.top), width: Math.round(rect.width), height: Math.round(rect.height) }, 'dpr:', window.devicePixelRatio);
        sendResponse({
          rect: {
            x: Math.round(rect.left + window.scrollX),
            y: Math.round(rect.top + window.scrollY),
            viewportX: Math.round(rect.left),
            viewportY: Math.round(rect.top),
            width: Math.round(rect.width),
            height: Math.round(rect.height)
          },
          devicePixelRatio: window.devicePixelRatio || 1
        });
      } else {
        console.warn('[Content] No target element found for GET_ELEMENT_RECT');
        sendResponse({ error: true });
      }
      return true; // Keep message channel open for sendResponse
    }
  });
})();
