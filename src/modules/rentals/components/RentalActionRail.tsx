'use client';

import { useState } from 'react';
import Link from 'next/link';

import { Button } from '@/shared/ui/Button';
import { Card, CardContent, CardHeader } from '@/shared/ui/Card';

import { RentalOperationDialog, type RentalOperationDialogKind } from './RentalOperationDialog';
import type { HandoverReadiness } from '../readiness/evaluate-handover-readiness';

type Rental = {
  id: string;
  companyId: string;
  status: string;
  endsAt?: string;
  agreementType?: 'STANDARD' | 'LEASE_TO_OWN';
  vehicleLabel?: string;
};

function actionsFor(
  rental: Rental,
): readonly { kind: RentalOperationDialogKind; label: string; variant: 'primary' | 'secondary' }[] {
  if (rental.status === 'CONFIRMED')
    return [{ kind: 'HANDOVER', label: 'Выдать / Подать', variant: 'primary' }];
  if (rental.status === 'ACTIVE')
    return [
      ...(rental.agreementType === 'LEASE_TO_OWN'
        ? ([
            {
              kind: 'WEEKLY_INSPECTION',
              label: 'Добавить еженедельный осмотр',
              variant: 'secondary',
            },
          ] as const)
        : []),
      { kind: 'EXTENSION', label: 'Продлить', variant: 'secondary' },
      { kind: 'RETURN', label: 'Принять возврат', variant: 'primary' },
    ];
  return [];
}

export function RentalActionRail({
  rental,
  canEdit = false,
  handoverReadiness = { ready: true, blockers: [] },
  initialAction = null,
}: {
  rental: Rental;
  canEdit?: boolean;
  handoverReadiness?: HandoverReadiness;
  initialAction?: RentalOperationDialogKind | null;
}) {
  const actions = actionsFor(rental);
  const validInitialAction =
    initialAction && actions.some(({ kind }) => kind === initialAction) ? initialAction : null;
  const [openKind, setOpenKind] = useState<RentalOperationDialogKind | null>(validInitialAction);
  const [operationIdempotencyKey, setOperationIdempotencyKey] = useState(() =>
    validInitialAction
      ? `${validInitialAction.toLowerCase()}-${rental.id}-${globalThis.crypto.randomUUID()}`
      : '',
  );

  if (!actions.length && !canEdit) return null;
  const actionButtons = (scope: 'desktop' | 'mobile') =>
    actions.map((action) => {
      const blocked = action.kind === 'HANDOVER' && !handoverReadiness.ready;
      return (
        <Button
          key={action.kind}
          variant={action.variant}
          className="min-h-12 w-full justify-center"
          disabled={blocked}
          aria-describedby={blocked ? `handover-blockers-${scope}` : undefined}
          onClick={() => {
            if (blocked) return;
            setOperationIdempotencyKey(
              `${action.kind.toLowerCase()}-${rental.id}-${globalThis.crypto.randomUUID()}`,
            );
            setOpenKind(action.kind);
          }}
        >
          {action.label}
        </Button>
      );
    });
  const readinessNotice = (scope: 'desktop' | 'mobile') =>
    rental.status === 'CONFIRMED' && !handoverReadiness.ready ? (
      <div
        id={`handover-blockers-${scope}`}
        className="grid gap-1 rounded-[var(--radius-md)] border border-[var(--color-warning)] bg-[var(--color-warning-soft)] p-3 text-xs"
      >
        <p className="font-semibold">До выдачи исправьте:</p>
        {handoverReadiness.blockers.map((blocker) => (
          <Link key={blocker.code} href={blocker.href} className="underline underline-offset-2">
            {blocker.message}
          </Link>
        ))}
      </div>
    ) : null;
  const editLink = canEdit ? (
    <Link
      href={`/rentals/${rental.id}/edit`}
      className="inline-flex min-h-12 w-full items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-4 text-center text-sm font-semibold text-[var(--color-text)] hover:bg-[var(--color-primary-soft)]"
    >
      Редактировать договор
    </Link>
  ) : null;
  return (
    <>
      <aside
        id="rental-actions"
        data-testid="rental-action-rail"
        className="hidden self-start xl:sticky xl:top-5 xl:block xl:w-72"
      >
        <Card>
          <CardHeader>
            <h2 className="text-base font-bold">Действия</h2>
          </CardHeader>
          <CardContent className="grid gap-3">
            {readinessNotice('desktop')}
            {editLink}
            {actionButtons('desktop')}
          </CardContent>
        </Card>
      </aside>
      <div className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-2 gap-2 border-t bg-[var(--color-surface)] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[var(--shadow-floating)] xl:hidden">
        {readinessNotice('mobile')}
        {editLink}
        {actionButtons('mobile')}
      </div>
      {openKind ? (
        <RentalOperationDialog
          kind={openKind}
          open
          operationIdempotencyKey={operationIdempotencyKey}
          onOpenChange={(open) => !open && setOpenKind(null)}
          rental={rental}
        />
      ) : null}
    </>
  );
}
