// Panel logic — UI state, wiring to diff engine, result display.
import { StyleExtractor } from '../lib/style-extractor';
import { FigmaParser, ParsedStyles } from '../lib/figma-parser';
import { Normalizer } from '../lib/normalizer';
import { DiffEngine, DiffReport, DiffResult } from '../lib/diff-engine';
import { PixelDiff } from '../lib/pixel-diff';
import { DesignToken, DesignTokenValidator } from '../lib/design-token-validator';

(function () {
  // --- DOM refs ---
  const pickBtn = document.getElementById('pick-btn') as HTMLButtonElement;
  const pickStatus = document.getElementById('pick-status') as HTMLElement;
  const settingsBtn = document.getElementById('settings-btn') as HTMLButtonElement;
  const helpBtn = document.getElementById('help-btn') as HTMLButtonElement;
  const closeGuideBtn = document.getElementById('close-guide-btn') as HTMLButtonElement;
  const quickStartGuide = document.getElementById('quick-start-guide') as HTMLElement;
  const manualSelectorToggle = document.getElementById('manual-selector-toggle') as HTMLElement;
  const selectorBlock = document.getElementById('selector-block') as HTMLElement;
  const step1Container = document.getElementById('step-1-container') as HTMLElement;
  const settingsPanel = document.getElementById('settings-panel') as HTMLElement;
  const selectionEmptyState = document.getElementById('selection-empty-state') as HTMLElement;
  const comparisonWorkspace = document.getElementById('comparison-workspace') as HTMLElement;
  const elementInfo = document.getElementById('element-info') as HTMLElement;
  const elementName = document.getElementById('element-name') as HTMLElement;
  const elementDims = document.getElementById('element-dims') as HTMLElement;
  const figmaSpecSection = document.getElementById('figma-spec-section') as HTMLElement;
  const figmaInput = document.getElementById('figma-input') as HTMLTextAreaElement;
  const extractedStyles = document.getElementById('extracted-styles') as HTMLElement;
  const compareBtn = document.getElementById('compare-btn') as HTMLButtonElement;
  const resultsSection = document.getElementById('results-section') as HTMLElement;
  const resultsSummary = document.getElementById('results-summary') as HTMLElement;
  const resultsList = document.getElementById('results-list') as HTMLElement;
  const copyBtn = document.getElementById('copy-btn') as HTMLButtonElement;
  const copyAiBtn = document.getElementById('copy-ai-btn') as HTMLButtonElement;
  const clearBtn = document.getElementById('clear-btn') as HTMLButtonElement;
  const selectorInput = document.getElementById('selector-input') as HTMLInputElement;
  const selectorBtn = document.getElementById('selector-btn') as HTMLButtonElement;
  const mappingSelect = document.getElementById('mapping-select') as HTMLSelectElement;
  const mappingLoadBtn = document.getElementById('mapping-load-btn') as HTMLButtonElement;
  const mappingDeleteBtn = document.getElementById('mapping-delete-btn') as HTMLButtonElement;
  const mappingSaveBtn = document.getElementById('mapping-save-btn') as HTMLButtonElement;
  const mappingExportBtn = document.getElementById('mapping-export-btn') as HTMLButtonElement;
  const mappingImportInput = document.getElementById('mapping-import-input') as HTMLInputElement;
  const resultsFilter = document.getElementById('results-filter') as HTMLInputElement;
  const figmaCacheStatus = document.getElementById('figma-cache-status') as HTMLElement;
  const tokenImportInput = document.getElementById('token-import-input') as HTMLInputElement;
  const tokenClearBtn = document.getElementById('token-clear-btn') as HTMLButtonElement;
  const tokenStatus = document.getElementById('token-status') as HTMLElement;
  const runtimeSetupBtn = document.getElementById('runtime-setup-btn') as HTMLButtonElement;
  const runtimeSetupStatus = document.getElementById('runtime-setup-status') as HTMLElement;

  // --- State ---
  let extractedData: any = null; // { element, dimensions, styles }
  let lastDiffReport: any = null;
  let currentVarMap: ParsedStyles['varMap'] = {};    // property → { varName, fallback, original }
  let varOverrides: Record<string, string> = {};     // property → user-overridden value
  let figmaFetchStatus: { node: any; image: any } = { node: null, image: null };
  let currentFigmaRequestId = 0;
  let figmaFetchPending = 0;
  let figmaSpecHighlightTimer: number | null = null;
  let designTokens: DesignToken[] = [];

  const headerLocateBtn = document.getElementById('header-locate-btn') as HTMLButtonElement;

  function logRuntimeSetup(event: string, details?: Record<string, unknown>) {
    if (details) {
      console.log(`[Panel][RuntimeSetup] ${event}`, details);
    } else {
      console.log(`[Panel][RuntimeSetup] ${event}`);
    }
  }

  function setRuntimeSetupState(state: 'idle' | 'loading' | 'success' | 'error', message: string) {
    logRuntimeSetup('state changed', { state, message });

    if (runtimeSetupStatus) {
      runtimeSetupStatus.textContent = message;
      runtimeSetupStatus.classList.toggle('success', state === 'success');
      runtimeSetupStatus.classList.toggle('error', state === 'error');
    }

    if (runtimeSetupBtn) {
      runtimeSetupBtn.disabled = state === 'loading';
      runtimeSetupBtn.classList.toggle('loading', state === 'loading');
      runtimeSetupBtn.textContent = state === 'loading' ? 'Setting Up' : 'Setup Runtime';
    }
  }

  runtimeSetupBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    logRuntimeSetup('button clicked');
    if (runtimeSetupBtn.disabled) {
      logRuntimeSetup('click ignored because setup is already running');
      return;
    }
    setRuntimeSetupState('loading', 'Waiting for VS Code confirmation...');
    logRuntimeSetup('sending bridge command', { action: 'SETUP_RUNTIME' });
    sendMessage({
      action: 'BRIDGE_COMMAND',
      payload: { action: 'SETUP_RUNTIME' }
    });
  });

  headerLocateBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!extractedData || headerLocateBtn.classList.contains('loading')) return;

    headerLocateBtn.classList.add('loading');
    headerLocateBtn.textContent = 'Searching';
    
    const firstDiff = lastDiffReport?.diffs?.[0];
    const payload: any = {
      action: 'FIND_SELECTOR',
      selector: extractedData.element,
      ancestors: extractedData.ancestors ?? [],
      sourceLoc: extractedData.sourceLoc ?? null,
      sourceName: extractedData.sourceName ?? null
    };

    if (firstDiff) {
      payload.property = firstDiff.property;
      payload.value = firstDiff.sourceExpected ?? firstDiff.expected;
    }
    
    sendMessage({ 
      action: 'BRIDGE_COMMAND', 
      payload
    });

    setTimeout(() => {
      if (headerLocateBtn.classList.contains('loading')) {
        headerLocateBtn.classList.remove('loading');
        headerLocateBtn.textContent = 'Locate in Editor';
      }
    }, 9876);
  });

  function setSelectionStatus(message = '', tone = '') {
    pickStatus.textContent = message;
    pickStatus.classList.remove('active', 'error', 'success');
    if (tone) pickStatus.classList.add(tone);
  }

  function clearFigmaSpecHighlight() {
    if (figmaSpecHighlightTimer) {
      clearTimeout(figmaSpecHighlightTimer);
      figmaSpecHighlightTimer = null;
    }
    figmaSpecSection?.classList.remove('panel-section--highlight');
  }

  function guideToFigmaSpec(message = 'Next step: paste or fetch the Figma Spec.') {
    if (!figmaSpecSection || figmaInput.value.trim()) return;

    clearFigmaSpecHighlight();
    figmaSpecSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
    figmaInput.focus({ preventScroll: true });
    setSelectionStatus(message, 'active');

    // Restart the pulse so repeated picks still draw attention.
    void figmaSpecSection.offsetWidth;
    figmaSpecSection.classList.add('panel-section--highlight');
    figmaSpecHighlightTimer = window.setTimeout(() => {
      figmaSpecSection.classList.remove('panel-section--highlight');
      figmaSpecHighlightTimer = null;
    }, 2200);
  }

  function updateSelectionLayout() {
    const hasSelection = Boolean(extractedData);

    selectionEmptyState?.classList.toggle('hidden', hasSelection);
    comparisonWorkspace?.classList.toggle('hidden', !hasSelection);
    
    // When an element is selected, we can shrink Step 1 or emphasize Step 2.
    if (hasSelection) {
      step1Container?.classList.add('step-1--selected');
      // Hide walkthrough and manual selector when selected to clean up
      quickStartGuide?.classList.add('hidden');
      selectorBlock?.classList.add('hidden');
      manualSelectorToggle?.classList.add('hidden');
    } else {
      step1Container?.classList.remove('step-1--selected');
      manualSelectorToggle?.classList.remove('hidden');
    }
  }

  // --- Help & Guide ---
  helpBtn?.addEventListener('click', () => {
    quickStartGuide?.classList.toggle('hidden');
    if (quickStartGuide && !quickStartGuide.classList.contains('hidden')) {
      quickStartGuide.scrollIntoView({ behavior: 'smooth' });
    }
  });

  closeGuideBtn?.addEventListener('click', () => {
    quickStartGuide?.classList.add('hidden');
  });

  // --- Manual Selector Toggle ---
  manualSelectorToggle?.addEventListener('click', () => {
    selectorBlock?.classList.remove('hidden');
    manualSelectorToggle?.classList.add('hidden');
    if (selectorInput) {
      selectorInput.focus();
    }
  });



  // --- Messaging ---
  const tabId = chrome.devtools.inspectedWindow.tabId;
  let port: chrome.runtime.Port | null = null;

  function connectPort() {
    try {
      port = chrome.runtime.connect({ name: 'panel' });
      port.postMessage({ action: 'INIT', tabId });
    } catch (e: any) {
      if (checkContext(e)) return;
      console.error('[Panel] connectPort failed:', e);
    }
    if (port) {
      port.onMessage.addListener((msg: any) => {
      console.log('[Panel] Port message received:', msg.action);
      
      if (msg.action === 'BRIDGE_CONNECTED') {
        const bridgeBadge = document.getElementById('bridge-status');
        if (bridgeBadge) {
          bridgeBadge.textContent = 'Connected';
          bridgeBadge.className = 'status-badge connected';
        }
      } else if (msg.action === 'BRIDGE_DISCONNECTED') {
        const bridgeBadge = document.getElementById('bridge-status');
        if (bridgeBadge) {
          bridgeBadge.textContent = 'Disconnected';
          bridgeBadge.className = 'status-badge';
        }
      } else if (msg.action === 'BRIDGE_ERROR') {
        logRuntimeSetup('bridge error', { error: msg.error || 'unknown' });
        const searchingButtons = document.querySelectorAll('.bridge-btn.loading, #header-locate-btn.loading');
        searchingButtons.forEach(btn => {
          btn.classList.remove('loading');
          if (btn.id === 'header-locate-btn') {
            btn.textContent = 'Locate in Editor';
          } else {
            btn.textContent = 'Locate';
          }
        });
        setRuntimeSetupState('error', 'VS Code Bridge not found. Start the bridge extension and try again.');
        setSelectionStatus('VS Code Bridge not found. Is the extension installed?', 'error');
      } else if (msg.action === 'SETUP_RUNTIME_STARTED') {
        logRuntimeSetup('VS Code started setup', { message: msg.message });
        setRuntimeSetupState('loading', msg.message || 'Updating runtime files in VS Code...');
      } else if (msg.action === 'SETUP_RUNTIME_SUCCESS') {
        logRuntimeSetup('VS Code completed setup', { message: msg.message });
        setRuntimeSetupState('success', msg.message || 'Runtime setup complete. Reload your app to stamp source locations.');
      } else if (msg.action === 'SETUP_RUNTIME_CANCELLED') {
        logRuntimeSetup('VS Code cancelled setup', { message: msg.message });
        setRuntimeSetupState('idle', msg.message || 'Runtime setup cancelled in VS Code.');
      } else if (msg.action === 'SETUP_RUNTIME_FAILED') {
        logRuntimeSetup('VS Code failed setup', { error: msg.error });
        setRuntimeSetupState('error', msg.error || 'Runtime setup failed in VS Code.');
      } else if (msg.action === 'SELECTOR_RESULTS') {
        console.log('[Panel] Bridge found matches:', msg.matches);
        
        // Find all active searching buttons and update them
        const searchingButtons = document.querySelectorAll('.bridge-btn.loading') as NodeListOf<HTMLButtonElement>;
        searchingButtons.forEach(btn => {
          btn.classList.remove('loading');
          if (msg.matches.length > 0) {
            btn.classList.add('success');
            btn.textContent = 'Found';
            setTimeout(() => {
              btn.classList.remove('success');
              btn.textContent = 'Locate';
            }, 2000);
          } else {
            btn.classList.add('error');
            btn.textContent = 'Not Found';
            setTimeout(() => {
              btn.classList.remove('error');
              btn.textContent = 'Locate';
            }, 2000);
          }
        });

        // Handle Hero Button separately for better text
        const heroBtn = document.getElementById('header-locate-btn') as HTMLButtonElement;
        if (heroBtn && heroBtn.classList.contains('loading')) {
          heroBtn.classList.remove('loading');
          heroBtn.textContent = msg.matches.length > 0 ? 'Found!' : 'Not Found';
          setTimeout(() => { heroBtn.textContent = 'Locate in Editor'; }, 2000);
        }

        if (msg.matches.length === 0) {
          setSelectionStatus('Selector not found in local workspace.', 'error');
        } else {
          const fileName = msg.matches[0].file.split('/').pop();
          const prefix = msg.exact ? 'Exact source: ' : 'Opened ';
          setSelectionStatus(`${prefix}${fileName}`, 'success');
        }
      }
      
      // New: Handle MCP responses
      const statusEl = document.getElementById('mcp-status') as HTMLElement;
      if (msg.action === 'MCP_CONNECTED') {
        statusEl.textContent = 'Connected';
        statusEl.className = 'status-badge connected';
      } else if (msg.action === 'MCP_CONNECTION_FAILED') {
        if (!isActiveFigmaResponse(msg)) return;
        statusEl.textContent = msg.error || 'Connection failed';
        statusEl.className = 'status-badge error';
        markFigmaFetchComplete();
      } else if (msg.action === 'MCP_NODE_FETCH_FAILED') {
        if (!isActiveFigmaResponse(msg)) return;
        alert('Figma Fetch Error: ' + msg.error);
        figmaFetchStatus.node = null;
        renderFigmaCacheStatus();
        markFigmaFetchComplete();
        guideToFigmaSpec('Figma fetch failed. Paste the spec here or try fetching again.');
      } else if (msg.action === 'MCP_NODE_DATA') {
        if (!isActiveFigmaResponse(msg)) return;
        console.log('[Panel] Received MCP Node Data:', msg.data);
        figmaInput.value = JSON.stringify(msg.data, null, 2);
        clearFigmaSpecHighlight();
        figmaFetchStatus.node = msg.meta || null;
        renderFigmaCacheStatus();
        markFigmaFetchComplete();
        updateCompareBtn();
      } else if (msg.action === 'MCP_IMAGE_DATA') {
        if (!isActiveFigmaResponse(msg)) return;
        console.log('[Panel] Received MCP Image URL:', msg.imageUrl);
        figmaFetchStatus.image = msg.meta || null;
        renderFigmaCacheStatus();
        loadFigmaImageUrl(msg.imageUrl);
        markFigmaFetchComplete();
      } else if (msg.action === 'MCP_IMAGE_FETCH_FAILED') {
        if (!isActiveFigmaResponse(msg)) return;
        console.warn('[Panel] Figma visual fetch failed:', msg.error);
        figmaFetchStatus.image = null;
        renderFigmaCacheStatus();
        markFigmaFetchComplete();
        // Silently fail or show a subtle hint that visual overlay won't auto-load
      } else if (msg.action === 'FIGMA_TAB_SYNCED') {
        if (msg.fileKey || msg.nodeId) {
          if (msg.fileKey) {
            mcpFileKeyInput.value = msg.fileKey;
            chrome.storage.local.get(['figmaConfig'], (res) => {
              const newConfig = { ...(res.figmaConfig || {}), fileKey: msg.fileKey };
              chrome.storage.local.set({ figmaConfig: newConfig });
            });
          }
          if (msg.nodeId) {
            mcpNodeIdInput.value = msg.nodeId;
          }
          console.log('[Panel] Synced from Figma tab:', msg);
          if (msg.fileKey && msg.nodeId && mcpTokenInput.value.trim()) {
            fetchFigmaNodeWithOptions(msg.nodeId, { forceRefresh: false });
          }
        } else if (msg.url) {
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
      } else if (msg.action === 'PICKER_CANCELLED') {
        setPickerState(false);
        setSelectionStatus('Picker cancelled.', '');
      } else if (msg.action === 'SELECTOR_NOT_FOUND') {
        setPickerState(false);
        setSelectionStatus(`No match found for "${msg.selector}".`, 'error');
      }

    });

    port.onDisconnect.addListener(() => {
      console.log('[Panel] Port disconnected');
      port = null;
    });
    }
  }

  // Figma API connection
  function connectToFigma(token: string) {
    sendMessage({ action: 'FIGMA_CONNECT', token });
  }

  function parseFigmaUrl(url: string) {
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

  function fetchFigmaNode(inputId: string) {
    return fetchFigmaNodeWithOptions(inputId, { forceRefresh: false });
  }

  function fetchFigmaNodeWithOptions(inputId: string, options: { forceRefresh?: boolean } = {}) {
    let nodeId = inputId;
    let fileKey = mcpFileKeyInput.value.trim();
    const forceRefresh = Boolean(options.forceRefresh);
    const requestId = ++currentFigmaRequestId;

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
    beginFigmaFetch(forceRefresh);
    figmaFetchStatus = { node: null, image: null };
    renderFigmaCacheStatus();
    sendMessage({ action: 'MCP_GET_NODE', nodeId, fileKey, forceRefresh, requestId });
    sendMessage({ action: 'MCP_GET_IMAGE', nodeId, fileKey, forceRefresh, requestId });
  }

  function loadFigmaImageUrl(url: string) {
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
  

  function sendMessage(msg: any) {
    // MV3 service workers go idle after ~30s. Reconnect if null or disconnected.
    if (!port) {
      console.log('[Panel] Port is null, reconnecting before send');
      connectPort();
    }
    
    try {
      port?.postMessage(msg);
      console.log('[Panel] postMessage sent:', msg.action);
    } catch (e: any) {
      if (checkContext(e)) return;
      console.warn('[Panel] postMessage failed, reconnecting:', e.message);
      try {
          connectPort();
          port?.postMessage(msg);
      } catch (e2) {
          console.error('[Panel] Critical port failure:', e2);
      }
    }
  }

  function checkContext(e: any) {
    if (e.message && e.message.includes('context invalidated')) {
      console.error('[Panel] Extension context invalidated. Please reload the extension and DevTools.');
      alert('Extension context invalidated. This usually happens after an extension update. Please reload the extension and the DevTools panel.');
      return true;
    }
    return false;
  }

  // --- Figma API Configuration ---
  const mcpConnectBtn = document.getElementById('mcp-connect-btn') as HTMLButtonElement;
  const mcpFetchBtn = document.getElementById('mcp-fetch-btn') as HTMLButtonElement;
  const mcpRefreshBtn = document.getElementById('mcp-refresh-btn') as HTMLButtonElement;
  const mcpSyncBtn = document.getElementById('mcp-sync-btn') as HTMLButtonElement;
  const mcpTokenInput = document.getElementById('mcp-token') as HTMLInputElement;
  const mcpFileKeyInput = document.getElementById('figma-file-key') as HTMLInputElement;
  const mcpNodeIdInput = document.getElementById('mcp-node-id') as HTMLInputElement;
  
  // --- Collapsible Sections (Accordion) ---
  const sections = {
    tolerance: { el: document.getElementById('section-tolerance'), key: 'toleranceRulesExpanded' },
    bridge: { el: document.getElementById('section-bridge'), key: 'bridgeSettingsExpanded' },
    figma: { el: document.getElementById('section-figma'), key: 'figmaConnectionExpanded' },
    mappings: { el: document.getElementById('section-mappings'), key: 'variableMappingsExpanded' }
  };

  Object.entries(sections).forEach(([_, config]) => {
    const header = config.el?.querySelector('.settings-card-header');
    header?.addEventListener('click', () => {
      const isExpanded = config.el?.classList.toggle('is-expanded');
      if (chrome.storage) {
        chrome.storage.local.set({ [config.key]: isExpanded });
      }
    });
  });

  function beginFigmaFetch(forceRefresh: boolean) {
    figmaFetchPending = 2;
    mcpFetchBtn.disabled = true;
    mcpRefreshBtn.disabled = true;
    mcpFetchBtn.textContent = forceRefresh ? 'Refreshing...' : 'Fetching...';
    mcpRefreshBtn.textContent = 'Working...';
  }

  function endFigmaFetch() {
    figmaFetchPending = 0;
    mcpFetchBtn.disabled = false;
    mcpRefreshBtn.disabled = false;
    mcpFetchBtn.textContent = 'Fetch Spec';
    mcpRefreshBtn.textContent = 'Refresh Live';
  }

  function markFigmaFetchComplete() {
    figmaFetchPending = Math.max(0, figmaFetchPending - 1);
    if (figmaFetchPending === 0) {
      endFigmaFetch();
    }
  }

  function isActiveFigmaResponse(msg: any) {
    return !msg.requestId || msg.requestId === currentFigmaRequestId;
  }

  function formatRelativeTime(timestamp: number) {
    if (!timestamp) return 'just now';
    const diffMs = Math.max(0, Date.now() - timestamp);
    const diffSec = Math.round(diffMs / 1000);
    if (diffSec < 5) return 'just now';
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.round(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHour = Math.round(diffMin / 60);
    return `${diffHour}h ago`;
  }

  function describeMeta(label: string, meta: any) {
    if (!meta) return `${label}: unavailable`;
    const sourceText = meta.source === 'cache' ? 'cached' : 'fresh';
    return `${label}: ${sourceText} ${formatRelativeTime(meta.cachedAt)}`;
  }

  function renderFigmaCacheStatus() {
    const parts = [];
    if (figmaFetchStatus.node) parts.push(describeMeta('Spec', figmaFetchStatus.node));
    if (figmaFetchStatus.image) parts.push(describeMeta('Image', figmaFetchStatus.image));

    if (parts.length === 0) {
      figmaCacheStatus.textContent = '';
      figmaCacheStatus.classList.add('hidden');
      return;
    }

    figmaCacheStatus.innerHTML = `<strong>Cache:</strong> ${parts.join(' | ')}`;
    figmaCacheStatus.classList.remove('hidden');
  }

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
        fetchFigmaNode(nodeId);
    }
  });

  mcpRefreshBtn.addEventListener('click', () => {
    const nodeId = mcpNodeIdInput.value.trim();
    if (nodeId) {
      fetchFigmaNodeWithOptions(nodeId, { forceRefresh: true });
    }
  });

  // Load saved Figma config
  if (chrome.storage) {
    chrome.storage.local.get([
      'figmaConfig', 
      'figmaConnectionExpanded', 
      'variableMappingsExpanded', 
      'toleranceRulesExpanded', 
      'bridgeSettingsExpanded'
    ], (result) => {
      const config = result.figmaConfig || {};

      if (mcpTokenInput) mcpTokenInput.value = config.token || '';
      if (mcpFileKeyInput) mcpFileKeyInput.value = config.fileKey || '';

      // Restore expanded states
      if (result.figmaConnectionExpanded) sections.figma.el?.classList.add('is-expanded');
      if (result.variableMappingsExpanded) sections.mappings.el?.classList.add('is-expanded');
      if (result.toleranceRulesExpanded) sections.tolerance.el?.classList.add('is-expanded');
      if (result.bridgeSettingsExpanded) sections.bridge.el?.classList.add('is-expanded');

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
    setSelectionStatus('Looking up selector...', 'active');
    sendMessage({ action: 'QUERY_SELECTOR', selector });
  }

  selectorBtn.addEventListener('click', () => queryBySelector());
  selectorInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') queryBySelector();
  });

  function setPickerState(active: boolean) {
    if (active) {
      pickBtn.disabled = true;
      setSelectionStatus('Click an element in the page, or press Esc to cancel.', 'active');
    } else {
      pickBtn.disabled = false;
      pickStatus.classList.remove('active');
    }
  }

  function onElementSelected(data: any) {
    setPickerState(false);
    setSelectionStatus('Selection ready.', 'success');
    extractedData = data;
    updateSelectionLayout();

    elementInfo.classList.remove('hidden');
    elementName.textContent = data.element;
    elementDims.textContent = `${data.dimensions.width} x ${data.dimensions.height}`;

    // Auto-fetch if Figma ID exists
    if (data.figmaId) {
        mcpNodeIdInput.value = data.figmaId;
        fetchFigmaNode(data.figmaId);
    } else {
        guideToFigmaSpec();
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
  figmaInput.addEventListener('input', () => {
    if (figmaInput.value.trim()) {
      clearFigmaSpecHighlight();
    }
    updateCompareBtn();
  });

  function updateCompareBtn() {
    compareBtn.disabled = !(extractedData && figmaInput.value.trim());
  }

  function openVarEditor(_anchorEl: HTMLElement, property: string, varInfo: any) {
    const currentValue = varOverrides[property] ?? varInfo.fallback ?? '';
    const message = [
      `Override ${varInfo.varName} for ${property}.`,
      'Leave blank to clear the override and fall back to the Figma value.'
    ].join('\n');
    const nextValue = window.prompt(message, currentValue);

    if (nextValue === null) return;

    const trimmed = nextValue.trim();
    if (trimmed) {
      varOverrides[property] = trimmed;
    } else {
      delete varOverrides[property];
    }

    if (extractedData && figmaInput.value.trim()) {
      runComparison();
    }
  }

  // --- Settings ---
  settingsBtn.addEventListener('click', () => {
    settingsPanel.classList.toggle('hidden');
  });

  function getTolerance() {
    const s = parseInt((document.getElementById('tol-spacing') as HTMLInputElement).value);
    const c = parseInt((document.getElementById('tol-color') as HTMLInputElement).value);
    const r = parseInt((document.getElementById('tol-radius') as HTMLInputElement).value);

    return {
      spacing: isNaN(s) ? 2 : s,
      color: isNaN(c) ? 5 : c,
      borderRadius: isNaN(r) ? 2 : r
    };
  }

  function renderTokenStatus(message?: string, tone: 'default' | 'error' | 'success' = 'default') {
    if (!tokenStatus) return;

    tokenStatus.classList.remove('status-error', 'status-success');
    if (tone === 'error') tokenStatus.classList.add('status-error');
    if (tone === 'success') tokenStatus.classList.add('status-success');

    if (message) {
      tokenStatus.textContent = message;
    } else if (designTokens.length > 0) {
      tokenStatus.textContent = `${designTokens.length} tokens loaded`;
    } else {
      tokenStatus.textContent = 'No token file loaded';
    }

    if (tokenClearBtn) tokenClearBtn.disabled = designTokens.length === 0;
  }

  function saveDesignTokens(tokens: DesignToken[]) {
    designTokens = tokens;
    renderTokenStatus(undefined, tokens.length > 0 ? 'success' : 'default');
    if (chrome.storage) {
      try {
        chrome.storage.local.set({ designTokens: tokens });
      } catch (e: any) {
        checkContext(e);
      }
    }
  }

  tokenImportInput?.addEventListener('change', async () => {
    const file = tokenImportInput.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const tokens = DesignTokenValidator.parse(text);
      saveDesignTokens(tokens);
      renderTokenStatus(`${tokens.length} tokens loaded from ${file.name}`, 'success');
      if (lastDiffReport) runComparison();
    } catch (e: any) {
      renderTokenStatus(e?.message ? `Import failed: ${e.message}` : 'Import failed: invalid token JSON', 'error');
    } finally {
      tokenImportInput.value = '';
    }
  });

  tokenClearBtn?.addEventListener('click', () => {
    saveDesignTokens([]);
    if (chrome.storage) {
      try {
        chrome.storage.local.remove('designTokens');
      } catch (e: any) {
        checkContext(e);
      }
    }
    if (lastDiffReport) runComparison();
  });

  // Load saved settings
  if (chrome.storage) {
    chrome.storage.local.get(['tolerance', 'bridgePort', 'designTokens'], (result) => {
      if (result.tolerance) {
        if (result.tolerance.spacing !== undefined) (document.getElementById('tol-spacing') as HTMLInputElement).value = result.tolerance.spacing;
        if (result.tolerance.color !== undefined) (document.getElementById('tol-color') as HTMLInputElement).value = result.tolerance.color;
        if (result.tolerance.borderRadius !== undefined) (document.getElementById('tol-radius') as HTMLInputElement).value = result.tolerance.borderRadius;
      }
      if (result.bridgePort) {
        (document.getElementById('bridge-port') as HTMLInputElement).value = result.bridgePort;
      }
      if (Array.isArray(result.designTokens)) {
        designTokens = result.designTokens;
      }
      renderTokenStatus();
    });
  } else {
    renderTokenStatus();
  }

  // Save settings on change
  settingsPanel.addEventListener('change', () => {
    const tol = getTolerance();
    const bridgePort = parseInt((document.getElementById('bridge-port') as HTMLInputElement).value) || 9876;
    if (chrome.storage) {
      try {
        chrome.storage.local.set({ tolerance: tol, bridgePort: bridgePort });
      } catch (e: any) {
        checkContext(e);
      }
    }
  });

  // --- Compare ---
  function runComparison() {
    if (!extractedData || !figmaInput.value.trim()) return;

    const parsed = FigmaParser.parse(figmaInput.value);
    currentVarMap = parsed.varMap;
    const rootFontSize = extractedData.rootFontSize || 16;

    // Apply user overrides to styles before normalizing
    const figmaStyles = { ...parsed.styles };
    const rawFigmaStyles = { ...parsed.rawStyles };
    const sourceDeclarations = { ...parsed.sourceDeclarations };
    for (const [prop, val] of Object.entries(varOverrides)) {
      if (prop in figmaStyles) {
        figmaStyles[prop] = val;
        rawFigmaStyles[prop] = val;
        sourceDeclarations[prop] = `${prop}: ${val};`;
      }
    }

    const normalizedFigma = Normalizer.normalize(figmaStyles, rootFontSize);
    const normalizedBrowser = Normalizer.normalize(extractedData.styles, rootFontSize);

    const tolerance = getTolerance();
    const baseReport = DiffEngine.compare(normalizedFigma, normalizedBrowser, tolerance);
    const enrichedResults = baseReport.results.map((result: any) => {
      const sourceExpected = rawFigmaStyles[result.property] ?? result.expected;
      const varInfo = currentVarMap[result.property];
      const tokenValidation = DesignTokenValidator.validateProperty(
        result.property,
        result.expected,
        designTokens,
        varInfo?.varName
      );

      return {
        ...result,
        sourceExpected,
        sourceDeclaration: sourceDeclarations[result.property] || `${result.property}: ${sourceExpected};`,
        tokenValidation
      };
    });

    const report = {
      ...baseReport,
      results: enrichedResults,
      tokenSummary: DesignTokenValidator.summarizeValidations(enrichedResults.map((result: any) => result.tokenValidation))
    };

    lastDiffReport = {
      ...report,
      element: extractedData.element,
      dimensions: extractedData.dimensions
    };

    renderResults(report);
  }

  compareBtn.addEventListener('click', () => runComparison());

  // --- Copy for AI ---
  function buildAiPrompt() {
    if (!lastDiffReport) return null;

    const mismatches = lastDiffReport.results.filter((r: any) => r.status === 'mismatch' || r.status === 'missing');
    const lines = [];

    lines.push('## UI Checker — AI Fix Request');
    lines.push('');
    lines.push('### Element');
    lines.push(`Selector: ${lastDiffReport.element}`);
    if (extractedData?.classList) lines.push(`Classes:  ${extractedData.classList}`);
    lines.push(`Dimensions: ${lastDiffReport.dimensions?.width ?? '?'}px × ${lastDiffReport.dimensions?.height ?? '?'}px`);
    lines.push('');

    const s = lastDiffReport.summary;
    lines.push('### Comparison Summary');
    lines.push(`${s.mismatched} mismatches · ${s.missing ?? 0} missing · ${s.matched} matched (${s.total} total)`);
    if (lastDiffReport.tokenSummary?.total > 0) {
      const ts = lastDiffReport.tokenSummary;
      lines.push(`Token coverage: ${ts.tokenized}/${ts.total} tokenized (${ts.coveragePercent}%), ${ts.hardcoded} hardcoded, ${ts.unmapped} unmapped`);
    }
    lines.push('');

    if (mismatches.length > 0) {
      lines.push('### Mismatches');
      lines.push('| Property | Expected (Figma) | Actual (DOM) | Severity | Token |');
      lines.push('|---|---|---|---|---|');
      for (const r of mismatches) {
        lines.push(`| ${r.property} | ${r.sourceExpected ?? r.expected ?? '—'} | ${r.actual ?? '—'} | ${r.severity || r.status} | ${formatTokenReportValue(r)} |`);
      }
      lines.push('');
    }

    const figmaRaw = figmaInput.value.trim();
    if (figmaRaw) {
      lines.push('### Figma Spec (expected styles)');
      lines.push('```css');
      lines.push(figmaRaw);
      lines.push('```');
      lines.push('');
    }

    if (extractedData?.styles) {
      lines.push('### Live DOM Styles (actual styles)');
      lines.push('```css');
      lines.push(Object.entries(extractedData.styles).map(([k, v]) => `${k}: ${v};`).join('\n'));
      lines.push('```');
      lines.push('');
    }

    lines.push('---');
    lines.push('Paste your component code below and ask the AI to fix the mismatches.');
    return lines.join('\n');
  }

  if (copyAiBtn) {
    copyAiBtn.addEventListener('click', async () => {
      const prompt = buildAiPrompt();
      if (!prompt) return;
      await navigator.clipboard.writeText(prompt);
      const orig = copyAiBtn.textContent;
      copyAiBtn.textContent = 'Copied!';
      setTimeout(() => { copyAiBtn.textContent = orig || ''; }, 1500);
    });
  }

  // --- Filter results ---
  resultsFilter.addEventListener('input', () => {
    if (lastDiffReport) renderResults(lastDiffReport);
  });

  // --- Render results ---
  function appendStat(parent: HTMLElement, label: string, value: string | number, valueClass: string) {
    const stat = document.createElement('div');
    stat.className = 'stat';
    
    const labelEl = document.createElement('span');
    labelEl.className = 'stat-label';
    labelEl.textContent = label;
    
    const valueEl = document.createElement('span');
    valueEl.className = `stat-value ${valueClass}`;
    valueEl.textContent = value.toString();
    
    stat.appendChild(labelEl);
    stat.appendChild(valueEl);
    parent.appendChild(stat);
  }

  function renderResults(report: DiffReport) {
    resultsSection.classList.remove('hidden');

    // Summary
    const s = report.summary;
    resultsSummary.textContent = '';
    appendStat(resultsSummary, 'Matched', s.matched, 'stat-matched');
    appendStat(resultsSummary, 'Mismatched', s.mismatched, 'stat-mismatched');
    appendStat(resultsSummary, 'Missing', s.missing, 'stat-missing');
    const tokenSummary = (report as any).tokenSummary;
    if (tokenSummary?.total > 0) {
      appendStat(resultsSummary, 'Tokenized', `${tokenSummary.tokenized}/${tokenSummary.total}`, 'stat-tokenized');
    }

    // Build result list
    resultsList.textContent = '';

    // Sort: mismatches first (major > minor), then missing, then matches
    const severityOrder: Record<string, number> = { major: 0, minor: 1, negligible: 2 };
    const statusOrder: Record<string, number> = { mismatch: 0, missing: 1, match: 2 };

    const sorted = [...report.results].sort((a, b) => {
      const sa = statusOrder[a.status] ?? 3;
      const sb = statusOrder[b.status] ?? 3;
      if (sa !== sb) return sa - sb;
      const sevA = severityOrder[a.severity || ''] ?? 3;
      const sevB = severityOrder[b.severity || ''] ?? 3;
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

  function groupByPropertyGroup(items: DiffResult[]) {
    const groups: Record<string, DiffResult[]> = {};
    for (const item of items) {
      const group = StyleExtractor.getPropertyGroup(item.property);
      if (!groups[group]) groups[group] = [];
      groups[group].push(item);
    }
    return groups;
  }

  function createResultRow(r: any) {
    const row = document.createElement('div');
    row.className = `result-row result-row--${r.status}`;

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
      appendTokenValidation(expectedCol, r);
    } else {
      const label = document.createElement('span');
      label.className = 'result-label';
      label.textContent = 'exp';
      expectedCol.appendChild(label);
      expectedCol.appendChild(createValueElement(r.sourceExpected ?? r.expected, ''));
      appendTokenValidation(expectedCol, r);
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
        const actions = document.createElement('div');
        actions.className = 'result-actions';
        actions.style.display = 'inline-flex';
        actions.style.gap = '4px';
        actions.style.marginLeft = '8px';

        const fixBtn = document.createElement('button');
        fixBtn.className = 'btn btn-xs copy-fix-btn';
        fixBtn.textContent = 'Fix';
        fixBtn.title = 'Copy to clipboard';
        fixBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          navigator.clipboard.writeText(r.sourceDeclaration || `${r.property}: ${r.sourceExpected ?? r.expected};`).then(() => {
            fixBtn.textContent = 'Copied!';
            fixBtn.classList.add('btn-success');
            setTimeout(() => { fixBtn.textContent = 'Fix'; fixBtn.classList.remove('btn-success'); }, 1000);
          });
        });
        actions.appendChild(fixBtn);

        const bridgeBtn = document.createElement('button');
        bridgeBtn.className = 'btn btn-xs bridge-btn';
        bridgeBtn.innerHTML = 'Locate';
        bridgeBtn.title = 'Find in VS Code';
        
        bridgeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (bridgeBtn.classList.contains('loading')) return;

          bridgeBtn.classList.add('loading');
          bridgeBtn.textContent = 'Searching';
          
          const payload = {
            action: 'FIND_SELECTOR',
            selector: lastDiffReport.element,
            ancestors: extractedData?.ancestors ?? [],
            sourceLoc: extractedData?.sourceLoc ?? null,
            sourceName: extractedData?.sourceName ?? null,
            property: r.property,
            value: r.sourceExpected ?? r.expected
          };

          // Store reference for callback
          (bridgeBtn as any).dataset.activeSearch = 'true';

          sendMessage({ action: 'BRIDGE_COMMAND', payload });
          
          // Fallback timeout
          setTimeout(() => {
            if (bridgeBtn.classList.contains('loading')) {
              bridgeBtn.classList.remove('loading');
              bridgeBtn.textContent = 'Timeout';
            }
          }, 9876);
        });
        actions.appendChild(bridgeBtn);
        actualCol.appendChild(actions);
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

  function appendTokenValidation(parent: HTMLElement, r: any) {
    const validation = r.tokenValidation;
    if (!validation) return;

    if (validation.status === 'tokenized' && validation.token) {
      const chip = document.createElement('span');
      chip.className = 'token-chip token-chip--ok';
      chip.title = `Matched token: ${validation.token.path}`;
      chip.textContent = validation.token.path;
      parent.appendChild(chip);
      return;
    }

    if (validation.status === 'hardcoded' && validation.token) {
      const chip = document.createElement('span');
      chip.className = 'token-chip token-chip--warning';
      chip.title = `Hardcoded value matches token ${validation.token.path}`;
      chip.textContent = `use ${validation.token.path}`;
      parent.appendChild(chip);
      return;
    }

    if (validation.suggestions?.length > 0) {
      const chip = document.createElement('span');
      chip.className = 'token-chip token-chip--suggestion';
      chip.title = validation.suggestions
        .map((token: DesignToken) => `${token.path}: ${token.value}`)
        .join('\n');
      chip.textContent = `near ${validation.suggestions[0].path}`;
      parent.appendChild(chip);
    }
  }

  function createValueElement(value: string, className: string) {
    const el = document.createElement('span');
    el.className = 'result-value ' + className;
    el.textContent = value;
    return el;
  }

  function createColorSwatch(property: string, value: string) {
    const el = document.createElement('span');
    if (!value) return el;
    const isColor = property === 'color' || property === 'background-color' || (property.includes('border') && property.includes('color'));
    if (isColor) {
      el.className = 'color-swatch';
      el.style.backgroundColor = value;
    }
    return el;
  }

  function formatTokenReportValue(result: any) {
    const validation = result.tokenValidation;
    if (!validation) return 'n/a';
    if (validation.status === 'tokenized' && validation.token) return validation.token.path;
    if (validation.status === 'hardcoded' && validation.token) return `hardcoded; use ${validation.token.path}`;
    if (validation.suggestions?.length > 0) return `closest: ${validation.suggestions.map((token: DesignToken) => token.path).join(', ')}`;
    return 'unmapped';
  }

  // --- Copy Report ---
  copyBtn.addEventListener('click', () => {
    if (!lastDiffReport) return;

    const r = lastDiffReport;
    const mismatches = r.results.filter((x: any) => x.status === 'mismatch' || x.status === 'missing');
    const matched = r.results.filter((x: any) => x.status === 'match');

    let md = `## Style Diff Report\n`;
    md += `**Element:** \`${r.element}\` (${r.dimensions.width} x ${r.dimensions.height})\n`;
    md += `**Date:** ${new Date().toISOString().slice(0, 10)}\n\n`;
    if (r.tokenSummary?.total > 0) {
      md += `**Token coverage:** ${r.tokenSummary.tokenized}/${r.tokenSummary.total} tokenized (${r.tokenSummary.coveragePercent}%), ${r.tokenSummary.hardcoded} hardcoded, ${r.tokenSummary.unmapped} unmapped\n\n`;
    }

    if (mismatches.length > 0) {
      md += `### Mismatches (${mismatches.length})\n`;
      md += `| Property | Expected (Figma) | Actual (Browser) | Severity | Token |\n`;
      md += `|----------|-----------------|------------------|----------|-------|\n`;
      for (const m of mismatches) {
        md += `| ${m.property} | ${m.sourceExpected ?? m.expected} | ${m.actual ?? 'n/a'} | ${m.severity} | ${formatTokenReportValue(m)} |\n`;
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
    clearFigmaSpecHighlight();
    figmaInput.value = '';
    extractedStyles.textContent = 'Pick an element to extract styles.';
    elementInfo.classList.add('hidden');
    resultsSection.classList.add('hidden');
    resultsSummary.textContent = '';
    resultsList.textContent = '';
    resultsFilter.value = '';
    compareBtn.disabled = true;
    selectorInput.value = '';
    selectorBlock?.classList.add('hidden');
    manualSelectorToggle?.classList.remove('hidden');
    updateSelectionLayout();
  });

  // --- Variable Mappings ---
  function getSavedMappings(cb: (mappings: any[]) => void) {
    chrome.storage.local.get(['savedMappings'], (result) => {
      cb(result.savedMappings || []);
    });
  }

  function setSavedMappings(mappings: any[], cb: () => void) {
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

  mappingImportInput.addEventListener('change', (e: any) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string);
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

  const overlayCaptureBtn = document.getElementById('overlay-capture-btn') as HTMLButtonElement;
  const figmaDropZone = document.getElementById('figma-drop-zone') as HTMLElement;
  const figmaImageInput = document.getElementById('figma-image-input') as HTMLInputElement;
  const overlaySliderRow = document.getElementById('overlay-slider-row') as HTMLElement;
  const overlayOpacity = document.getElementById('overlay-opacity') as HTMLInputElement;
  const overlayOpacityVal = document.getElementById('overlay-opacity-val') as HTMLElement;
  const diffThresholdRow = document.getElementById('diff-threshold-row') as HTMLElement;
  const diffThreshold = document.getElementById('diff-threshold') as HTMLInputElement;
  const diffThresholdVal = document.getElementById('diff-threshold-val') as HTMLElement;
  const overlayCanvasArea = document.getElementById('overlay-canvas-area') as HTMLElement;
  const overlayCanvas = document.getElementById('overlay-canvas') as HTMLCanvasElement;
  const overlayMatchInfo = document.getElementById('overlay-match-info') as HTMLElement;
  const modeBtns = document.querySelectorAll('.overlay-mode-btn') as NodeListOf<HTMLButtonElement>;

  let overlayMode = 'onion'; // 'onion' | 'side-by-side' | 'diff'
  let browserScreenshot: string | null = null; // data URL of cropped element screenshot
  let figmaImage: string | null = null;        // data URL of uploaded Figma image
  let capturedDPR = 1;

  // --- Capture element screenshot ---
  overlayCaptureBtn.addEventListener('click', () => {
    if (!extractedData) {
      overlayCaptureBtn.textContent = 'Pick element first';
      setTimeout(() => { overlayCaptureBtn.textContent = 'Capture'; }, 1500);
      return;
    }
    overlayCaptureBtn.disabled = true;
    overlayCaptureBtn.textContent = 'Capturing...';
    const selector = extractedData?.element || '';
    sendMessage({ action: 'CAPTURE_ELEMENT', selector });
  });

  // Handle capture response (add to port listener)
  function onElementCaptured(msg: any) {
    overlayCaptureBtn.disabled = false;
    overlayCaptureBtn.textContent = 'Capture';

    if (!msg.screenshot || !msg.rect) { return; }

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
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, msg.rect.width, msg.rect.height);

      browserScreenshot = canvas.toDataURL('image/png');
      renderOverlay();
    };
    img.src = msg.screenshot;
  }

  function onElementCaptureFailed(msg: any) {
    console.error('[Panel] onElementCaptureFailed', msg);
    overlayCaptureBtn.disabled = false;
    overlayCaptureBtn.textContent = 'Failed — retry';
    setTimeout(() => { overlayCaptureBtn.textContent = 'Capture'; }, 2000);
  }

  // --- Figma image upload ---
  figmaDropZone.addEventListener('click', () => figmaImageInput.click());

  figmaImageInput.addEventListener('change', (e: any) => {
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
    const file = e.dataTransfer?.files[0];
    if (file && file.type.startsWith('image/')) loadFigmaImage(file);
  });

  // Support paste anywhere in the panel
  document.addEventListener('paste', (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) loadFigmaImage(file);
        return;
      }
    }
  });

  function loadFigmaImage(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      figmaImage = reader.result as string;
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
      overlayMode = btn.dataset.mode!;
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

    const ctx = overlayCanvas.getContext('2d')!;

    // Load available images
    const browserImg = browserScreenshot ? await loadImg(browserScreenshot) : null;
    const figmaImg = figmaImage ? await loadImg(figmaImage) : null;

    // Determine canvas size
    const w = browserImg ? browserImg.width : (figmaImg ? figmaImg.width : 0);
    const h = browserImg ? browserImg.height : (figmaImg ? figmaImg.height : 0);

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

  function loadImg(src: string): Promise<HTMLImageElement | null> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  function getImageData(img: HTMLImageElement, w: number, h: number) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(img, 0, 0, w, h);
    return ctx.getImageData(0, 0, w, h);
  }

  // --- Reset overlay state on clear ---
  clearBtn.addEventListener('click', () => {
    browserScreenshot = null;
    figmaImage = null;
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

  updateSelectionLayout();

})();
