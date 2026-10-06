'use client';

import { useState, type ReactNode } from 'react';

type Tab = 'overview' | 'rentals' | 'fines' | 'documents' | 'comments';

export function ClientWorkspaceTabs({
  rentalCount,
  fineCount,
  commentCount,
  overview,
  rentals,
  fines,
  documents,
  comments,
}: {
  rentalCount: number;
  fineCount: number;
  commentCount: number;
  overview: ReactNode;
  rentals: ReactNode;
  fines: ReactNode;
  documents: ReactNode;
  comments: ReactNode;
}) {
  const [active, setActive] = useState<Tab>('overview');
  const tabs: Array<{ id: Tab; label: string; content: ReactNode }> = [
    { id: 'overview', label: 'Обзор', content: overview },
    { id: 'rentals', label: `Аренды ${rentalCount}`, content: rentals },
    { id: 'fines', label: `Штрафы ${fineCount}`, content: fines },
    { id: 'documents', label: 'Документы', content: documents },
    { id: 'comments', label: `Комментарии ${commentCount}`, content: comments },
  ];
  return (
    <section className="min-w-0">
      <div
        role="tablist"
        aria-label="Разделы карточки клиента"
        className="scrollbar-hidden flex gap-1 overflow-x-auto border-b border-[var(--color-border)]"
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active === tab.id}
            onClick={() => setActive(tab.id)}
            className="min-h-11 shrink-0 border-b-2 border-transparent px-4 text-sm font-semibold text-[var(--color-text-secondary)] aria-selected:border-[var(--color-primary)] aria-selected:text-[var(--color-primary)]"
          >
            {tab.label}
          </button>
        ))}
      </div>
      {tabs.map((tab) => (
        <div key={tab.id} role="tabpanel" hidden={active !== tab.id} className="pt-5">
          {tab.content}
        </div>
      ))}
    </section>
  );
}
