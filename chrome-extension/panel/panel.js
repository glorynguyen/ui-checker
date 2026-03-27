// Panel logic — UI state, wiring to diff engine, result display.

(function () {
  // --- DOM refs ---
  const pickBtn = document.getElementById('pick-btn');
  const pickStatus = document.getElementById('pick-status');
  const settingsBtn = document.getElementById('settings-btn');
  const settingsPanel = document.getElementById('settings-panel');
  const elementInfo = document.getElementById('element-info');
  const elementName = document.getElementById('element-name');
  const elementDims = document.getElementById('element-dims');
  const figmaInput = document.getElementById('figma-input');
  const extractedStyles = document.getElementById('extracted-styles');
  const compareBtn = document.getElementById('compare-btn');
  const resultsSection = document.getElementById('results-section');
  const resultsSummary = document.getElementById('results-summary');
  const resultsList = document.getElementById('results-list');
  const copyBtn = document.getElementById('copy-btn');
  const clearBtn = document.getElementById('clear-btn');

  // --- State ---
  let extractedData = null; // { element, dimensions, styles }
  let lastDiffReport = null;

  // --- Messaging ---
  const port = chrome.runtime.connect({ name: 'figma-diff-panel' });
  port.postMessage({ action: 'INIT', tabId: chrome.devtools.inspectedWindow.tabId });

  port.onMessage.addListener((msg) => {
    if (msg.action === 'ELEMENT_SELECTED') {
      onElementSelected(msg.data);
    } else if (msg.action === 'PICKER_CANCELLED') {
      setPickerState(false);
    }
  });

  // --- Pick Element ---
  pickBtn.addEventListener('click', () => {
    port.postMessage({ action: 'START_PICKER' });
    setPickerState(true);
  });

  function setPickerState(active) {
    if (active) {
      pickBtn.disabled = true;
      pickStatus.textContent = 'Click an element on the page... (Esc to cancel)';
      pickStatus.classList.add('active');
    } else {
      pickBtn.disabled = false;
      pickStatus.textContent = '';
      pickStatus.classList.remove('active');
    }
  }

  function onElementSelected(data) {
    setPickerState(false);
    extractedData = data;

    elementInfo.classList.remove('hidden');
    elementName.textContent = data.element;
    elementDims.textContent = `${data.dimensions.width} x ${data.dimensions.height}`;

    // Display extracted styles
    const lines = Object.entries(data.styles)
      .map(([k, v]) => `${k}: ${v};`)
      .join('\n');
    extractedStyles.textContent = lines;

    updateCompareBtn();
  }

  // --- Figma input ---
  figmaInput.addEventListener('input', updateCompareBtn);

  function updateCompareBtn() {
    compareBtn.disabled = !(extractedData && figmaInput.value.trim());
  }

  // --- Settings ---
  settingsBtn.addEventListener('click', () => {
    settingsPanel.classList.toggle('hidden');
  });

  function getTolerance() {
    return {
      spacing: parseInt(document.getElementById('tol-spacing').value) || 2,
      color: parseInt(document.getElementById('tol-color').value) || 5,
      borderRadius: parseInt(document.getElementById('tol-radius').value) || 2
    };
  }

  // Load saved settings
  if (chrome.storage) {
    chrome.storage.local.get(['tolerance'], (result) => {
      if (result.tolerance) {
        document.getElementById('tol-spacing').value = result.tolerance.spacing ?? 2;
        document.getElementById('tol-color').value = result.tolerance.color ?? 5;
        document.getElementById('tol-radius').value = result.tolerance.borderRadius ?? 2;
      }
    });
  }

  // Save settings on change
  settingsPanel.addEventListener('change', () => {
    const tol = getTolerance();
    if (chrome.storage) {
      chrome.storage.local.set({ tolerance: tol });
    }
  });

  // --- Compare ---
  compareBtn.addEventListener('click', () => {
    if (!extractedData || !figmaInput.value.trim()) return;

    const figmaStyles = FigmaParser.parse(figmaInput.value);
    const normalizedFigma = Normalizer.normalize(figmaStyles);
    const normalizedBrowser = Normalizer.normalize(extractedData.styles);

    const tolerance = getTolerance();
    const report = DiffEngine.compare(normalizedFigma, normalizedBrowser, tolerance);

    lastDiffReport = {
      ...report,
      element: extractedData.element,
      dimensions: extractedData.dimensions
    };

    renderResults(report);
  });

  // --- Render results ---
  function renderResults(report) {
    resultsSection.classList.remove('hidden');

    // Summary
    const s = report.summary;
    resultsSummary.innerHTML = `
      <span class="stat stat-matched">${s.matched}/${s.total} matched</span>
      <span class="stat stat-mismatched">${s.mismatched} mismatched</span>
      <span class="stat stat-missing">${s.missing} missing</span>
    `;

    // Build result list
    resultsList.innerHTML = '';

    // Sort: mismatches first (major > minor), then missing, then matches
    const severityOrder = { major: 0, minor: 1, negligible: 2 };
    const statusOrder = { mismatch: 0, missing: 1, match: 2 };

    const sorted = [...report.results].sort((a, b) => {
      const sa = statusOrder[a.status] ?? 3;
      const sb = statusOrder[b.status] ?? 3;
      if (sa !== sb) return sa - sb;
      const sevA = severityOrder[a.severity] ?? 3;
      const sevB = severityOrder[b.severity] ?? 3;
      return sevA - sevB;
    });

    // Group by property group
    const mismatches = sorted.filter(r => r.status === 'mismatch' || r.status === 'missing');
    const matches = sorted.filter(r => r.status === 'match');

    // Render mismatches by group
    if (mismatches.length > 0) {
      const grouped = groupByPropertyGroup(mismatches);
      for (const [group, items] of Object.entries(grouped)) {
        const groupEl = document.createElement('div');
        groupEl.className = 'result-group';
        groupEl.innerHTML = `<div class="result-group-header">${group}</div>`;
        items.forEach(r => groupEl.appendChild(createResultRow(r)));
        resultsList.appendChild(groupEl);
      }
    }

    // Render matches (collapsible)
    if (matches.length > 0) {
      const toggle = document.createElement('button');
      toggle.className = 'matched-toggle';
      toggle.innerHTML = `<span class="arrow">&#9654;</span> ${matches.length} matched properties`;
      const content = document.createElement('div');
      content.className = 'matched-content';

      const grouped = groupByPropertyGroup(matches);
      for (const [group, items] of Object.entries(grouped)) {
        const groupEl = document.createElement('div');
        groupEl.className = 'result-group';
        groupEl.innerHTML = `<div class="result-group-header">${group}</div>`;
        items.forEach(r => groupEl.appendChild(createResultRow(r)));
        content.appendChild(groupEl);
      }

      toggle.addEventListener('click', () => {
        toggle.classList.toggle('open');
        content.classList.toggle('open');
      });

      resultsList.appendChild(toggle);
      resultsList.appendChild(content);
    }
  }

  function groupByPropertyGroup(items) {
    const groups = {};
    for (const item of items) {
      const group = StyleExtractor.getPropertyGroup(item.property);
      if (!groups[group]) groups[group] = [];
      groups[group].push(item);
    }
    return groups;
  }

  function createResultRow(r) {
    const row = document.createElement('div');
    row.className = 'result-row';

    const icon = r.status === 'match' ? '&#10003;' :
                 r.status === 'missing' ? '&#9888;' : '&#10007;';
    const iconColor = r.status === 'match' ? 'var(--green)' :
                      r.status === 'missing' ? 'var(--orange)' : 'var(--red)';

    let expectedHtml = formatValue(r.property, r.expected);
    let actualHtml = r.actual !== null ? formatValue(r.property, r.actual) : '<span class="result-value missing">n/a</span>';

    let severityHtml = '';
    if (r.severity && r.status !== 'match') {
      severityHtml = `<span class="severity-badge severity-${r.severity}">${r.severity}</span>`;
    }

    let noteHtml = r.note ? `<span class="result-note">(${r.note})</span>` : '';

    const valueClass = r.status === 'match' ? 'match' :
                       r.status === 'missing' ? 'missing' : 'mismatch';

    row.innerHTML = `
      <span class="result-icon" style="color:${iconColor}">${icon}</span>
      <span class="result-prop">${r.property}${severityHtml}</span>
      <span class="result-expected"><span class="result-label">exp</span> ${expectedHtml}</span>
      <span class="result-actual"><span class="result-label">act</span> <span class="result-value ${valueClass}">${r.actual !== null ? r.actual : 'n/a'}</span>${colorSwatchHtml(r.property, r.actual)}${noteHtml}</span>
    `;

    return row;
  }

  function formatValue(property, value) {
    let swatch = colorSwatchHtml(property, value);
    return `<span class="result-value">${escapeHtml(value)}</span>${swatch}`;
  }

  function colorSwatchHtml(property, value) {
    if (!value) return '';
    const isColor = property === 'color' || property === 'background-color' ||
                    (property.includes('border') && property.includes('color'));
    if (!isColor) return '';
    return ` <span class="color-swatch" style="background:${escapeHtml(value)}"></span>`;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // --- Copy Report ---
  copyBtn.addEventListener('click', () => {
    if (!lastDiffReport) return;

    const r = lastDiffReport;
    const mismatches = r.results.filter(x => x.status === 'mismatch' || x.status === 'missing');
    const matched = r.results.filter(x => x.status === 'match');

    let md = `## Style Diff Report\n`;
    md += `**Element:** \`${r.element}\` (${r.dimensions.width} x ${r.dimensions.height})\n`;
    md += `**Date:** ${new Date().toISOString().slice(0, 10)}\n\n`;

    if (mismatches.length > 0) {
      md += `### Mismatches (${mismatches.length})\n`;
      md += `| Property | Expected (Figma) | Actual (Browser) | Severity |\n`;
      md += `|----------|-----------------|------------------|----------|\n`;
      for (const m of mismatches) {
        md += `| ${m.property} | ${m.expected} | ${m.actual ?? 'n/a'} | ${m.severity} |\n`;
      }
      md += '\n';
    }

    md += `### Matched: ${matched.length}/${r.summary.total} properties\n`;

    navigator.clipboard.writeText(md).then(() => {
      copyBtn.textContent = 'Copied!';
      setTimeout(() => { copyBtn.textContent = 'Copy Report'; }, 1500);
    });
  });

  // --- Clear ---
  clearBtn.addEventListener('click', () => {
    extractedData = null;
    lastDiffReport = null;
    figmaInput.value = '';
    extractedStyles.textContent = 'Pick an element to extract styles.';
    elementInfo.classList.add('hidden');
    resultsSection.classList.add('hidden');
    resultsSummary.innerHTML = '';
    resultsList.innerHTML = '';
    compareBtn.disabled = true;
  });
})();
