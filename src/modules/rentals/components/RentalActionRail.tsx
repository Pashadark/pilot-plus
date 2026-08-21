'use client';

import { useState } from 'react';

import { Button } from '@/shared/ui/Button';
import { Card, CardContent, CardHeader } from '@/shared/ui/Card';

import { RentalOperationDialog, type RentalOperationDialogKind } from './RentalOperationDialog';

type Rental = { id: string; companyId: string; status: string };

function actionsFor(
  status: string,
): readonly { kind: RentalOperationDialogKind; label: string; variant: 'primary' | 'secondary' }[] {
  if (status === 'CONFIRMED')
    return [{ kind: 'HANDOVER', label: 'Выдать / Подать', variant: 'primary' }];
  if (status === 'ACTIVE')
    return [
      { kind: 'EXTENSION', label: 'Продлить', variant: 'secondary' },
      { kind: 'RETURN', label: 'Принять возврат', variant: 'primary' },
    ];
  return [];
}

export function RentalActionRail({ rental }: { rental: Rental }) {
  const [openKind, setOpenKind] = useState<RentalOperationDialogKind | null>(null);
  const actions = actionsFor(rental.status);
  if (!actions.length) return null;
  const buttons = actions.map((action) => (
    <Button
      key={action.kind}
      variant={action.variant}
      className="min-h-12 w-full justify-center"
      onClick={() => setOpenKind(action.kind)}
    >
      {action.label}
    </Button>
  ));
  return (
    <>
      <aside
        data-testid="rental-action-rail"
        className="hidden self-start xl:sticky xl:top-5 xl:block xl:w-72"
      >
        <Card>
          <CardHeader>
            <h2 className="text-base font-bold">Действия</h2>
          </CardHeader>
          <CardContent className="grid gap-3">{buttons}</CardContent>
        </Card>
      </aside>
      <div className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-2 gap-2 border-t bg-[var(--color-surface)] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[var(--shadow-floating)] xl:hidden">
        {buttons}
      </div>
      {openKind ? (
        <RentalOperationDialog
          kind={openKind}
          open
          onOpenChange={(open) => !open && setOpenKind(null)}
          rental={rental}
        />
      ) : null}
    </>
  );
}
