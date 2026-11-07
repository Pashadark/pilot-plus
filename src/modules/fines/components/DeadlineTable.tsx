'use client';
import { Fragment } from 'react';
import Image from 'next/image';
import { FiAlertCircle, FiClock, FiCheckCircle, FiSend } from 'react-icons/fi';
import { getVehiclePromoForFine } from '@/modules/dashboard/vehicle-promo';
import { deadlineGroup } from '../deadline-queue';
import type { FineItem } from './FinesPage';
import { ViolationIconPng } from './ViolationIconPng';
import styles from './deadline-workspace.module.css';

const groups = ['Срочно — сегодня', 'Скидка заканчивается на неделе', 'Без срочности'];
const icons = [FiAlertCircle, FiClock, FiCheckCircle];
const money = (value: string) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(Number(value) / 100) + ' ₽';
const date = (value: string) => new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Moscow', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value));
const time = (value: string) => new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Moscow', hour: '2-digit', minute: '2-digit' }).format(new Date(value));

export function DeadlineTable({ fines, now, onOpen, selectedIds, onToggle, canSelect }: {
  fines: readonly FineItem[]; now: string; onOpen: (fine: FineItem) => void;
  selectedIds: readonly string[]; onToggle: (id: string) => void; canSelect: boolean;
}) {
  return <div className={styles.tableScroll}>
    <table data-testid="fines-table" className={styles.table}>
      <colgroup><col style={{width:'3%'}}/><col style={{width:'17%'}}/><col style={{width:'18%'}}/><col style={{width:'11%'}}/><col style={{width:'13%'}}/><col style={{width:'10%'}}/><col style={{width:'8%'}}/><col style={{width:'10%'}}/><col style={{width:'10%'}}/><col style={{width:'10%'}}/></colgroup>
      <thead><tr>{['', 'Автомобиль', 'Нарушение', 'Дата и время', 'Водитель', 'Договор', 'Сумма', 'Срок скидки', 'Оплата', 'Telegram'].map((label, i) => <th key={i}>{label || <span className="sr-only">Выбрать</span>}</th>)}</tr></thead>
      <tbody>{groups.map((label, group) => {
        const rows = fines.filter(fine => deadlineGroup(fine, now) === group);
        const Icon = icons[group];
        if (!rows.length) return null;
        return <Fragment key={label}>
          <tr className={styles.group} data-tone={group}><th colSpan={10}><Icon aria-hidden />{label}<span>{rows.length}</span></th></tr>
          {rows.map(fine => {
            const promo = getVehiclePromoForFine(fine.vehicleId, fine.vehicleLabel);
            const [model, plate] = fine.vehicleLabel.split(' · ');
            const paid = fine.status === 'PAID';
            const cancelled = fine.status === 'CANCELLED';
            const archived = fine.status === 'ARCHIVED';
            const discount = !paid && !cancelled && !archived && fine.discountExpiresAt && Number(fine.currentAmountMinor) < Number(fine.originalAmountMinor);
            return <tr key={fine.id} tabIndex={0} aria-label={`Открыть: ${fine.vehicleLabel}, ${fine.description ?? fine.roadLabel}`} onClick={() => onOpen(fine)} onKeyDown={event => {if (event.key === 'Enter' || event.key === ' ') {event.preventDefault(); onOpen(fine);}}}>
              <td>{canSelect && !paid && !cancelled && !archived && fine.kind !== 'TOLL' ? <input type="checkbox" aria-label={`Выбрать штраф ${fine.decreeNumber}`} checked={selectedIds.includes(fine.id)} onClick={e => e.stopPropagation()} onChange={() => onToggle(fine.id)}/> : null}</td>
              <td><div className={styles.vehicle}>{promo && <Image src={promo.localPath} alt={promo.alt} width={88} height={56}/>}<div><strong>{model}</strong><small>{plate}</small></div></div></td>
              <td><div className={styles.violation}><ViolationIconPng description={fine.description} kind={fine.kind}/><div><span title={fine.description ?? undefined}>{fine.description || fine.roadLabel || 'Нарушение ПДД'}</span><small title={fine.address ?? undefined}>{fine.address || (fine.kind === 'TOLL' ? 'Платная дорога' : '')}</small></div></div></td>
              <td>{date(fine.offenseAt)}<small>{time(fine.offenseAt)}</small></td>
              <td>{fine.clientLabel || <span className={styles.muted}>Не привязан</span>}</td>
              <td>{fine.rentalLabel || '—'}</td>
              <td><strong className={styles.amount}>{money(fine.currentAmountMinor)}</strong>{discount ? <small><del>{money(fine.originalAmountMinor)}</del></small> : null}</td>
              <td>{discount ? <><span className={styles.deadline} data-tone={!paid && !cancelled ? group : 2}>{date(fine.discountExpiresAt!)}</span><small>до {time(fine.discountExpiresAt!)}</small></> : <small>Без скидки</small>}</td>
              <td><span className={styles.payment} data-paid={paid} data-cancelled={cancelled || archived}>{paid ? 'Оплачен' : cancelled ? 'Отменён' : archived ? 'Архив' : fine.status === 'OVERDUE' ? 'Просрочен' : 'Не оплачен'}</span></td>
              <td><button type="button" className={styles.delivery} onClick={event => {event.stopPropagation(); onOpen(fine);}} aria-label={`Действия: ${fine.kind === 'TOLL' ? fine.roadLabel : fine.description || fine.decreeNumber}`}><FiSend aria-hidden/><span>Нет данных<small>о доставке</small></span></button></td>
            </tr>;
          })}
        </Fragment>;
      })}</tbody>
    </table>
  </div>;
}
