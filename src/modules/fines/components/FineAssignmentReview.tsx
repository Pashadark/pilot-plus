'use client';

import { useActionState } from 'react';
import { FiCheck, FiUserCheck, FiX } from 'react-icons/fi';

import { assignFineAction } from '../server/assignment-actions';
import { Alert, Badge, Button } from '@/shared/ui';

export interface FineAssignmentCandidate {
  rentalId: string;
  contractNumber: string | null;
  clientDisplayName: string;
  startsAt: string;
  endsAt: string;
  distanceLabel: string;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/Moscow',
  }).format(new Date(value));
}

export function FineAssignmentReview({
  companyId,
  fineId,
  candidates,
  canManage,
  confirmedClientLabel,
  confirmedContractLabel,
}: {
  companyId: string;
  fineId: string;
  candidates: readonly FineAssignmentCandidate[];
  canManage: boolean;
  confirmedClientLabel?: string | null;
  confirmedContractLabel?: string | null;
}) {
  const [state, formAction, pending] = useActionState(assignFineAction, null);

  return (
    <section
      aria-label="Проверка привязки"
      className="grid gap-3 rounded-[var(--radius-md)] bg-[var(--color-elevated)] p-3"
    >
      {confirmedClientLabel ? (
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <Badge tone="success">
            <FiCheck aria-hidden="true" /> Подтверждённый клиент
          </Badge>
          <span className="font-medium">{confirmedClientLabel}</span>
          {confirmedContractLabel ? <span>· {confirmedContractLabel}</span> : null}
        </p>
      ) : null}

      {!confirmedClientLabel && candidates.length ? (
        <div className="grid gap-2">
          {candidates.map((candidate) => (
            <div
              key={candidate.rentalId}
              className="grid gap-2 rounded-[var(--radius-sm)] border bg-[var(--color-surface)] p-3 text-sm"
            >
              <Badge tone="warning" className="w-fit">
                Возможный клиент — требуется подтверждение
              </Badge>
              <p className="font-semibold">{candidate.clientDisplayName}</p>
              <p className="text-[var(--color-text-secondary)]">
                Договор {candidate.contractNumber ?? 'без номера'} · {candidate.distanceLabel}
              </p>
              <p className="text-[var(--color-text-secondary)]">
                {formatDate(candidate.startsAt)} — {formatDate(candidate.endsAt)}
              </p>
              {canManage ? (
                <form action={formAction}>
                  <input type="hidden" name="companyId" value={companyId} />
                  <input type="hidden" name="fineId" value={fineId} />
                  <input type="hidden" name="rentalId" value={candidate.rentalId} />
                  <Button
                    type="submit"
                    variant="outline"
                    loading={pending}
                    leadingIcon={<FiUserCheck aria-hidden="true" />}
                  >
                    Подтвердить клиента
                  </Button>
                </form>
              ) : null}
            </div>
          ))}
        </div>
      ) : !confirmedClientLabel ? (
        <p className="text-sm text-[var(--color-text-secondary)]">Подходящие аренды не найдены.</p>
      ) : null}

      {canManage ? (
        <form action={formAction}>
          <input type="hidden" name="companyId" value={companyId} />
          <input type="hidden" name="fineId" value={fineId} />
          <input type="hidden" name="rentalId" value="" />
          <Button
            type="submit"
            variant="ghost"
            loading={pending}
            leadingIcon={<FiX aria-hidden="true" />}
          >
            Снять привязку
          </Button>
        </form>
      ) : null}

      {state && !state.ok ? (
        <Alert tone="danger" title="Ошибка привязки" description={state.message} />
      ) : null}
    </section>
  );
}
