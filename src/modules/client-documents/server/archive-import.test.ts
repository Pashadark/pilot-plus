import { describe, expect, it } from 'vitest';

import { planArchiveImport } from './archive-import';

describe('client document archive import planner', () => {
  it('imports only exact client matches and skips an existing file hash', () => {
    const result = planArchiveImport({
      entries: [
        {
          clientName: 'Иванов Иван Иванович',
          category: 'PASSPORT',
          title: 'Паспорт — основной разворот',
          sourcePath: 'ivanov-passport.jpg',
          sha256: 'same',
        },
        {
          clientName: 'Петров Пётр Петрович',
          category: 'DRIVER_LICENSE',
          title: 'Водительское удостоверение',
          sourcePath: 'petrov-license.jpg',
          sha256: 'new',
        },
      ],
      clients: [{ id: 'client-1', name: 'Иванов Иван Иванович' }],
      existingHashesByClientId: new Map([['client-1', new Set(['same'])]]),
    });

    expect(result.toImport).toEqual([]);
    expect(result.duplicates).toEqual([
      expect.objectContaining({ clientId: 'client-1', sourcePath: 'ivanov-passport.jpg' }),
    ]);
    expect(result.unmatched).toEqual([
      expect.objectContaining({ clientName: 'Петров Пётр Петрович' }),
    ]);
  });

  it('rejects ambiguous duplicate client names instead of guessing', () => {
    const entry = {
      clientName: 'Сидоров Семён Андреевич',
      category: 'PASSPORT' as const,
      title: 'Паспорт — регистрация',
      sourcePath: 'registration.webp',
      sha256: 'hash',
    };
    const result = planArchiveImport({
      entries: [entry],
      clients: [
        { id: 'client-1', name: entry.clientName },
        { id: 'client-2', name: entry.clientName },
      ],
      existingHashesByClientId: new Map(),
    });

    expect(result.toImport).toEqual([]);
    expect(result.ambiguous).toEqual([entry]);
  });
});
