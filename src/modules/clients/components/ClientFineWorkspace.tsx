import Link from 'next/link';
import {
  FiCalendar,
  FiCheckCircle,
  FiClock,
  FiFileText,
  FiMapPin,
  FiTruck,
} from 'react-icons/fi';

import type { ClientFineWorkspaceDto } from '../types';
import { Badge, Card } from '@/shared/ui';
import { ClientFineCopyButton } from './ClientFineCopyButton';

const statusLabels = { NEW: 'Не оплачен', UNPAID: 'Не оплачен', OVERDUE: 'Просрочен', PAID: 'Оплачен', CANCELLED: 'Отменён', ARCHIVED: 'Архив' };

function money(value: string) {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency', currency: 'RUB', maximumFractionDigits: Number(BigInt(value) % BigInt(100)) ? 2 : 0,
  }).format(Number(value) / 100);
}
function day(value: string | null) {
  return value ? new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Moscow', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value)) : 'Не указана';
}
function moment(value: string) {
  return new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Moscow', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

export function ClientFineWorkspace({ clientId, workspace }: { clientId: string; workspace: ClientFineWorkspaceDto }) {
  if (workspace.fines.length === 0) {
    return (
      <Card className="grid place-items-center gap-3 p-8 text-center">
        <span className="grid size-12 place-items-center rounded-full bg-[var(--color-elevated)] text-[var(--color-text-secondary)]"><FiFileText aria-hidden="true" /></span>
        <div><h2 className="font-bold">У клиента нет привязанных штрафов</h2><p className="mt-1 text-sm text-[var(--color-text-secondary)]">После подтверждения водителя штраф появится здесь автоматически.</p></div>
      </Card>
    );
  }
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <p className="text-[var(--color-text-secondary)]">Всего {workspace.summary.total} Не оплачено {workspace.summary.unpaid}</p>
        {workspace.summary.unpaid ? <strong>К оплате {money(workspace.summary.unpaidAmountMinor)}</strong> : null}
      </div>
      {workspace.fines.map((fine) => {
        const paid = fine.status === 'PAID';
        const closed = paid || fine.status === 'CANCELLED' || fine.status === 'ARCHIVED';
        return (
          <Card key={fine.id} className="overflow-hidden">
            <header className={`grid gap-3 p-4 sm:p-5 ${paid ? 'bg-[var(--color-success-soft)]' : closed ? 'bg-[var(--color-elevated)]' : 'bg-[var(--color-danger-soft)]'}`}>
              <div className="flex items-start justify-between gap-3"><div><h2 className="font-bold">{fine.description || 'Нарушение ПДД'}</h2>{fine.articleCode ? <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Статья {fine.articleCode}</p> : null}</div><Badge tone={paid ? 'success' : closed ? 'neutral' : 'danger'}>{statusLabels[fine.status]}</Badge></div>
              <div className="flex flex-wrap items-baseline gap-3"><strong className="text-2xl tabular-nums">{money(fine.currentAmountMinor)}</strong>{fine.currentAmountMinor !== fine.originalAmountMinor ? <del className="text-sm text-[var(--color-text-secondary)]">{money(fine.originalAmountMinor)}</del> : null}</div>
            </header>
            <div className="grid gap-4 p-4 sm:p-5">
              <div className="flex items-start gap-3"><FiTruck className="mt-1 shrink-0 text-[var(--color-primary)]" aria-hidden="true" /><div><p className="font-semibold">{fine.vehicle?.label ?? 'Автомобиль не указан'}</p>{fine.vehicle?.registrationNumber ? <p className="mt-1 text-sm font-semibold tabular-nums">{fine.vehicle.registrationNumber}</p> : null}</div></div>
              <div className="grid gap-3 rounded-[var(--radius-lg)] bg-[var(--color-elevated)] p-4 sm:grid-cols-2">
                <div className="sm:col-span-2"><p className="text-xs text-[var(--color-text-secondary)]">Постановление</p><div className="flex items-center gap-1"><strong className="break-all tabular-nums">№ {fine.decreeNumber}</strong><ClientFineCopyButton value={fine.decreeNumber} /></div></div>
                <div><p className="text-xs text-[var(--color-text-secondary)]">Дата постановления</p><p className="mt-1 flex items-center gap-2"><FiCalendar aria-hidden="true" />{day(fine.decreeAt)}</p></div>
                <div><p className="text-xs text-[var(--color-text-secondary)]">Дата нарушения</p><p className="mt-1 flex items-center gap-2"><FiClock aria-hidden="true" />{moment(fine.offenseAt)}</p></div>
                <div className="sm:col-span-2"><p className="text-xs text-[var(--color-text-secondary)]">Место нарушения</p><p className="mt-1 flex items-start gap-2"><FiMapPin className="mt-1 shrink-0" aria-hidden="true" />{fine.address || 'Не указано в постановлении'}</p></div>
              </div>
              <div className="rounded-[var(--radius-lg)] bg-[var(--color-success-soft)] p-4">
                <p className="flex items-center gap-2 font-semibold"><FiCheckCircle className="text-[var(--color-success)]" aria-hidden="true" />Подтверждено менеджером</p>
                {fine.rental ? <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2"><p><span className="text-[var(--color-text-secondary)]">Договор</span><br/><Link className="font-semibold text-[var(--color-primary)]" href={`/rentals/${fine.rental.id}`}>{fine.rental.contractNumber ?? 'Без номера'}</Link></p><p><span className="text-[var(--color-text-secondary)]">Клиент ехал</span><br/><span className="font-semibold">{moment(fine.rental.startsAt)} — {moment(fine.rental.endsAt)}</span></p></div> : <p className="mt-2 text-sm text-[var(--color-text-secondary)]">Договор не указан, привязка подтверждена вручную.</p>}
              </div>
              <Link href={`/fines?clientId=${encodeURIComponent(clientId)}&query=${encodeURIComponent(fine.decreeNumber)}`} className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 text-sm font-semibold text-[var(--color-primary)] hover:bg-[var(--color-primary-soft)]">Открыть штраф</Link>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
