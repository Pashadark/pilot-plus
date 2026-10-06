export type ReadinessSeverity = 'BLOCKER' | 'WARNING';

export type ReadinessIssue = {
  code: string;
  message: string;
  href: string;
  severity: ReadinessSeverity;
};

export type ReadinessResult = {
  ready: boolean;
  blockers: ReadinessIssue[];
  warnings: ReadinessIssue[];
};

export function readinessResult(issues: readonly ReadinessIssue[]): ReadinessResult {
  const blockers = issues.filter((issue) => issue.severity === 'BLOCKER');
  return {
    ready: blockers.length === 0,
    blockers,
    warnings: issues.filter((issue) => issue.severity === 'WARNING'),
  };
}

export function blocker(code: string, message: string, href: string): ReadinessIssue {
  return { code, message, href, severity: 'BLOCKER' };
}

export function warning(code: string, message: string, href: string): ReadinessIssue {
  return { code, message, href, severity: 'WARNING' };
}
