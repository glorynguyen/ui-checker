export interface FigmaTabInfo {
  fileKey: string;
  nodeId: string;
  url: string;
}

export interface FigmaTabCandidate {
  id?: number;
  url?: string;
  active?: boolean;
  currentWindow?: boolean;
  windowId?: number;
}

export function parseFigmaTabUrl(rawUrl: string | undefined): FigmaTabInfo | null {
  if (!rawUrl) return null;

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }

  if (!isFigmaHost(url.hostname)) return null;

  const pathParts = url.pathname.split('/').filter(Boolean);
  const fileKey = getFigmaFileKey(pathParts);
  const nodeId = normalizeFigmaNodeId(url.searchParams.get('node-id'));

  if (!fileKey || !nodeId) return null;

  return {
    fileKey,
    nodeId,
    url: rawUrl
  };
}

export function selectBestFigmaTab(tabs: FigmaTabCandidate[]): FigmaTabInfo | null {
  const candidates = tabs
    .map((tab, index) => {
      const info = parseFigmaTabUrl(tab.url);
      if (!info) return null;

      return {
        info,
        score: scoreTab(tab),
        index
      };
    })
    .filter((item): item is { info: FigmaTabInfo; score: number; index: number } => item !== null);

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score;
    return a.index - b.index;
  });

  return candidates[0].info;
}

function isFigmaHost(hostname: string) {
  return hostname === 'figma.com' || hostname.endsWith('.figma.com');
}

function getFigmaFileKey(pathParts: string[]) {
  const keyIndex = pathParts.findIndex((part) => part === 'design' || part === 'file') + 1;
  return keyIndex > 0 ? pathParts[keyIndex] || null : null;
}

function normalizeFigmaNodeId(nodeId: string | null) {
  if (!nodeId) return null;
  const trimmed = nodeId.trim();
  if (!trimmed) return null;
  return trimmed.includes(':') ? trimmed : trimmed.replace(/-/g, ':');
}

function scoreTab(tab: FigmaTabCandidate) {
  let score = 0;
  if (tab.active) score += 4;
  if (tab.currentWindow) score += 2;
  if (tab.id !== undefined) score += 1;
  return score;
}
