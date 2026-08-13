'use client';

import { useActionState, useState } from 'react';

import {
  applyFleetImportAction,
  previewFleetImportAction,
  type FleetImportActionState,
} from '../import/actions';
import { Button, Modal } from '@/shared/ui';

const initialState: FleetImportActionState = { ok: false, code: 'IDLE', message: '' };

export function FleetImportDialog({ companyId }: { companyId: string }) {
  const [open, setOpen] = useState(false);
  const [preview, previewAction, previewPending] = useActionState(
    previewFleetImportAction,
    initialState,
  );
  const [applied, applyAction, applyPending] = useActionState(applyFleetImportAction, initialState);
  const previewReady = preview.ok && 'token' in preview;
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
        <form action={previewAction} className="grid gap-4">
          <input type="hidden" name="companyId" value={companyId} />
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
            <form action={applyAction}>
              <input type="hidden" name="token" value={preview.token} />
              <input type="hidden" name="archiveIds" value="[]" />
              <Button type="submit" loading={applyPending}>
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
