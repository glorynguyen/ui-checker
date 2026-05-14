import { DiffEngine } from '../chrome-extension/lib/diff-engine';
import { FigmaAPIClient } from '../chrome-extension/lib/figma-api-client';
import { FigmaParser } from '../chrome-extension/lib/figma-parser';
import { Normalizer } from '../chrome-extension/lib/normalizer';
import { classifyDiff } from './core/classify';
import { extractDomStyles } from './adapters/dom-extractor';
import { buildRunReport } from './report';
import { UiCheckerCheck, UiCheckerCheckReport, UiCheckerConfig, UiCheckerReport } from './types';

export interface RunnerDeps {
  extractDomStyles: typeof extractDomStyles;
  getFigmaNode: (nodeId: string, fileKey: string) => Promise<any>;
}

export async function runChecks(config: UiCheckerConfig, figmaToken: string, deps?: Partial<RunnerDeps>): Promise<UiCheckerReport> {
  const client = new FigmaAPIClient(figmaToken);
  const resolvedDeps: RunnerDeps = {
    extractDomStyles,
    getFigmaNode: client.getNode.bind(client),
    ...deps
  };
  const reports: UiCheckerCheckReport[] = [];

  for (const check of config.checks) {
    reports.push(await runOneCheck(config, check, resolvedDeps));
  }

  return buildRunReport(reports);
}

async function runOneCheck(config: UiCheckerConfig, check: UiCheckerCheck, deps: RunnerDeps): Promise<UiCheckerCheckReport> {
  const url = resolveCheckUrl(config.baseUrl, check.path);

  try {
    const [dom, figmaNode] = await Promise.all([
      deps.extractDomStyles(url, check.selector),
      deps.getFigmaNode(check.figmaNodeId, check.figmaFileKey)
    ]);

    const figmaParsed = FigmaParser.parse(figmaNode);
    const normalizedExpected = Normalizer.normalize(figmaParsed.styles, dom.rootFontSize);
    const normalizedActual = Normalizer.normalize(dom.styles, dom.rootFontSize);
    const diff = DiffEngine.compare(normalizedExpected, normalizedActual, config.tolerance);
    const status = classifyDiff(diff, config.failOn);

    return {
      name: check.name,
      status,
      url: dom.url,
      selector: check.selector,
      figmaFileKey: check.figmaFileKey,
      figmaNodeId: check.figmaNodeId,
      diff
    };
  } catch (error: any) {
    return {
      name: check.name,
      status: 'errored',
      url,
      selector: check.selector,
      figmaFileKey: check.figmaFileKey,
      figmaNodeId: check.figmaNodeId,
      error: error?.message || String(error)
    };
  }
}

export function resolveCheckUrl(baseUrl: string, path: string) {
  if (/^https?:\/\//i.test(path)) return path;
  let normalizedBase = baseUrl;
  if (!normalizedBase.endsWith('/')) {
    normalizedBase = `${normalizedBase}/`;
  }
  return new URL(path, normalizedBase).toString();
}
