'use client';

import Link from 'next/link';
import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import {
  cancelRentalAction,
  generateRentalDocumentsAction,
  type RentalActionResult,
} from '@/modules/rentals/server/actions';
import { useToast } from '@/shared/providers/ToastProvider';
import { Button } from '@/shared/ui/Button';

type DocumentItem = { version: number; format: 'DOCX' | 'PDF' };
type HistoryItem = { id: string; action: string; label: string | null; createdAt: string };
type GenerationItem = { version: number; status: string; updatedAt: string };

export function RentalDetailPanel({
  rental,
  documents,
  history,
  generations = [],
}: {
  rental: { id: string; companyId: string; status: string; contractNumber: string | null };
  documents: readonly DocumentItem[];
  history: readonly HistoryItem[];
  generations?: readonly GenerationItem[];
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelState, cancel] = useActionState<RentalActionResult | null, FormData>(
    cancelRentalAction,
    null,
  );
  const [retryState, retry] = useActionState<RentalActionResult | null, FormData>(
    generateRentalDocumentsAction,
    null,
  );
  const retryAvailable = rental.status === 'CONFIRMED' && documents.length < 2;
  const canCancel = rental.status === 'DRAFT' || rental.status === 'CONFIRMED';

  useEffect(() => {
    const state = cancelState ?? retryState;
    if (!state) return;
    showToast({
      tone: state.ok ? 'success' : 'danger',
      title: state.ok ? 'Данные договора обновлены.' : state.message,
    });
    if (state.ok) router.refresh();
  }, [cancelState, retryState, router, showToast]);

  return (
    <div className="grid min-w-0 gap-5">
      <section className="grid gap-3" aria-labelledby="rental-documents">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="rental-documents" className="text-lg font-bold">
            Документы
          </h2>
          {retryAvailable ? (
            <form action={retry}>
              <input type="hidden" name="companyId" value={rental.companyId} />
              <input type="hidden" name="rentalId" value={rental.id} />
              <Button type="submit">Повторить создание документов</Button>
            </form>
          ) : null}
        </div>
        {documents.length ? (
          <div className="flex flex-wrap gap-3">
            {documents.map((document) => (
              <Link
                key={`${document.version}-${document.format}`}
                className="inline-flex min-h-11 items-center text-[var(--color-primary)] focus-visible:outline-2"
                href={`/rentals/${rental.id}/documents/${document.version}/${document.format}`}
              >
                Скачать {document.format} v{document.version}
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-[var(--color-text-secondary)]">Файлы ещё не готовы.</p>
        )}
        {generations.length ? (
          <ul className="grid gap-1 text-sm text-[var(--color-text-secondary)]">
            {generations.map((item) => (
              <li key={`${item.version}-${item.status}`}>
                Версия {item.version}:{' '}
                {item.status === 'COMMITTED'
                  ? 'готова'
                  : item.status === 'ERROR'
                    ? 'ошибка подготовки'
                    : 'подготавливается'}
              </li>
            ))}
          </ul>
        ) : null}
      </section>
      {canCancel ? (
        <section
          aria-label="Отмена договора"
          className="grid gap-3 rounded-[var(--radius-md)] border p-4"
        >
          {confirmCancel ? <p className="font-semibold">Отменить подтверждённый договор?</p> : null}
          <div className="flex flex-wrap gap-3">
            {confirmCancel ? (
              <form action={cancel}>
                <input type="hidden" name="companyId" value={rental.companyId} />
                <input type="hidden" name="rentalId" value={rental.id} />
                <Button type="submit" variant="danger">
                  Подтвердить отмену
                </Button>
              </form>
            ) : (
              <Button variant="danger" onClick={() => setConfirmCancel(true)}>
                Отменить договор
              </Button>
            )}
            {confirmCancel ? (
              <Button variant="secondary" onClick={() => setConfirmCancel(false)}>
                Не отменять
              </Button>
            ) : null}
          </div>
        </section>
      ) : null}
      <section aria-labelledby="rental-history" className="grid gap-3">
        <h2 id="rental-history" className="text-lg font-bold">
          История действий
        </h2>
        {history.length ? (
          <ol className="grid gap-2">
            {history.map((item) => (
              <li key={item.id} className="rounded-[var(--radius-md)] border p-3 text-sm">
                <span className="font-semibold">{item.action}</span> ·{' '}
                {item.label ?? 'Действие с договором'} ·{' '}
                {new Intl.DateTimeFormat('ru-RU', {
                  dateStyle: 'short',
                  timeStyle: 'short',
                  timeZone: 'Europe/Moscow',
                }).format(new Date(item.createdAt))}
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-[var(--color-text-secondary)]">История пока отсутствует.</p>
        )}
      </section>
    </div>
  );
}
