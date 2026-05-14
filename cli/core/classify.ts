import { DiffReport } from '../../chrome-extension/lib/diff-engine';
import { CheckStatus, UiCheckerFailOn } from '../types';

export function classifyDiff(report: DiffReport, failOn: UiCheckerFailOn): CheckStatus {
  if (failOn.missing) {
    if (report.summary.missing > 0) return 'failed';
  }

  let majorCount = 0;
  let minorCount = 0;

  for (const result of report.results) {
    if (result.status === 'mismatch') {
      if (result.severity === 'major') majorCount += 1;
      if (result.severity === 'minor') minorCount += 1;
    }
  }

  if (failOn.major) {
    if (majorCount > 0) return 'failed';
  }
  if (minorCount > failOn.minorCount) return 'failed';

  return 'passed';
}
