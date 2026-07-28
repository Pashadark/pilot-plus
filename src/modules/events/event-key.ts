const SOURCE_PATTERN = /^[a-z][a-z0-9-]*$/;
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;

export function createEventKey(source: string, id: string) {
  return `${source}:${id}`;
}

export function parseEventKey(key: string): { source: string; id: string } | null {
  const separatorIndex = key.indexOf(':');

  if (separatorIndex <= 0 || separatorIndex !== key.lastIndexOf(':')) {
    return null;
  }

  const source = key.slice(0, separatorIndex);
  const id = key.slice(separatorIndex + 1);

  return SOURCE_PATTERN.test(source) && ID_PATTERN.test(id) ? { source, id } : null;
}
