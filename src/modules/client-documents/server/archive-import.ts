import type { ClientDocumentCategory } from '@/database/generated/prisma';

export type ArchiveImportEntry = {
  clientName: string;
  category: ClientDocumentCategory;
  title: string;
  sourcePath: string;
  sha256: string;
};

type ImportClient = { id: string; name: string };

export function planArchiveImport({
  entries,
  clients,
  existingHashesByClientId,
}: {
  entries: ArchiveImportEntry[];
  clients: ImportClient[];
  existingHashesByClientId: ReadonlyMap<string, ReadonlySet<string>>;
}) {
  const clientsByName = new Map<string, ImportClient[]>();
  for (const client of clients) {
    const matches = clientsByName.get(client.name) ?? [];
    matches.push(client);
    clientsByName.set(client.name, matches);
  }

  const toImport: Array<ArchiveImportEntry & { clientId: string }> = [];
  const duplicates: Array<ArchiveImportEntry & { clientId: string }> = [];
  const unmatched: ArchiveImportEntry[] = [];
  const ambiguous: ArchiveImportEntry[] = [];

  for (const entry of entries) {
    const matches = clientsByName.get(entry.clientName) ?? [];
    if (matches.length === 0) {
      unmatched.push(entry);
      continue;
    }
    if (matches.length !== 1) {
      ambiguous.push(entry);
      continue;
    }

    const clientId = matches[0].id;
    const planned = { ...entry, clientId };
    if (existingHashesByClientId.get(clientId)?.has(entry.sha256)) {
      duplicates.push(planned);
    } else {
      toImport.push(planned);
    }
  }

  return { toImport, duplicates, unmatched, ambiguous };
}
