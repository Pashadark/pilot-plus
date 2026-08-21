'use client';

import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import {
  extendRentalAction,
  handoverRentalAction,
  returnRentalAction,
  type RentalActionResult,
} from '@/modules/rentals/server/actions';
import { useToast } from '@/shared/providers/ToastProvider';
import { Button } from '@/shared/ui/Button';
import { Input, Select, Textarea } from '@/shared/ui/FormControls';
import { Modal } from '@/shared/ui/Overlays';

export type RentalOperationDialogKind = 'HANDOVER' | 'EXTENSION' | 'RETURN';

const actionByKind = {
  HANDOVER: handoverRentalAction,
  EXTENSION: extendRentalAction,
  RETURN: returnRentalAction,
};
const titleByKind = {
  HANDOVER: 'Выдать / Подать автомобиль',
  EXTENSION: 'Продлить аренду',
  RETURN: 'Принять возврат',
};

function moscowLocalNow() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Moscow',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
    .formatToParts(new Date())
    .reduce<Record<string, string>>((result, part) => ({ ...result, [part.type]: part.value }), {});
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export function RentalOperationDialog({
  kind,
  open,
  onOpenChange,
  rental,
}: {
  kind: RentalOperationDialogKind;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rental: { id: string; companyId: string };
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [idempotencyKey, setIdempotencyKey] = useState('');
  const [hasVideo, setHasVideo] = useState(false);
  const [hasDashboardPhoto, setHasDashboardPhoto] = useState(false);
  useEffect(() => {
    setIdempotencyKey(`${kind.toLowerCase()}-${rental.id}-${crypto.randomUUID()}`);
  }, [kind, rental.id]);
  const [state, action, pending] = useActionState<RentalActionResult | null, FormData>(
    actionByKind[kind],
    null,
  );
  useEffect(() => {
    if (!state) return;
    showToast({
      tone: state.ok ? 'success' : 'danger',
      title: state.ok ? 'Операция аренды сохранена.' : state.message,
    });
    if (state.ok) {
      setIdempotencyKey(`${kind.toLowerCase()}-${rental.id}-${crypto.randomUUID()}`);
      onOpenChange(false);
      router.refresh();
    }
  }, [onOpenChange, router, showToast, state]);

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={titleByKind[kind]}
      description="Поля сохраняются в неизменяемой истории договора, клиента и автомобиля."
      className="max-h-[90dvh] overflow-y-auto"
    >
      <form action={action} className="grid gap-4">
        <input type="hidden" name="companyId" value={rental.companyId} />
        <input type="hidden" name="rentalId" value={rental.id} />
        <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
        <Input
          label="Дата и время операции"
          name="occurredAt"
          type="datetime-local"
          defaultValue={moscowLocalNow()}
          required
        />

        {kind === 'EXTENSION' ? (
          <>
            <Input label="Новая дата возврата" name="nextEndsAt" type="datetime-local" required />
            <Textarea label="Комментарий" name="notes" maxLength={1000} />
          </>
        ) : (
          <>
            {kind === 'HANDOVER' ? (
              <>
                <Select
                  label="Способ получения"
                  name="fulfillmentMethod"
                  defaultValue="OFFICE"
                  required
                >
                  <option value="OFFICE">Выдача в офисе</option>
                  <option value="DELIVERY">Подача по адресу</option>
                </Select>
                <Input label="Адрес подачи" name="fulfillmentAddress" maxLength={500} />
              </>
            ) : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Пробег, км" name="mileageKm" type="number" min={0} step={1} required />
              <Input
                label="Топливо, %"
                name="fuelLevelPercent"
                type="number"
                min={0}
                max={100}
                step={1}
                required
              />
            </div>
            <div className="grid gap-4 rounded-xl border border-[var(--color-border)] p-4">
              <p className="text-sm font-semibold">Фиксация состояния</p>
              <Input
                label="Видео осмотра автомобиля"
                name="inspectionVideo"
                type="file"
                accept="video/mp4,video/webm"
                hint="MP4 или WebM, до 150 МБ. Файл проверяется антивирусом."
                onChange={(event) => setHasVideo(Boolean(event.currentTarget.files?.length))}
              />
              <Input
                label="Фото приборной панели"
                name="dashboardPhoto"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                hint="JPG, PNG или WebP, до 15 МБ."
                onChange={(event) =>
                  setHasDashboardPhoto(Boolean(event.currentTarget.files?.length))
                }
              />
              <p className="text-xs text-[var(--color-text-secondary)]" aria-live="polite">
                {hasVideo && hasDashboardPhoto
                  ? 'Полная фиксация: видео и фото выбраны.'
                  : 'Если файл пропущен, ниже обязательно укажите причину.'}
              </p>
            </div>
            <Textarea
              label="Причина отсутствия фиксации"
              name="evidenceMissingReason"
              required={!(hasVideo && hasDashboardPhoto)}
              hint="Обязательно, если видео или фото отсутствуют."
              maxLength={1000}
            />
            {kind === 'RETURN' ? (
              <>
                <Select
                  label="Состояние автомобиля"
                  name="vehicleCondition"
                  defaultValue="GOOD"
                  required
                >
                  <option value="GOOD">Без новых повреждений</option>
                  <option value="DAMAGE_RECORDED">Есть новые повреждения</option>
                </Select>
                <Textarea label="Описание повреждений" name="damageDescription" maxLength={2000} />
              </>
            ) : null}
            <Select
              label="Статус залога"
              name="depositStatus"
              defaultValue={kind === 'HANDOVER' ? 'COLLECTED' : 'RETURNED'}
              required
            >
              {kind === 'HANDOVER' ? <option value="COLLECTED">Получен</option> : null}
              <option value="RETURNED">Возвращён полностью</option>
              <option value="PARTIALLY_WITHHELD">Удержан частично</option>
              <option value="WITHHELD">Удержан полностью</option>
              <option value="NOT_COLLECTED">Не получен</option>
            </Select>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Сумма залога, коп."
                name="depositAmountMinor"
                type="number"
                min={0}
                step={1}
              />
              {kind === 'RETURN' ? (
                <Input
                  label="Удержано, коп."
                  name="depositWithheldMinor"
                  type="number"
                  min={0}
                  step={1}
                />
              ) : null}
            </div>
            {kind === 'HANDOVER' ? (
              <Select label="Способ оплаты залога" name="depositPaymentMethod" defaultValue="CASH">
                <option value="CASH">Наличные</option>
                <option value="CARD">Карта</option>
                <option value="TRANSFER">Перевод</option>
                <option value="OTHER">Другое</option>
              </Select>
            ) : (
              <Textarea
                label="Причина удержания залога"
                name="depositResolutionReason"
                maxLength={1000}
              />
            )}
          </>
        )}

        {state && !state.ok ? (
          <p role="alert" className="text-sm text-[var(--color-danger)]">
            {state.message}
          </p>
        ) : null}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            onClick={() => onOpenChange(false)}
          >
            Отмена
          </Button>
          <Button type="submit" className="w-full" loading={pending} disabled={!idempotencyKey}>
            Сохранить
          </Button>
        </div>
      </form>
    </Modal>
  );
}
