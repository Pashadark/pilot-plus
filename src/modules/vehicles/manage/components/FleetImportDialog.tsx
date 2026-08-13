'use client';

import { useActionState, useEffect, useState } from 'react';

import {
  applyFleetImportAction,
  previewFleetImportAction,
  type FleetImportActionState,
} from '../import/actions';
import { Button, Modal } from '@/shared/ui';
import { useToast } from '@/shared/providers/ToastProvider';
import type { ManageableCompany } from './VehicleForm';

const initialState: FleetImportActionState = { ok: false, code: 'IDLE', message: '' };

export function FleetImportDialog({ companies }: { companies: readonly ManageableCompany[] }) {
  const [open, setOpen] = useState(false);
  const [archiveIds, setArchiveIds] = useState<string[]>([]);
  const [previewCompanyId, setPreviewCompanyId] = useState(
    companies.length === 1 ? (companies[0]?.id ?? '') : '',
  );
  const [preview, previewAction, previewPending] = useActionState(
    previewFleetImportAction,
    initialState,
  );
  const [applied, applyAction, applyPending] = useActionState(applyFleetImportAction, initialState);
  const previewReady = preview.ok && 'token' in preview;
  const canArchivePreview =
    companies.find((company) => company.id === previewCompanyId)?.canArchive === true;
  const { showToast } = useToast();
  useEffect(() => {
    if (preview.ok && 'token' in preview)
      showToast({ tone: 'success', title: 'Предпросмотр готов', description: preview.message });
    else if (!preview.ok && preview.message)
      showToast({
        tone: 'danger',
        title: 'Не удалось подготовить предпросмотр',
        description: preview.message,
      });
  }, [preview, showToast]);
  useEffect(() => {
    if (applied.ok && 'created' in applied)
      showToast({ tone: 'success', title: 'Импорт завершён', description: applied.message });
    else if (!applied.ok && applied.message)
      showToast({
        tone: 'danger',
        title: 'Не удалось применить импорт',
        description: applied.message,
      });
  }, [applied, showToast]);
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Импортировать Excel
      </Button>
      <Modal
        open={open}
        onOpenChange={setOpen}
        title="Импорт автопарка"
        description="Загрузите книгу Excel для безопасного предпросмотра."
      >
        <form
          action={previewAction}
          onSubmit={(event) =>
            setPreviewCompanyId(String(new FormData(event.currentTarget).get('companyId') ?? ''))
          }
          className="grid gap-4"
        >
          {companies.length === 1 ? (
            <input type="hidden" name="companyId" value={companies[0]?.id} />
          ) : (
            <label className="grid gap-1.5 text-sm font-medium">
              Компания
              <select
                name="companyId"
                required
                className="min-h-11 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3"
              >
                <option value="">Выберите компанию</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="grid gap-1.5 text-sm font-medium">
            Файл Excel
            <input name="workbook" type="file" accept=".xlsx" required className="min-h-11" />
          </label>
          {!preview.ok && preview.message && (
            <p role="alert" className="text-sm text-[var(--color-danger)]">
              {preview.message}
            </p>
          )}
          <Button type="submit" loading={previewPending}>
            Подготовить предпросмотр
          </Button>
        </form>
        {previewReady && (
          <div className="mt-5 grid gap-3">
            <p className="font-semibold">
              Будет добавлено: {preview.rows.filter((row) => row.operation === 'ADD').length}
            </p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[34rem] text-left text-sm">
                <thead>
                  <tr>
                    <th>Автомобиль</th>
                    <th>Год</th>
                    <th>Результат</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((row) => (
                    <tr key={row.row.rowNumber} className="border-t border-[var(--color-border)]">
                      <td>
                        {row.row.make} {row.row.model}
                        <br />
                        <span className="text-[var(--color-text-secondary)]">
                          {row.row.registrationNumberNormalized}
                        </span>
                      </td>
                      <td>{row.row.year}</td>
                      <td
                        className={
                          row.operation === 'ERROR'
                            ? 'font-semibold text-[var(--color-danger)]'
                            : ''
                        }
                      >
                        {row.operation === 'ADD'
                          ? 'Добавить'
                          : row.operation === 'UPDATE'
                            ? 'Обновить'
                            : row.operation === 'ERROR'
                              ? 'Ошибка импорта'
                              : 'Без изменений'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {preview.optionalArchives.length > 0 && canArchivePreview && (
              <fieldset className="grid gap-2">
                <legend className="font-semibold">Архивировать отсутствующие автомобили</legend>
                {preview.optionalArchives.map((vehicle) => (
                  <label key={vehicle.id} className="flex min-h-11 items-center gap-2">
                    <input
                      type="checkbox"
                      checked={archiveIds.includes(vehicle.id)}
                      onChange={(event) =>
                        setArchiveIds((ids) =>
                          event.target.checked
                            ? [...ids, vehicle.id]
                            : ids.filter((id) => id !== vehicle.id),
                        )
                      }
                    />{' '}
                    {vehicle.internalNumber}
                  </label>
                ))}
              </fieldset>
            )}
            <form action={applyAction}>
              <input type="hidden" name="token" value={preview.token} />
              <input
                type="hidden"
                name="archiveIds"
                value={JSON.stringify(canArchivePreview ? archiveIds : [])}
              />
              <Button
                type="submit"
                loading={applyPending}
                disabled={preview.rows.some((row) => row.operation === 'ERROR')}
              >
                Применить импорт
              </Button>
            </form>
          </div>
        )}
        {applied.ok && 'created' in applied && (
          <p role="status" className="mt-3 text-sm text-[var(--color-success)]">
            Импорт завершён: добавлено {applied.created}.
          </p>
        )}
      </Modal>
    </>
  );
}
