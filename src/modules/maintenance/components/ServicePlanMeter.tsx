'use client';

import { useEffect, useState } from 'react';
import { Button, Modal } from '@/shared/ui';
import { readServicePlan, saveServicePlan } from '../service-plan-actions';
import { meterColor, serviceMeter } from '../service-meter';

type Plan = Awaited<ReturnType<typeof readServicePlan>>;
const number = (value: number) =>
  new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(value);

export function ServicePlanMeter({ vehicleId, compact = false }: { vehicleId: string; compact?: boolean }) {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [now] = useState(() => Date.now());
  useEffect(() => {
    let active = true;
    readServicePlan(vehicleId)
      .then((value) => {
        if (active) {
          setPlan(value);
          setError('');
        }
      })
      .catch(() => {
        if (active) setError('Не удалось загрузить ТО');
      });
    return () => {
      active = false;
    };
  }, [vehicleId]);
  const record = plan?.record;
  const meter = serviceMeter(plan?.current ?? null, record?.last ?? null, record?.next ?? null);
  const overdueDate = record?.date
    ? new Date(`${record.date}T23:59:59+03:00`).getTime() < now
    : false;
  return (
    <div className="min-w-0 flex-1 text-sm">
      <div className="flex items-center justify-between gap-2">
        <strong className="text-xs text-[var(--color-text-tertiary)]">До следующего ТО</strong>
        {!compact && plan?.canEdit ? (
          <button
            type="button"
            className="min-h-8 text-xs font-medium text-[var(--color-primary)]"
            onClick={() => {
              setMessage('');
              setOpen(true);
            }}
          >
            {record ? 'Изменить ТО' : 'Настроить ТО'}
          </button>
        ) : null}
      </div>
      {!plan && !error ? (
        <div
          aria-label="Загрузка ТО"
          className="mt-2 h-8 animate-pulse rounded bg-[var(--color-border)]"
        />
      ) : error ? (
        <p role="status">{error}</p>
      ) : (
        <>
          <p className="tabular-nums">
            {meter
              ? meter.remaining < 0
                ? `Просрочено на ${number(-meter.remaining)} км`
                : `${number(meter.remaining)} км`
              : record
                ? 'Нет данных для расчёта'
                : 'ТО не настроено'}
          </p>
          {meter ? (
            <div
              role="progressbar"
              aria-label="Остаток пробега до ТО"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(meter.percent)}
              className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--color-border)]"
            >
              <div
                className="h-full rounded-full transition-[width,background-color] duration-500 motion-reduce:transition-none"
                style={{
                  width: `${meter.percent}%`,
                  backgroundColor: meterColor(overdueDate ? 0 : meter.percent),
                }}
              />
            </div>
          ) : null}
          {!compact && record ? (
            <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
              {record.next !== null ? `ТО на ${number(record.next)} км` : ''}
              {record.date
                ? ` · ${record.date.split('-').reverse().join('.')}${overdueDate ? ' · срок прошёл' : ''}`
                : ''}
            </p>
          ) : null}
        </>
      )}
      <Modal
        open={open}
        onOpenChange={(value) => {
          if (!pending) setOpen(value);
        }}
        title="Следующее ТО"
        description="Укажите пробег последнего обслуживания и план следующего."
      >
        <form
          key={`${vehicleId}-${record?.version}`}
          className="grid gap-4"
          onSubmit={async (event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            setPending(true);
            setMessage('');
            try {
              const result = await saveServicePlan(vehicleId, form);
              setMessage(result.message);
              if (result.ok) {
                setPlan(await readServicePlan(vehicleId));
                setOpen(false);
              }
            } catch {
              setMessage('Не удалось сохранить ТО. Повторите попытку.');
            } finally {
              setPending(false);
            }
          }}
        >
          <input type="hidden" name="recordId" value={record?.id ?? ''} />
          <input type="hidden" name="version" value={record?.version ?? ''} />
          <label className="grid gap-1">
            Пробег последнего ТО, км
            <input
              name="last"
              type="number"
              min="0"
              max="10000000"
              step="1"
              required
              defaultValue={record?.last ?? ''}
              className="min-h-11 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3"
            />
          </label>
          <label className="grid gap-1">
            Пробег следующего ТО, км
            <input
              name="next"
              type="number"
              min="1"
              max="10000000"
              step="1"
              required
              defaultValue={record?.next ?? ''}
              className="min-h-11 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3"
            />
          </label>
          <label className="grid gap-1">
            Дата следующего ТО
            <input
              name="date"
              type="date"
              defaultValue={record?.date ?? ''}
              className="min-h-11 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3"
            />
          </label>
          <p role="status">{message}</p>
          <Button type="submit" disabled={pending}>
            {pending ? 'Сохранение…' : 'Сохранить'}
          </Button>
        </form>
      </Modal>
    </div>
  );
}
