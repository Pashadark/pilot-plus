import type { MonitorCard } from './monitor-model';
import { TIMEWEB_LOW_BALANCE_HOURS, type TimewebMonitorSnapshot } from './timeweb-monitor';

const STALE_AFTER_MS = 2 * 60 * 60 * 1000;

function rubles(value: number | null) {
  if (value === null) return 'Нет данных';
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

function duration(hours: number | null) {
  if (hours === null) return 'Нет данных';
  const whole = Math.max(0, Math.floor(hours));
  return `${Math.floor(whole / 24)} дн. ${whole % 24} ч.`;
}

function atMoscow(value: string | null) {
  if (!value) return 'Нет данных';
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Moscow',
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

function serverSummary(snapshot: TimewebMonitorSnapshot) {
  const running = snapshot.servers.filter((server) =>
    ['on', 'active', 'running'].includes(server.status.toLowerCase()),
  ).length;
  const attention = snapshot.servers.length - running;
  if (!snapshot.servers.length) return 'Нет данных';
  return attention ? `${running} работает, ${attention} требует внимания` : `${running} работает`;
}

export function timewebSnapshotToCard(
  snapshot: TimewebMonitorSnapshot | null,
  now = new Date(),
): MonitorCard {
  if (!snapshot) {
    return {
      key: 'timeweb',
      label: 'Timeweb Cloud',
      status: 'unknown',
      checkedAt: now.toISOString(),
      message: 'Данные Timeweb ещё не получены. Проверьте настройку почасового мониторинга.',
      metrics: [],
    };
  }

  const checkedAt = new Date(snapshot.checkedAt);
  const stale = now.getTime() - checkedAt.getTime() > STALE_AFTER_MS;
  const low = snapshot.hoursLeft !== null && snapshot.hoursLeft <= TIMEWEB_LOW_BALANCE_HOURS;
  return {
    key: 'timeweb',
    label: 'Timeweb Cloud',
    status: stale ? 'unknown' : low ? 'degraded' : 'healthy',
    checkedAt: snapshot.checkedAt,
    message: stale
      ? 'Данные старше двух часов. Текущий баланс и срок оплаты не подтверждены.'
      : low
        ? snapshot.alertActive
          ? 'Средств осталось не более чем на семь дней. Telegram-предупреждение поставлено в очередь.'
          : 'Средств осталось не более чем на семь дней. Telegram-предупреждение не поставлено в очередь: проверьте привязку рабочей группы.'
        : 'Баланс и состояние серверов получены через API Timeweb Cloud только для чтения.',
    metrics: [
      { label: 'Баланс', value: rubles(snapshot.balance) },
      { label: 'Средств хватит', value: duration(snapshot.hoursLeft) },
      { label: 'Пополнить примерно до', value: atMoscow(snapshot.depletesAt) },
      { label: 'Расход в час', value: rubles(snapshot.hourlyCost) },
      { label: 'Расход в сутки', value: rubles(snapshot.dailyCost) },
      { label: 'Расход в месяц', value: rubles(snapshot.monthlyCost) },
      { label: 'Автоплатёж', value: snapshot.autopayEnabled ? 'Подключён' : 'Не подключён' },
      { label: 'Скидка', value: snapshot.discountPercent ? `${snapshot.discountPercent}%` : 'Нет' },
      { label: 'Серверы', value: serverSummary(snapshot) },
    ],
  };
}
