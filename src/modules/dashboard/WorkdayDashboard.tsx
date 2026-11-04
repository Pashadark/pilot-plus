import Image from 'next/image';
import Link from 'next/link';
import {
  FiPlus,
  FiCalendar,
  FiTruck,
  FiKey,
  FiTool,
  FiSettings,
  FiDroplet,
  FiChevronRight,
  FiCreditCard,
  FiUsers,
  FiFileText,
} from 'react-icons/fi';
import type { DashboardOverviewDto } from './overview-types';
import type { MoscowWeather } from '@/modules/weather/server/get-moscow-weather';
import { WorkdayEventsSection } from './WorkdayEventsSection';
import { WorkdayMiniMap } from './WorkdayMiniMap';
import { WorkdayBoard } from './WorkdayBoard';
import { TaskComposer } from './TaskComposer';
import { WorkdayTasksButton } from './WorkdayTasksButton';
import { WorkdayDetails } from './WorkdayDetails';
import { dayKey } from './workday-calendar';
import { WorkdayAttention } from './WorkdayAttention';
import { getWeatherScene, weatherIcon } from '@/modules/weather/MoscowWeatherCard';

const money = (minor: string) =>
  new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(Number(minor) / 100);
export function WorkdayDashboard({
  overview,
  weather,
}: {
  overview: DashboardOverviewDto;
  weather: MoscowWeather | null;
}) {
  const fleet = overview.fleet ?? [];
  const manualTasks = overview.workItems.filter((item) => item.kind === 'MANUAL_TASK');
  const selected = dayKey(overview.period.from);
  const today = dayKey(overview.generatedAt ?? overview.period.from);
  const dateTitle = new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Moscow',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    weekday: 'long',
  }).format(new Date(overview.period.from));
  const k = overview.kpis;
  const weatherScene = weather ? getWeatherScene(weather) : null;
  const stats = [
    { label: 'Свободно', value: k.freeVehicles, Icon: FiTruck, href: '/vehicles' },
    { label: 'В аренде', value: k.occupiedVehicles, Icon: FiKey, href: '/rentals' },
    { label: 'ТО', value: k.maintenanceVehicles, Icon: FiTool, href: '/maintenance?view=list' },
    { label: 'Ремонт', value: k.repairVehicles, Icon: FiSettings, href: '/maintenance?view=list' },
    { label: 'Мойка', value: k.washVehicles, Icon: FiDroplet, href: '/wash' },
  ];
  return (
    <div className="workday-dashboard">
      <div className="workday-main">
        <header className="workday-titlebar">
          <div className="workday-title">
            <h1>Рабочий день</h1>
            <p>{dateTitle}</p>
          </div>
          {weather && (
            <div className="workday-weather">
              {weatherScene && (
                <Image
                  src={`/weather/meteocons/${weatherIcon(weatherScene.phase, weatherScene.effect)}.svg`}
                  alt=""
                  aria-hidden="true"
                  width={42}
                  height={42}
                  unoptimized
                />
              )}
              <span>
                Москва {weather.temperatureC > 0 ? '+' : ''}
                {Math.round(weather.temperatureC)}°<small>Ветер {weather.windSpeedMs} м/с</small>
              </span>
            </div>
          )}
          <div className="workday-actions">
            <Link href="/rentals/new" className="workday-new-rental">
              <FiPlus aria-hidden="true" />
              Новая аренда
            </Link>
            <Link href="/rentals?booking=new">
              <FiCalendar aria-hidden="true" />
              Бронирование
            </Link>
            <WorkdayTasksButton>
              <TaskComposer />
              <section aria-label="Список задач" className="grid gap-3">
                <h2 className="text-lg font-semibold">Мои задачи</h2>
                {!manualTasks.length && (
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    Нет задач в выбранном периоде.
                  </p>
                )}
                {manualTasks.map((item) => (
                  <details key={item.id} className="rounded-xl border p-4">
                    <summary className="cursor-pointer text-sm font-semibold">{item.title}</summary>
                    <div className="pt-4">
                      <WorkdayDetails item={item} />
                    </div>
                  </details>
                ))}
              </section>
            </WorkdayTasksButton>
          </div>
        </header>
        <section className="workday-fleet-stats" aria-label="Состояние автопарка">
          {stats.map(({ label, value, Icon, href }) => (
            <Link key={label} href={href}>
              <Icon aria-hidden="true" />
              <span>
                <strong>{value}</strong>
                <small>{label}</small>
              </span>
            </Link>
          ))}
        </section>
        <WorkdayEventsSection
          key={`${selected}:${overview.generatedAt}`}
          initialDay={selected}
          today={today}
          initialItems={overview.workItems.filter((item) =>
            ['HANDOVER', 'DELIVERY', 'RETURN', 'RENTAL_END', 'DEPOSIT_RETURN', 'LOW_FUEL'].includes(
              item.kind,
            ),
          )}
          attentionItems={overview.attentionItems}
          initialDayCount={
            overview.period.key === 'today'
              ? 30
              : Math.max(
                  1,
                  Math.round(
                    (new Date(overview.period.toExclusive).getTime() -
                      new Date(overview.period.from).getTime()) /
                      86400000,
                  ),
                )
          }
          fleet={fleet}
        />
        <section className="workday-base" aria-label="База">
          <h2>
            <FiFileText aria-hidden="true" />
            База
          </h2>
          <Link href="/rentals">
            <FiFileText aria-hidden="true" />
            <span>
              <small>Договоры</small>
              <strong>{k.contracts}</strong>
            </span>
          </Link>
          <Link href="/clients">
            <FiUsers aria-hidden="true" />
            <span>
              <small>Клиенты</small>
              <strong>{k.clients}</strong>
            </span>
          </Link>
        </section>
        <details className="workday-all-tasks">
          <summary>
            Все задачи и уведомления <span>{overview.workItems.length}</span>
          </summary>
          <div className="pt-5">
            <WorkdayBoard
              items={overview.workItems}
              now={overview.generatedAt ?? overview.period.from}
            />
          </div>
        </details>
      </div>
      <aside className="workday-aside" aria-label="Сводка рабочего дня">
        <WorkdayAttention items={overview.attentionItems} />
        <Link href="/rentals?finance=income" className="workday-finance">
          <FiCreditCard aria-hidden="true" />
          <div>
            <h2>Заработано за всё время</h2>
            <strong>{money(k.lifetimeEarnedMinor)}</strong>
            <p>Без депозитов</p>
          </div>
        </Link>
        <Link href="/deposits" className="workday-finance">
          <FiCreditCard aria-hidden="true" />
          <div>
            <h2>Залоги к возврату</h2>
            <strong>{money(k.heldDepositsMinor)}</strong>
            <p>Без возвратов и удержаний</p>
          </div>
        </Link>
        <section className="workday-map-card">
          <div className="flex items-center justify-between gap-2 p-4">
            <h2>Автомобили на карте</h2>
            <Link href="/map" aria-label="Открыть онлайн-карту">
              <FiChevronRight />
            </Link>
          </div>
          <WorkdayMiniMap fleet={fleet} />
          <p className="px-4 py-2 text-xs text-[var(--color-text-secondary)]">
            Последние известные позиции
          </p>
        </section>
      </aside>
    </div>
  );
}
