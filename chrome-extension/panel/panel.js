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
  const selectorInput = document.getElementById('selector-input');
  const selectorBtn = document.getElementById('selector-btn');
  const mappingSelect = document.getElementById('mapping-select');
  const mappingLoadBtn = document.getElementById('mapping-load-btn');
  const mappingDeleteBtn = document.getElementById('mapping-delete-btn');
  const mappingSaveBtn = document.getElementById('mapping-save-btn');
  const mappingExportBtn = document.getElementById('mapping-export-btn');
  const mappingImportInput = document.getElementById('mapping-import-input');

  // --- State ---
  let extractedData = null; // { element, dimensions, styles }
  let lastDiffReport = null;
  let currentVarMap = {};    // property → { varName, fallback, original }
  let varOverrides = {};     // property → user-overridden value

  // --- Messaging ---
  const tabId = chrome.devtools.inspectedWindow.tabId;
  let port = null;

  function connectPort() {
    port = chrome.runtime.connect({ name: 'figma-diff-panel' });
    port.postMessage({ action: 'INIT', tabId });

    port.onMessage.addListener((msg) => {
      if (msg.action === 'ELEMENT_SELECTED') {
        onElementSelected(msg.data);
      } else if (msg.action === 'PICKER_CANCELLED') {
        setPickerState(false);
      } else if (msg.action === 'SELECTOR_NOT_FOUND') {
        pickStatus.textContent = `No element found for: ${msg.selector}`;
        pickStatus.classList.add('active');
      }
    });

    port.onDisconnect.addListener(() => {
      port = null;
    });
  }

  connectPort();

  function sendMessage(msg) {
    if (!port) connectPort();
    port.postMessage(msg);
  }

  // --- Pick Element ---
  pickBtn.addEventListener('click', () => {
    sendMessage({ action: 'START_PICKER' });
    setPickerState(true);
  });

  // --- Select by CSS selector ---
  function queryBySelector() {
    const selector = selectorInput.value.trim();
    if (!selector) return;
    sendMessage({ action: 'QUERY_SELECTOR', selector });
  }

  selectorBtn.addEventListener('click', queryBySelector);
  selectorInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') queryBySelector();
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
  function runComparison() {
    if (!extractedData || !figmaInput.value.trim()) return;

    const parsed = FigmaParser.parse(figmaInput.value);
    currentVarMap = parsed.varMap;

    // Apply user overrides to styles before normalizing
    const figmaStyles = { ...parsed.styles };
    for (const [prop, val] of Object.entries(varOverrides)) {
      if (prop in figmaStyles) {
        figmaStyles[prop] = val;
      }
    }

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
  }

  compareBtn.addEventListener('click', runComparison);

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

    // Build expected column with var chip if applicable
    const varInfo = currentVarMap[r.property];
    let expectedCol = '';
    if (varInfo) {
      const overridden = varOverrides[r.property];
      const displayValue = overridden || r.expected;
      expectedCol = `<span class="result-label">exp</span> `
        + `<span class="var-chip" data-prop="${escapeHtml(r.property)}" title="${escapeHtml(varInfo.original)}">${escapeHtml(varInfo.varName)}</span>`
        + ` <span class="result-value var-resolved">${escapeHtml(displayValue)}</span>`
        + colorSwatchHtml(r.property, displayValue);
    } else {
      expectedCol = `<span class="result-label">exp</span> ${expectedHtml}`;
    }

    row.innerHTML = `
      <span class="result-icon" style="color:${iconColor}">${icon}</span>
      <span class="result-prop">${r.property}${severityHtml}</span>
      <span class="result-expected">${expectedCol}</span>
      <span class="result-actual"><span class="result-label">act</span> <span class="result-value ${valueClass}">${r.actual !== null ? escapeHtml(r.actual) : 'n/a'}</span>${colorSwatchHtml(r.property, r.actual)}${noteHtml}</span>
    `;

    // Attach click handler to var chip
    const chip = row.querySelector('.var-chip');
    if (chip) {
      chip.addEventListener('click', (e) => {
        e.stopPropagation();
        openVarEditor(chip, r.property, varInfo);
      });
    }

    return row;
  }

  function openVarEditor(chip, property, varInfo) {
    // Don't open if already editing
    if (chip.parentElement.querySelector('.var-override-input')) return;

    const currentValue = varOverrides[property] || varInfo.fallback || '';
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'var-override-input';
    input.value = currentValue;
    input.placeholder = varInfo.fallback || 'value';

    // Insert after the chip
    chip.after(input);
    input.focus();
    input.select();

    const commit = () => {
      const newVal = input.value.trim();
      if (newVal && newVal !== varInfo.fallback) {
        varOverrides[property] = newVal;
      } else {
        delete varOverrides[property];
      }
      input.remove();
      runComparison();
    };

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') commit();
      if (e.key === 'Escape') input.remove();
    });
    input.addEventListener('blur', commit);
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

  // --- Variable Mappings ---
  function getSavedMappings(cb) {
    chrome.storage.local.get(['savedMappings'], (result) => {
      cb(result.savedMappings || []);
    });
  }

  function setSavedMappings(mappings, cb) {
    chrome.storage.local.set({ savedMappings: mappings }, cb);
  }

  function refreshMappingsList() {
    getSavedMappings((mappings) => {
      mappingSelect.innerHTML = '';
      if (mappings.length === 0) {
        mappingSelect.innerHTML = '<option value="">-- No saved mappings --</option>';
      } else {
        mappingSelect.innerHTML = '<option value="">-- Select mapping --</option>';
        for (const m of mappings) {
          const opt = document.createElement('option');
          opt.value = m.name;
          opt.textContent = m.name;
          mappingSelect.appendChild(opt);
        }
      }
      updateMappingButtons();
    });
  }

  function updateMappingButtons() {
    const hasSelection = mappingSelect.value !== '';
    mappingLoadBtn.disabled = !hasSelection;
    mappingDeleteBtn.disabled = !hasSelection;
    mappingExportBtn.disabled = !hasSelection;
  }

  mappingSelect.addEventListener('change', updateMappingButtons);

  mappingSaveBtn.addEventListener('click', () => {
    if (Object.keys(varOverrides).length === 0) {
      alert('No variable overrides to save. Edit a CSS variable first.');
      return;
    }
    const name = prompt('Mapping name:');
    if (!name || !name.trim()) return;
    const trimmed = name.trim();

    getSavedMappings((mappings) => {
      const existing = mappings.findIndex(m => m.name === trimmed);
      const entry = {
        name: trimmed,
        created: new Date().toISOString(),
        overrides: { ...varOverrides }
      };
      if (existing >= 0) {
        mappings[existing] = entry;
      } else {
        mappings.push(entry);
      }
      setSavedMappings(mappings, () => {
        refreshMappingsList();
        mappingSelect.value = trimmed;
        updateMappingButtons();
      });
    });
  });

  mappingLoadBtn.addEventListener('click', () => {
    const name = mappingSelect.value;
    if (!name) return;
    getSavedMappings((mappings) => {
      const entry = mappings.find(m => m.name === name);
      if (!entry) return;
      varOverrides = { ...entry.overrides };
      if (extractedData && figmaInput.value.trim()) {
        runComparison();
      }
    });
  });

  mappingDeleteBtn.addEventListener('click', () => {
    const name = mappingSelect.value;
    if (!name) return;
    if (!confirm(`Delete mapping "${name}"?`)) return;
    getSavedMappings((mappings) => {
      const filtered = mappings.filter(m => m.name !== name);
      setSavedMappings(filtered, refreshMappingsList);
    });
  });

  mappingExportBtn.addEventListener('click', () => {
    const name = mappingSelect.value;
    if (!name) return;
    getSavedMappings((mappings) => {
      const entry = mappings.find(m => m.name === name);
      if (!entry) return;
      const blob = new Blob([JSON.stringify(entry, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${name.replace(/[^a-z0-9_-]/gi, '_')}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });
  });

  mappingImportInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!data.name || !data.overrides || typeof data.overrides !== 'object') {
          alert('Invalid mapping file. Expected { name, overrides }.');
          return;
        }
        getSavedMappings((mappings) => {
          const existing = mappings.findIndex(m => m.name === data.name);
          const entry = {
            name: data.name,
            created: data.created || new Date().toISOString(),
            overrides: data.overrides
          };
          if (existing >= 0) {
            mappings[existing] = entry;
          } else {
            mappings.push(entry);
          }
          setSavedMappings(mappings, () => {
            refreshMappingsList();
            mappingSelect.value = data.name;
            updateMappingButtons();
          });
        });
      } catch {
        alert('Failed to parse JSON file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  });

  // Load mappings list on startup
  refreshMappingsList();

  // --- Clear ---
  clearBtn.addEventListener('click', () => {
    extractedData = null;
    lastDiffReport = null;
    currentVarMap = {};
    varOverrides = {};
    figmaInput.value = '';
    extractedStyles.textContent = 'Pick an element to extract styles.';
    elementInfo.classList.add('hidden');
    resultsSection.classList.add('hidden');
    resultsSummary.innerHTML = '';
    resultsList.innerHTML = '';
    compareBtn.disabled = true;
  });
})();
