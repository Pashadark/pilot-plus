'use client';

import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import {
  extendRentalAction,
  handoverRentalAction,
  returnRentalAction,
  weeklyInspectionRentalAction,
  type RentalActionResult,
} from '@/modules/rentals/server/actions';
import { useToast } from '@/shared/providers/ToastProvider';
import { Button } from '@/shared/ui/Button';
import { Input, Select, Textarea } from '@/shared/ui/FormControls';
import { Modal } from '@/shared/ui/Overlays';

import { RentalOperationProgress } from './RentalOperationProgress';
import { ReturnEvidenceDropzone } from './ReturnEvidenceDropzone';
import { buildRentalOperationToast } from './rental-operation-toast';

export type RentalOperationDialogKind = 'HANDOVER' | 'EXTENSION' | 'RETURN' | 'WEEKLY_INSPECTION';

const actionByKind = {
  HANDOVER: handoverRentalAction,
  EXTENSION: extendRentalAction,
  RETURN: returnRentalAction,
  WEEKLY_INSPECTION: weeklyInspectionRentalAction,
};
const titleByKind = {
  HANDOVER: 'Выдать / Подать автомобиль',
  EXTENSION: 'Продлить аренду',
  RETURN: 'Приём автомобиля',
  WEEKLY_INSPECTION: 'Еженедельный осмотр',
};

