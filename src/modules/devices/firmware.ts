const NUMERIC_SEMVER_PATTERN = /^(\d+)\.(\d+)\.(\d+)$/;

function parseNumericSemver(version: string): readonly [number, number, number] | null {
  const match = NUMERIC_SEMVER_PATTERN.exec(version);

  if (!match) return null;

  const parts = match.slice(1).map(Number);

  if (parts.some((part) => !Number.isSafeInteger(part))) return null;

  return [parts[0], parts[1], parts[2]];
}

export function canUpdateFirmware(currentVersion: string, targetVersion: string): boolean {
  const current = parseNumericSemver(currentVersion);
  const target = parseNumericSemver(targetVersion);

  if (!current || !target) return false;

  for (let index = 0; index < current.length; index += 1) {
    if (target[index] !== current[index]) return target[index] > current[index];
  }

  return false;
}
