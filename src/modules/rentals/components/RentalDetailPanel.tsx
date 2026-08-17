'use client';

import Link from 'next/link';
import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FiDownload, FiFileText } from 'react-icons/fi';

import {
  cancelRentalAction,
  generateRentalDocumentsAction,
  type RentalActionResult,
} from '@/modules/rentals/server/actions';
import { useToast } from '@/shared/providers/ToastProvider';
import { Button } from '@/shared/ui/Button';
import { Card, CardContent, CardHeader } from '@/shared/ui/Card';

type DocumentItem = { version: number; format: 'DOCX' | 'PDF' };
type HistoryItem = { id: string; action: string; label: string | null; createdAt: string };
type GenerationItem = { version: number; status: string; updatedAt: string };

const generationLabels: Record<string, string> = {
  PENDING: 'Ожидает подготовки',
  PROMOTED: 'Проверяется',
  COMMITTED: 'Готово',
  ERROR: 'Не удалось подготовить',
  CLEANING: 'Удаляется',
};

const auditLabels: Record<string, string> = {
  CREATE: 'Черновик создан',
  UPDATE: 'Договор изменён',
  CONFIRM: 'Договор подтверждён',
  CANCEL: 'Договор отменён',
  GENERATE_DOCUMENTS: 'Документы сформированы',
  DOWNLOAD: 'Документ скачан',
};

const documentLinkClass =
  'inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-primary)] bg-transparent px-4 text-sm font-semibold text-[var(--color-primary)] transition-colors hover:bg-[var(--color-primary-soft)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]';

export function RentalDetailPanel({
  rental,
  documents,
  history,
  generations = [],
  source = 'Текущие данные черновика',
}: {
  rental: { id: string; companyId: string; status: string; contractNumber: string | null };
  documents: readonly DocumentItem[];
  history: readonly HistoryItem[];
  generations?: readonly GenerationItem[];
  source?: string;
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
      <Card className="min-w-0" role="region" aria-labelledby="rental-documents">
        <CardHeader className="flex flex-wrap items-center justify-between gap-3">
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
        </CardHeader>
        <CardContent className="grid gap-4">
          {documents.length ? (
            <div className="flex flex-wrap gap-3">
              {documents.map((document) => (
                <Link
                  key={`${document.version}-${document.format}`}
                  className={documentLinkClass}
                  href={`/rentals/${rental.id}/documents/${document.version}/${document.format}`}
                  aria-label={`Скачать ${document.format}, версия ${document.version}`}
                >
                  <FiDownload aria-hidden="true" />
                  Скачать {document.format}
                  <span className="text-xs opacity-75">v{document.version}</span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="flex items-start gap-3 rounded-[var(--radius-md)] bg-[var(--color-elevated)] p-4">
              <FiFileText
                className="mt-0.5 shrink-0 text-[var(--color-text-secondary)]"
                aria-hidden="true"
              />
              <p className="text-sm text-[var(--color-text-secondary)]">
                {source === 'Импортированный договор'
                  ? 'Для импортированного договора файлы не формировались.'
                  : 'Файлы договора ещё не готовы.'}
              </p>
            </div>
          )}
          {generations.length ? (
            <ul className="grid gap-1 text-sm text-[var(--color-text-secondary)]">
              {generations.map((item) => (
                <li key={`${item.version}-${item.status}`}>
                  Версия {item.version}: {generationLabels[item.status] ?? 'Состояние обновляется'}
                </li>
              ))}
            </ul>
          ) : null}
        </CardContent>
      </Card>
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
      <Card className="min-w-0" role="region" aria-labelledby="rental-history">
        <CardHeader>
          <h2 id="rental-history" className="text-lg font-bold">
            История действий
          </h2>
        </CardHeader>
        <CardContent>
          {history.length ? (
            <ol className="grid gap-2">
              {history.map((item) => (
                <li key={item.id} className="rounded-[var(--radius-md)] border p-3 text-sm">
                  <span className="font-semibold">
                    {auditLabels[item.action] ?? 'Действие с договором'}
                  </span>{' '}
                  ·{' '}
                  {new Intl.DateTimeFormat('ru-RU', {
                    dateStyle: 'short',
                    timeStyle: 'short',
                    timeZone: 'Europe/Moscow',
                  }).format(new Date(item.createdAt))}
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-[var(--color-text-secondary)]">
              Для этого договора действия пользователей не зафиксированы.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