function moscowLocalDateTime(value: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Moscow',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
    .formatToParts(value)
    .reduce<Record<string, string>>((result, part) => ({ ...result, [part.type]: part.value }), {});
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

function moscowLocalNow() {
  return moscowLocalDateTime(new Date());
}

function extensionDefaultValue(endsAt?: string) {
  if (!endsAt) return undefined;
  const date = new Date(endsAt);
  return Number.isNaN(date.getTime()) ? undefined : moscowLocalDateTime(date);
}

export function RentalOperationDialog({
  kind,
  open,
  onOpenChange,
  operationIdempotencyKey,
  rental,
}: {
  kind: RentalOperationDialogKind;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  operationIdempotencyKey: string;
  rental: { id: string; companyId: string; endsAt?: string; vehicleLabel?: string };
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [video, setVideo] = useState<{ name: string; size: number } | null>(null);
  const [dashboardPhoto, setDashboardPhoto] = useState<{ name: string; size: number } | null>(null);
  const hasVideo = Boolean(video);
  const hasDashboardPhoto = Boolean(dashboardPhoto);
  const [state, action, pending] = useActionState<RentalActionResult | null, FormData>(
    actionByKind[kind],
    null,
  );
  useEffect(() => {
    if (!state) return;
    showToast(buildRentalOperationToast(kind, state));
    if (state.ok) {
      onOpenChange(false);
      router.refresh();
    }
  }, [kind, onOpenChange, router, showToast, state]);

  return (
    <Modal
      open={open}
      onOpenChange={(nextOpen) => {
        if (!pending) onOpenChange(nextOpen);
      }}
      title={titleByKind[kind]}
      description={
        kind === 'RETURN'
          ? (rental.vehicleLabel ?? 'Осмотр и фиксация состояния автомобиля')
          : 'Поля сохраняются в неизменяемой истории договора, клиента и автомобиля.'
      }
      className="max-h-[90dvh] overflow-y-auto"
    >
      {pending && kind === 'RETURN' ? (
        <div
          role="status"
          aria-live="polite"
          className="grid min-h-56 place-items-center gap-4 py-10 text-center"
        >
          <span
            aria-hidden="true"
            className="size-10 animate-spin rounded-full border-4 border-[var(--color-primary-soft)] border-t-[var(--color-primary)]"
          />
          <div>
            <p className="text-base font-semibold">Сохраняем возврат…</p>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              Фиксируем пробег, топливо и материалы осмотра
            </p>
          </div>
        </div>
      ) : (
        <form action={action} className="grid gap-4">
          <input type="hidden" name="companyId" value={rental.companyId} />
          <input type="hidden" name="rentalId" value={rental.id} />
          <input type="hidden" name="idempotencyKey" value={operationIdempotencyKey} />
          {kind === 'RETURN' ? (
            <>
              <input type="hidden" name="occurredAt" value={moscowLocalNow()} />
              <div className="flex items-center gap-3 py-1 text-sm font-semibold">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--color-primary)] text-[var(--color-text-inverse)]">
                  1
                </span>
                <span>Осмотр и фиксация</span>
                <span aria-hidden="true" className="h-px flex-1 bg-[var(--color-border)]" />
              </div>
            </>
          ) : (
            <Input
              label="Дата и время операции"
              name="occurredAt"
              type="datetime-local"
              defaultValue={moscowLocalNow()}
              required
            />
          )}

          {kind === 'EXTENSION' ? (
            <>
              <Input
                label="Новая дата возврата"
                name="nextEndsAt"
                type="datetime-local"
                defaultValue={extensionDefaultValue(rental.endsAt)}
                required
              />
              <Textarea label="Комментарий" name="notes" maxLength={1000} />
            </>
          ) : kind === 'WEEKLY_INSPECTION' ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Пробег, км" name="mileageKm" type="number" min={0} step={1} />
                <Input
                  label="Топливо, %"
                  name="fuelLevelPercent"
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                />
              </div>
              <div className="grid gap-4 rounded-xl border border-[#673AB7]/30 bg-[#673AB7]/5 p-4">
                <div>
                  <p className="font-semibold text-[#673AB7]">Еженедельная фиксация</p>
                  <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                    Обязательны приборка, кузов с четырёх сторон и видео автомобиля.
                  </p>
                </div>
                <Input
                  label="Фото приборной панели"
                  name="dashboardPhoto"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  required
                  disabled={pending}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  {[
                    ['bodyPhotoFront', 'Кузов спереди'],
                    ['bodyPhotoRear', 'Кузов сзади'],
                    ['bodyPhotoLeft', 'Кузов слева'],
                    ['bodyPhotoRight', 'Кузов справа'],
                  ].map(([name, label]) => (
                    <Input
                      key={name}
                      label={label}
                      name={name}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      required
                      disabled={pending}
                    />
                  ))}
                </div>
                <Input
                  label="Видео осмотра автомобиля"
                  name="inspectionVideo"
                  type="file"
                  accept="video/mp4,video/webm"
                  required
                  disabled={pending}
                />
              </div>
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
                <Input
                  label="Пробег, км"
                  name="mileageKm"
                  type="number"
                  min={0}
                  step={1}
                  required
                />
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
              {kind === 'HANDOVER' ? (
                <div className="grid gap-4 rounded-xl border border-[var(--color-border)] p-4">
                  <div>
                    <p className="text-sm font-semibold">Фиксация состояния (необязательно)</p>
                    <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                      Файлы сохраняются сразу. Их отсутствие не мешает закрыть аренду.
                    </p>
                  </div>
                  <Input
                    label="Видео осмотра автомобиля"
                    name="inspectionVideo"
                    type="file"
                    accept="video/mp4,video/webm"
                    hint="MP4 или WebM, до 90 МБ."
                    disabled={pending}
                    onChange={(event) => {
                      const file = event.currentTarget.files?.[0];
                      setVideo(file ? { name: file.name, size: file.size } : null);
                    }}
                  />
                  <Input
                    label="Фото приборной панели"
                    name="dashboardPhoto"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    hint="JPG, PNG или WebP, до 15 МБ."
                    disabled={pending}
                    onChange={(event) => {
                      const file = event.currentTarget.files?.[0];
                      setDashboardPhoto(file ? { name: file.name, size: file.size } : null);
                    }}
                  />
                  <p className="text-xs text-[var(--color-text-secondary)]" aria-live="polite">
                    {hasVideo && hasDashboardPhoto
                      ? 'Полная фиксация: видео и фото выбраны.'
                      : 'Если файл пропущен, ниже укажите причину.'}
                  </p>
                </div>
              ) : null}
              {kind === 'RETURN' ? (
                <section className="grid gap-3" aria-labelledby="return-evidence-title">
                  <div>
                    <h3 id="return-evidence-title" className="text-lg font-bold">
                      Фото и видео
                    </h3>
                    <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                      Перетащите файлы или нажмите на область
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <ReturnEvidenceDropzone
                      name="dashboardPhoto"
                      label="Приборная панель"
                      illustration="dashboard"
                      accept="image/jpeg,image/png,image/webp"
                      wide
                      disabled={pending}
                    />
                    <ReturnEvidenceDropzone
                      name="bodyPhotoFront"
                      label="Перед"
                      illustration="front"
                      accept="image/jpeg,image/png,image/webp"
                      disabled={pending}
                    />
                    <ReturnEvidenceDropzone
                      name="bodyPhotoRight"
                      label="Правый бок"
                      illustration="right"
                      accept="image/jpeg,image/png,image/webp"
                      disabled={pending}
                    />
                    <ReturnEvidenceDropzone
                      name="bodyPhotoRear"
                      label="Зад"
                      illustration="rear"
                      accept="image/jpeg,image/png,image/webp"
                      disabled={pending}
                    />
                    <ReturnEvidenceDropzone
                      name="bodyPhotoLeft"
                      label="Левый бок"
                      illustration="left"
                      accept="image/jpeg,image/png,image/webp"
                      disabled={pending}
                    />
                    <ReturnEvidenceDropzone
                      name="inspectionVideo"
                      label="Видео кругового осмотра"
                      illustration="video"
                      accept="video/mp4,video/webm"
                      hint="MP4 или WebM, до 90 МБ"
                      wide
                      disabled={pending}
                    />
                  </div>
                </section>
              ) : null}
              {kind === 'HANDOVER' ? (
                <RentalOperationProgress pending={pending} video={video} photo={dashboardPhoto} />
              ) : null}
              {kind === 'HANDOVER' ? (
                <>
                  <Textarea
                    label="Причина отсутствия фиксации"
                    name="evidenceMissingReason"
                    required={!(hasVideo && hasDashboardPhoto)}
                    hint="Обязательно, если видео или фото отсутствуют."
                    maxLength={1000}
                  />
                </>
              ) : null}
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
                  <Textarea
                    label="Комментарий"
                    name="damageDescription"
                    hint="Опишите новые повреждения, если они есть."
                    maxLength={2000}
                  />
                </>
              ) : null}
              {kind === 'HANDOVER' ? (
                <>
                  <Select
                    label="Статус залога"
                    name="depositStatus"
                    defaultValue="COLLECTED"
                    required
                  >
                    <option value="COLLECTED">Получен</option>
                    <option value="RETURNED">Возвращён полностью</option>
                    <option value="PARTIALLY_WITHHELD">Удержан частично</option>
                    <option value="WITHHELD">Удержан полностью</option>
                    <option value="NOT_COLLECTED">Не получен</option>
                  </Select>
                  <Input
                    label="Сумма залога, коп."
                    name="depositAmountMinor"
                    type="number"
                    min={0}
                    step={1}
                  />
                  <Select
                    label="Способ оплаты залога"
                    name="depositPaymentMethod"
                    defaultValue="CASH"
                  >
                    <option value="CASH">Наличные</option>
                    <option value="CARD">Карта</option>
                    <option value="TRANSFER">Перевод</option>
                    <option value="OTHER">Другое</option>
                  </Select>
                </>
              ) : kind === 'RETURN' ? (
                <p className="rounded-xl bg-[var(--color-primary-soft)] px-4 py-3 text-sm font-medium text-[var(--color-text-secondary)]">
                  Залог будет возвращён отдельно — до 21 рабочего дня
                </p>
              ) : null}
            </>
          )}

          {state && !state.ok ? (
            <p role="alert" className="text-sm text-[var(--color-danger)]">
              {state.message}
            </p>
          ) : null}
          <div
            className={`grid grid-cols-2 gap-3 pt-2 ${kind === 'RETURN' ? 'sticky -bottom-5 z-20 -mx-5 border-t bg-[var(--color-surface)] px-5 py-4' : ''}`}
          >
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              disabled={pending}
              onClick={() => onOpenChange(false)}
            >
              Отмена
            </Button>
            <Button type="submit" className="w-full" loading={pending}>
              {pending
                ? 'Сохраняем…'
                : kind === 'RETURN'
                  ? 'Принять автомобиль'
                  : kind === 'WEEKLY_INSPECTION'
                    ? 'Сохранить осмотр'
                    : 'Сохранить'}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
