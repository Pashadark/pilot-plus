'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { useToast } from '@/shared/providers/ToastProvider';
import { Button, ConfirmationDialog } from '@/shared/ui';

import { archiveVehicleAction, type VehicleActionState } from '../actions';

const initialState: VehicleActionState = { ok: false, code: 'IDLE', message: '' };

export function ArchiveVehiclePanel({
  companyId,
  vehicleId,
  vehicleLabel,
}: {
  companyId: string;
  vehicleId: string;
  vehicleLabel: string;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(archiveVehicleAction, initialState);

  useEffect(() => {
    if (state.ok) {
      showToast({ tone: 'success', title: 'Автомобиль убран из автопарка' });
      router.replace('/vehicles');
      return;
    }
    if (state.code === 'IDLE') return;
    showToast({
      tone: 'danger',
      title: 'Не удалось убрать автомобиль',
      description: state.message,
    });
  }, [router, showToast, state]);

  return (
    <section
      id="archive"
      className="rounded-[var(--radius-panel)] border border-[color-mix(in_srgb,var(--color-danger)_28%,var(--color-border))] bg-[var(--color-surface)] p-4 sm:p-5"
    >
      <h2 className="font-bold">Управление автомобилем</h2>
      <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
        Уберите автомобиль из рабочего автопарка. История аренд, ремонтов и штрафов сохранится.
      </p>
      <form ref={formRef} action={action} className="mt-4">
        <input type="hidden" name="companyId" value={companyId} />
        <input type="hidden" name="vehicleId" value={vehicleId} />
        <Button type="button" variant="danger" onClick={() => setOpen(true)} loading={pending}>
          Убрать из автопарка
        </Button>
      </form>

      <ConfirmationDialog
        open={open}
        onOpenChange={setOpen}
        title="Убрать автомобиль из автопарка?"
        description={vehicleLabel}
        onConfirm={() => {
          setOpen(false);
          formRef.current?.requestSubmit();
        }}
      >
        <p className="text-sm text-[var(--color-text-secondary)]">
          Автомобиль исчезнет из рабочего списка, но история аренд, ремонтов и штрафов сохранится.
          Если есть действующий договор, система не даст выполнить действие и покажет причину.
        </p>
        <Button type="button" variant="secondary" className="mt-4" onClick={() => setOpen(false)}>
          Отмена
        </Button>
      </ConfirmationDialog>
    </section>
  );
}
