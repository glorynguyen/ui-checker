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
  const resultsFilter = document.getElementById('results-filter');

  // --- State ---
  let extractedData = null; // { element, dimensions, styles }
  let lastDiffReport = null;
  let currentVarMap = {};    // property → { varName, fallback, original }
  let varOverrides = {};     // property → user-overridden value



  // --- Messaging ---
  const tabId = chrome.devtools.inspectedWindow.tabId;
  let port = null;

  function connectPort() {
    try {
      port = chrome.runtime.connect({ name: 'panel' });
      port.postMessage({ action: 'INIT', tabId });
    } catch (e) {
      if (checkContext(e)) return;
      console.error('[Panel] connectPort failed:', e);
    }
    if (port) {
      port.onMessage.addListener((msg) => {
      console.log('[Panel] Port message received:', msg.action);
      
      // New: Handle MCP responses
      const statusEl = document.getElementById('mcp-status');
      if (msg.action === 'MCP_CONNECTED') {
        statusEl.textContent = 'Connected';
        statusEl.className = 'status-badge connected';
      } else if (msg.action === 'MCP_CONNECTION_FAILED') {
        statusEl.textContent = msg.error || 'Connection failed';
        statusEl.className = 'status-badge error';
      } else if (msg.action === 'MCP_NODE_FETCH_FAILED') {
        alert('Figma Fetch Error: ' + msg.error);
        mcpFetchBtn.disabled = false;
        mcpFetchBtn.textContent = 'Fetch';
      } else if (msg.action === 'MCP_NODE_DATA') {
        console.log('[Panel] Received MCP Node Data:', msg.data);
        figmaInput.value = JSON.stringify(msg.data, null, 2);
        mcpFetchBtn.disabled = false;
        mcpFetchBtn.textContent = 'Fetch';
        updateCompareBtn();
      } else if (msg.action === 'MCP_IMAGE_DATA') {
        console.log('[Panel] Received MCP Image URL:', msg.imageUrl);
        loadFigmaImageUrl(msg.imageUrl);
      } else if (msg.action === 'MCP_IMAGE_FETCH_FAILED') {
        console.warn('[Panel] Figma visual fetch failed:', msg.error);
        // Silently fail or show a subtle hint that visual overlay won't auto-load
      } else if (msg.action === 'FIGMA_TAB_SYNCED') {
        if (msg.url) {
          const parsed = parseFigmaUrl(msg.url);
          if (parsed) {
            if (parsed.fileKey) {
              mcpFileKeyInput.value = parsed.fileKey;
              // Save config
              chrome.storage.local.get(['figmaConfig'], (res) => {
                const newConfig = { ...(res.figmaConfig || {}), fileKey: parsed.fileKey };
                chrome.storage.local.set({ figmaConfig: newConfig });
              });
            }
            if (parsed.nodeId) {
              mcpNodeIdInput.value = parsed.nodeId;
            }
            console.log('[Panel] Synced from Figma tab:', parsed);
          }
        }
      } else if (msg.action === 'FIGMA_TAB_SYNC_FAILED') {
        alert('Figma Tab Sync Error: ' + msg.error);
      } else if (msg.action === 'ELEMENT_CAPTURED') {
        onElementCaptured(msg);
      } else if (msg.action === 'ELEMENT_CAPTURE_FAILED') {
        onElementCaptureFailed(msg);
      }

      if (msg.action === 'ELEMENT_SELECTED') {
        onElementSelected(msg.data);
      } 

    });

    port.onDisconnect.addListener(() => {
      console.log('[Panel] Port disconnected');
      port = null;
    });
    }
  }

  // Figma API connection
  function connectToFigma(token) {
    sendMessage({ action: 'FIGMA_CONNECT', token });
  }

  function parseFigmaUrl(url) {
    try {
      const u = new URL(url);
      const pathParts = u.pathname.split('/');
      // /design/:key/:title or /file/:key/:title
      const keyIdx = pathParts.findIndex(p => p === 'design' || p === 'file') + 1;
      const fileKey = pathParts[keyIdx];
      const nodeId = u.searchParams.get('node-id');
      return { fileKey, nodeId };
    } catch (e) {
      return null;
    }
  }

  function fetchFigmaNode(inputId) {
    let nodeId = inputId;
    let fileKey = mcpFileKeyInput.value.trim();

    // Check if input is a URL
    if (nodeId.includes('figma.com')) {
      const parsed = parseFigmaUrl(nodeId);
      if (parsed) {
        if (parsed.fileKey) {
          fileKey = parsed.fileKey;
          mcpFileKeyInput.value = fileKey;
          // Auto-save key if parsed from URL
          if (chrome.storage) {
            chrome.storage.local.get(['figmaConfig'], (res) => {
                const newConfig = { ...(res.figmaConfig || {}), fileKey };
                chrome.storage.local.set({ figmaConfig: newConfig });
            });
          }
        }
        if (parsed.nodeId) {
          nodeId = parsed.nodeId;
          mcpNodeIdInput.value = nodeId;
        }
      }
    }

    if (!fileKey) {
        alert('Please enter a Figma File Key in settings or paste a full Figma URL.');
        return;
    }
    sendMessage({ action: 'MCP_GET_NODE', nodeId, fileKey });
    sendMessage({ action: 'MCP_GET_IMAGE', nodeId, fileKey });
  }

  function loadFigmaImageUrl(url) {
    figmaImage = url;
    // Show preview thumb in drop zone
    figmaDropZone.classList.add('has-image');
    figmaDropZone.textContent = '';
    const img = document.createElement('img');
    img.src = figmaImage;
    img.className = 'preview-thumb';
    img.alt = 'Figma design';
    figmaDropZone.appendChild(img);
    
    // Show visual overlay section
    const os = document.getElementById('overlay-section');
    if (os) os.classList.remove('hidden');
    
    renderOverlay();
  }

  connectPort();
  

  function sendMessage(msg) {
    // MV3 service workers go idle after ~30s. Reconnect if null or disconnected.
    if (!port) {
      console.log('[Panel] Port is null, reconnecting before send');
      connectPort();
    }
    
    try {
      port.postMessage(msg);
      console.log('[Panel] postMessage sent:', msg.action);
    } catch (e) {
      if (checkContext(e)) return;
      console.warn('[Panel] postMessage failed, reconnecting:', e.message);
      try {
          connectPort();
          port.postMessage(msg);
      } catch (e2) {
          console.error('[Panel] Critical port failure:', e2);
      }
    }
  }

  function checkContext(e) {
    if (e.message && e.message.includes('context invalidated')) {
      console.error('[Panel] Extension context invalidated. Please reload the extension and DevTools.');
      alert('Extension context invalidated. This usually happens after an extension update. Please reload the extension and the DevTools panel.');
      return true;
    }
    return false;
  }

  // --- Figma API Configuration ---
  const mcpConnectBtn = document.getElementById('mcp-connect-btn');
  const mcpFetchBtn = document.getElementById('mcp-fetch-btn');
  const mcpSyncBtn = document.getElementById('mcp-sync-btn');
  const mcpTokenInput = document.getElementById('mcp-token');
  const mcpFileKeyInput = document.getElementById('figma-file-key');
  const mcpNodeIdInput = document.getElementById('mcp-node-id');

  mcpConnectBtn.addEventListener('click', () => {
    const token = mcpTokenInput.value.trim();
    const fileKey = mcpFileKeyInput.value.trim();
    if (token) {
        connectToFigma(token);
        // Save config
        if (chrome.storage) {
            chrome.storage.local.set({ figmaConfig: { token, fileKey } });
        }
    }
  });

  mcpSyncBtn.addEventListener('click', () => {
    sendMessage({ action: 'SYNC_FIGMA_TAB' });
  });

  mcpFetchBtn.addEventListener('click', () => {
    const nodeId = mcpNodeIdInput.value.trim();
    if (nodeId) {
        mcpFetchBtn.disabled = true;
        mcpFetchBtn.textContent = 'Fetching...';
        fetchFigmaNode(nodeId);
    }
  });

  // Load saved Figma config
  if (chrome.storage) {
    chrome.storage.local.get(['figmaConfig'], (result) => {
      const config = result.figmaConfig || {};

      if (mcpTokenInput) mcpTokenInput.value = config.token || '';
      if (mcpFileKeyInput) mcpFileKeyInput.value = config.fileKey || '';

      // Auto-connect if token exists
      if (config.token) {
          connectToFigma(config.token);
      }
    });
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

  selectorBtn.addEventListener('click', () => queryBySelector());
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

    // Auto-fetch if Figma ID exists
    if (data.figmaId) {
        document.getElementById('mcp-node-id').value = data.figmaId;
        fetchFigmaNode(data.figmaId);
    }

    // Display extracted styles
    const lines = Object.entries(data.styles)
      .map(([k, v]) => `${k}: ${v};`)
      .join('\n');
    extractedStyles.textContent = lines;

    updateCompareBtn();

    // Show visual overlay section (Phase 2)
    const os = document.getElementById('overlay-section');
    if (os) {
        os.classList.remove('hidden');
        // Auto-capture the element for visual overlay
        console.log('[Panel] Auto-capturing element for visual overlay');
        sendMessage({ action: 'CAPTURE_ELEMENT', selector: data.element });
    }
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
    const s = parseInt(document.getElementById('tol-spacing').value);
    const c = parseInt(document.getElementById('tol-color').value);
    const r = parseInt(document.getElementById('tol-radius').value);

    return {
      spacing: isNaN(s) ? 2 : s,
      color: isNaN(c) ? 5 : c,
      borderRadius: isNaN(r) ? 2 : r
    };
  }

  // Load saved settings
  if (chrome.storage) {
    chrome.storage.local.get(['tolerance'], (result) => {
      if (result.tolerance) {
        if (result.tolerance.spacing !== undefined) document.getElementById('tol-spacing').value = result.tolerance.spacing;
        if (result.tolerance.color !== undefined) document.getElementById('tol-color').value = result.tolerance.color;
        if (result.tolerance.borderRadius !== undefined) document.getElementById('tol-radius').value = result.tolerance.borderRadius;
      }
    });
  }

  // Save settings on change
  settingsPanel.addEventListener('change', () => {
    const tol = getTolerance();
    if (chrome.storage) {
      try {
        chrome.storage.local.set({ tolerance: tol });
      } catch (e) {
        checkContext(e);
      }
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

  compareBtn.addEventListener('click', () => runComparison());

  // --- Filter results ---
  resultsFilter.addEventListener('input', () => {
    if (lastDiffReport) renderResults(lastDiffReport);
  });

  // --- Render results ---
  function appendStat(parent, label, value, valueClass) {
    const stat = document.createElement('div');
    stat.className = 'stat';
    
    const labelEl = document.createElement('span');
    labelEl.className = 'stat-label';
    labelEl.textContent = label;
    
    const valueEl = document.createElement('span');
    valueEl.className = `stat-value ${valueClass}`;
    valueEl.textContent = value;
    
    stat.appendChild(labelEl);
    stat.appendChild(valueEl);
    parent.appendChild(stat);
  }

  function renderResults(report) {
    resultsSection.classList.remove('hidden');

    // Summary
    const s = report.summary;
    resultsSummary.textContent = '';
    appendStat(resultsSummary, 'Matched', s.matched, 'stat-matched');
    appendStat(resultsSummary, 'Mismatched', s.mismatched, 'stat-mismatched');
    appendStat(resultsSummary, 'Missing', s.missing, 'stat-missing');

    // Build result list
    resultsList.textContent = '';

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

    // Apply filter
    const filterText = resultsFilter.value.trim().toLowerCase();
    const filtered = filterText
      ? sorted.filter(r => r.property.toLowerCase().includes(filterText))
      : sorted;

    // Group by property group
    const mismatches = filtered.filter(r => r.status === 'mismatch' || r.status === 'missing');
    const matches = filtered.filter(r => r.status === 'match');

    // Render mismatches by group
    if (mismatches.length > 0) {
      const grouped = groupByPropertyGroup(mismatches);
      for (const [group, items] of Object.entries(grouped)) {
        const groupEl = document.createElement('div');
        groupEl.className = 'result-group';
        
        const header = document.createElement('div');
        header.className = 'result-group-header';
        header.textContent = group;
        groupEl.appendChild(header);

        items.forEach(r => groupEl.appendChild(createResultRow(r)));
        resultsList.appendChild(groupEl);
      }
    }

    // Render matches (collapsible)
    if (matches.length > 0) {
      const toggle = document.createElement('button');
      toggle.className = 'matched-toggle';
      
      const arrow = document.createElement('span');
      arrow.className = 'arrow';
      arrow.textContent = '\u25B6'; // arrow right
      
      toggle.appendChild(arrow);
      toggle.appendChild(document.createTextNode(` ${matches.length} matched properties`));

      const content = document.createElement('div');
      content.className = 'matched-content';

      const grouped = groupByPropertyGroup(matches);
      for (const [group, items] of Object.entries(grouped)) {
        const groupEl = document.createElement('div');
        groupEl.className = 'result-group';
        
        const header = document.createElement('div');
        header.className = 'result-group-header';
        header.textContent = group;
        groupEl.appendChild(header);

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

    const icon = document.createElement('span');
    icon.className = 'result-icon';
    icon.style.color = r.status === 'match' ? 'var(--green)' : r.status === 'missing' ? 'var(--orange)' : 'var(--red)';
    icon.textContent = r.status === 'match' ? '\u2713' : r.status === 'missing' ? '\u26A0' : '\u2717';
    row.appendChild(icon);

    const prop = document.createElement('span');
    prop.className = 'result-prop';
    prop.textContent = r.property;
    if (r.severity && r.status !== 'match') {
      const sev = document.createElement('span');
      sev.className = `severity-badge severity-${r.severity}`;
      sev.textContent = r.severity;
      prop.appendChild(sev);
    }
    row.appendChild(prop);

    const expectedCol = document.createElement('span');
    expectedCol.className = 'result-expected';
    
    const varInfo = currentVarMap[r.property];
    if (varInfo) {
      const overridden = varOverrides[r.property];
      const displayValue = overridden || r.expected;
      
      const label = document.createElement('span');
      label.className = 'result-label';
      label.textContent = 'exp';
      expectedCol.appendChild(label);

      const chip = document.createElement('span');
      chip.className = 'var-chip';
      chip.title = varInfo.original;
      chip.textContent = varInfo.varName;
      chip.addEventListener('click', (e) => {
        e.stopPropagation();
        openVarEditor(chip, r.property, varInfo);
      });
      expectedCol.appendChild(chip);

      const val = document.createElement('span');
      val.className = 'result-value var-resolved';
      val.textContent = displayValue;
      expectedCol.appendChild(val);
      expectedCol.appendChild(createColorSwatch(r.property, displayValue));
    } else {
      const label = document.createElement('span');
      label.className = 'result-label';
      label.textContent = 'exp';
      expectedCol.appendChild(label);
      expectedCol.appendChild(createValueElement(r.expected, ''));
    }
    row.appendChild(expectedCol);

    const actualCol = document.createElement('span');
    actualCol.className = 'result-actual';
    
    const actLabel = document.createElement('span');
    actLabel.className = 'result-label';
    actLabel.textContent = 'act';
    actualCol.appendChild(actLabel);

    if (r.actual !== null) {
      const val = document.createElement('span');
      val.className = `result-value ${r.status === 'match' ? 'match' : 'mismatch'}`;
      val.textContent = r.actual;
      actualCol.appendChild(val);
      actualCol.appendChild(createColorSwatch(r.property, r.actual));
      if (r.note) {
        const note = document.createElement('span');
        note.className = 'result-note';
        note.textContent = `(${r.note})`;
        actualCol.appendChild(note);
      }
      if (r.status === 'mismatch') {
        const fixBtn = document.createElement('button');
        fixBtn.className = 'btn btn-xs copy-fix-btn';
        fixBtn.textContent = 'Fix';
        fixBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          navigator.clipboard.writeText(`${r.property}: ${r.expected};`).then(() => {
            fixBtn.textContent = 'Copied!';
            fixBtn.classList.add('btn-success');
            setTimeout(() => { fixBtn.textContent = 'Fix'; fixBtn.classList.remove('btn-success'); }, 1000);
          });
        });
        actualCol.appendChild(fixBtn);
      }
    } else {
      const nA = document.createElement('span');
      nA.className = 'result-value missing';
      nA.textContent = 'n/a';
      actualCol.appendChild(nA);
    }
    row.appendChild(actualCol);

    return row;
  }

  function createValueElement(value, className) {
    const el = document.createElement('span');
    el.className = 'result-value ' + className;
    el.textContent = value;
    return el;
  }

  function createColorSwatch(property, value) {
    const el = document.createElement('span');
    if (!value) return el;
    const isColor = property === 'color' || property === 'background-color' || (property.includes('border') && property.includes('color'));
    if (isColor) {
      el.className = 'color-swatch';
      el.style.backgroundColor = value;
    }
    return el;
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
    currentVarMap = {};
    varOverrides = {};
    figmaInput.value = '';
    extractedStyles.textContent = 'Pick an element to extract styles.';
    elementInfo.classList.add('hidden');
    resultsSection.classList.add('hidden');
    resultsSummary.textContent = '';
    resultsList.textContent = '';
    resultsFilter.value = '';
    compareBtn.disabled = true;
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
      mappingSelect.textContent = '';
      const defaultOpt = document.createElement('option');
      defaultOpt.value = '';
      defaultOpt.textContent = mappings.length === 0 ? '-- No saved mappings --' : '-- Select mapping --';
      mappingSelect.appendChild(defaultOpt);
      
      for (const m of mappings) {
        const opt = document.createElement('option');
        opt.value = m.name;
        opt.textContent = m.name;
        mappingSelect.appendChild(opt);
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

  // =====================================================
  // Phase 2 — Visual Overlay Comparison
  // =====================================================

  const overlaySection = document.getElementById('overlay-section');
  const overlayCaptureBtn = document.getElementById('overlay-capture-btn');
  const figmaDropZone = document.getElementById('figma-drop-zone');
  const figmaImageInput = document.getElementById('figma-image-input');
  const overlaySliderRow = document.getElementById('overlay-slider-row');
  const overlayOpacity = document.getElementById('overlay-opacity');
  const overlayOpacityVal = document.getElementById('overlay-opacity-val');
  const diffThresholdRow = document.getElementById('diff-threshold-row');
  const diffThreshold = document.getElementById('diff-threshold');
  const diffThresholdVal = document.getElementById('diff-threshold-val');
  const overlayCanvasArea = document.getElementById('overlay-canvas-area');
  const overlayCanvas = document.getElementById('overlay-canvas');
  const overlayMatchInfo = document.getElementById('overlay-match-info');
  const modeBtns = document.querySelectorAll('.overlay-mode-btn');

  let overlayMode = 'onion'; // 'onion' | 'side-by-side' | 'diff'
  let browserScreenshot = null; // data URL of cropped element screenshot
  let figmaImage = null;        // data URL of uploaded Figma image
  let elementRect = null;       // bounding rect from capture
  let capturedDPR = 1;

  // --- Capture element screenshot ---
  overlayCaptureBtn.addEventListener('click', () => {
    console.log('[Panel] Capture clicked, extractedData:', extractedData ? { element: extractedData.element, dimensions: extractedData.dimensions } : null);
    if (!extractedData) {
      overlayCaptureBtn.textContent = 'Pick element first';
      setTimeout(() => { overlayCaptureBtn.textContent = 'Capture'; }, 1500);
      return;
    }
    overlayCaptureBtn.disabled = true;
    overlayCaptureBtn.textContent = 'Capturing...';
    const selector = extractedData?.element || '';
    console.log('[Panel] Sending CAPTURE_ELEMENT, selector:', selector);
    sendMessage({ action: 'CAPTURE_ELEMENT', selector });
  });

  // Handle capture response (add to port listener)
  function onElementCaptured(msg) {
    console.log('[Panel] onElementCaptured, rect:', msg.rect, 'screenshot:', msg.screenshot ? 'yes (' + msg.screenshot.length + ' chars)' : 'no', 'dpr:', msg.devicePixelRatio);
    overlayCaptureBtn.disabled = false;
    overlayCaptureBtn.textContent = 'Capture';

    if (!msg.screenshot || !msg.rect) { console.warn('[Panel] Missing screenshot or rect, aborting'); return; }

    elementRect = msg.rect;
    capturedDPR = msg.devicePixelRatio || 1;

    // Crop the full-page screenshot to element bounds
    const img = new Image();
    img.onload = () => {
      const cropX = msg.rect.viewportX * capturedDPR;
      const cropY = msg.rect.viewportY * capturedDPR;
      const cropW = msg.rect.width * capturedDPR;
      const cropH = msg.rect.height * capturedDPR;

      const canvas = document.createElement('canvas');
      canvas.width = msg.rect.width;
      canvas.height = msg.rect.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, msg.rect.width, msg.rect.height);

      browserScreenshot = canvas.toDataURL('image/png');
      renderOverlay();
    };
    img.src = msg.screenshot;
  }

  function onElementCaptureFailed(msg) {
    console.error('[Panel] onElementCaptureFailed', msg);
    overlayCaptureBtn.disabled = false;
    overlayCaptureBtn.textContent = 'Failed — retry';
    setTimeout(() => { overlayCaptureBtn.textContent = 'Capture'; }, 2000);
  }

  // --- Figma image upload ---
  figmaDropZone.addEventListener('click', () => figmaImageInput.click());

  figmaImageInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) loadFigmaImage(file);
    e.target.value = '';
  });

  figmaDropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    figmaDropZone.classList.add('drag-over');
  });

  figmaDropZone.addEventListener('dragleave', () => {
    figmaDropZone.classList.remove('drag-over');
  });

  figmaDropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    figmaDropZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) loadFigmaImage(file);
  });

  // Support paste anywhere in the panel
  document.addEventListener('paste', (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        loadFigmaImage(item.getAsFile());
        return;
      }
    }
  });

  function loadFigmaImage(file) {
    const reader = new FileReader();
    reader.onload = () => {
      figmaImage = reader.result;
      figmaDropZone.classList.add('has-image');
      figmaDropZone.textContent = '';
      const img = document.createElement('img');
      img.src = figmaImage;
      img.className = 'preview-thumb';
      img.alt = 'Figma design';
      figmaDropZone.appendChild(img);
      renderOverlay();
    };
    reader.readAsDataURL(file);
  }

  // --- View mode switching ---
  modeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      modeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      overlayMode = btn.dataset.mode;
      updateSliderVisibility();
      renderOverlay();
    });
  });

  function updateSliderVisibility() {
    overlaySliderRow.classList.toggle('hidden', overlayMode !== 'onion');
    diffThresholdRow.classList.toggle('hidden', overlayMode !== 'diff');
  }

  // --- Opacity slider ---
  overlayOpacity.addEventListener('input', () => {
    overlayOpacityVal.textContent = overlayOpacity.value + '%';
    renderOverlay();
  });

  // --- Diff threshold ---
  diffThreshold.addEventListener('input', () => {
    diffThresholdVal.textContent = diffThreshold.value;
    renderOverlay();
  });

  // --- Render overlay ---
  async function renderOverlay() {
    if (!browserScreenshot && !figmaImage) {
      overlayCanvasArea.classList.add('hidden');
      return;
    }

    overlayCanvasArea.classList.remove('hidden');
    overlayMatchInfo.classList.add('hidden');

    const ctx = overlayCanvas.getContext('2d');

    // Load available images
    const browserImg = browserScreenshot ? await loadImg(browserScreenshot) : null;
    const figmaImg = figmaImage ? await loadImg(figmaImage) : null;

    // Determine canvas size
    const w = browserImg ? browserImg.width : figmaImg.width;
    const h = browserImg ? browserImg.height : figmaImg.height;

    if (overlayMode === 'side-by-side') {
      const totalW = (browserImg ? w : 0) + (figmaImg ? figmaImg.width : 0) + (browserImg && figmaImg ? 8 : 0);
      const maxH = Math.max(h, figmaImg ? figmaImg.height : 0);
      overlayCanvas.width = totalW;
      overlayCanvas.height = maxH;
      ctx.clearRect(0, 0, totalW, maxH);

      let x = 0;
      if (browserImg) {
        ctx.drawImage(browserImg, 0, 0);
        x = browserImg.width + 8;
      }
      if (figmaImg) {
        ctx.drawImage(figmaImg, x, 0, figmaImg.width, figmaImg.height);
      }
    } else if (overlayMode === 'onion') {
      overlayCanvas.width = w;
      overlayCanvas.height = h;
      ctx.clearRect(0, 0, w, h);

      if (browserImg) ctx.drawImage(browserImg, 0, 0);

      if (figmaImg) {
        const opacity = parseInt(overlayOpacity.value) / 100;
        ctx.globalAlpha = opacity;
        ctx.drawImage(figmaImg, 0, 0, w, h);
        ctx.globalAlpha = 1;
      }
    } else if (overlayMode === 'diff') {
      overlayCanvas.width = w;
      overlayCanvas.height = h;
      ctx.clearRect(0, 0, w, h);

      if (browserImg && figmaImg) {
        const threshold = parseInt(diffThreshold.value) || 10;
        const imgDataA = getImageData(browserImg, w, h);
        const imgDataB = getImageData(figmaImg, w, h);
        const result = PixelDiff.compare(imgDataA, imgDataB, { threshold });

        ctx.putImageData(result.diffImageData, 0, 0);

        // Show match info
        overlayMatchInfo.classList.remove('hidden');
        overlayMatchInfo.textContent = `${result.matchPercent}% match (${result.diffCount.toLocaleString()} / ${result.totalPixels.toLocaleString()} pixels differ)`;
        if (result.matchPercent >= 98) {
          overlayMatchInfo.className = 'overlay-match-info good';
        } else if (result.matchPercent >= 90) {
          overlayMatchInfo.className = 'overlay-match-info warn';
        } else {
          overlayMatchInfo.className = 'overlay-match-info bad';
        }
      } else if (browserImg) {
        ctx.drawImage(browserImg, 0, 0);
      } else if (figmaImg) {
        ctx.drawImage(figmaImg, 0, 0, w, h);
      }
    }
  }

  function loadImg(src) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  function getImageData(img, w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);
    return ctx.getImageData(0, 0, w, h);
  }

  // --- Reset overlay state on clear ---
  clearBtn.addEventListener('click', () => {
    browserScreenshot = null;
    figmaImage = null;
    elementRect = null;
    overlaySection.classList.add('hidden');
    overlayCanvasArea.classList.add('hidden');
    overlayMatchInfo.classList.add('hidden');
    // Reset drop zone
    figmaDropZone.classList.remove('has-image');
    figmaDropZone.textContent = '';
    const p1 = document.createElement('p');
    p1.textContent = 'Drop or paste Figma screenshot here';
    const p2 = document.createElement('p');
    p2.className = 'text-muted';
    p2.textContent = 'Or click to upload';
    figmaDropZone.appendChild(p1);
    figmaDropZone.appendChild(p2);
  });

})();
