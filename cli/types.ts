import { DiffReport, Tolerance } from '../chrome-extension/lib/diff-engine';

export interface UiCheckerFailOn {
  major: boolean;
  minorCount: number;
  missing: boolean;
}

export interface UiCheckerCheck {
  name: string;
  path: string;
  selector: string;
  figmaFileKey: string;
  figmaNodeId: string;
}

export interface UiCheckerConfig {
  baseUrl: string;
  figmaTokenEnv: string;
  tolerance: Tolerance;
  failOn: UiCheckerFailOn;
  checks: UiCheckerCheck[];
}

export type CheckStatus = 'passed' | 'failed' | 'errored';
export type RunStatus = 'passed' | 'failed' | 'errored';

export interface DomExtraction {
  url: string;
  selector: string;
  rootFontSize: number;
  dimensions: {
    width: number;
    height: number;
  };
  styles: Record<string, string>;
}

export interface UiCheckerCheckReport {
  name: string;
  status: CheckStatus;
  url: string;
  selector: string;
  figmaFileKey: string;
  figmaNodeId: string;
  diff?: DiffReport;
  error?: string;
}

export interface UiCheckerReport {
  status: RunStatus;
  summary: {
    total: number;
    passed: number;
    failed: number;
    errored: number;
  };
  checks: UiCheckerCheckReport[];
}
