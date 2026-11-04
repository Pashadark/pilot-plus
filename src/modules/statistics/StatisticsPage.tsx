import Image from 'next/image';
import Link from 'next/link';
import type { StatisticsWorkspace } from './server/queries';
import styles from './statistics.module.css';

const weekdays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const dateFormat = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'short',
  timeZone: 'Europe/Moscow',
});
const numberFormat = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 });
const rangeDateFormat = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'Europe/Moscow',
});
function money(minor: bigint) {
  const sign = minor < 0n ? '−' : '';
  const absolute = minor < 0n ? -minor : minor;
  return `${sign}${(absolute / 100n).toLocaleString('ru-RU')}${absolute % 100n ? `,${String(absolute % 100n).padStart(2, '0')}` : ''} ₽`;
}
export function StatisticsPage({ workspace }: { workspace: StatisticsWorkspace }) {
  if (workspace.accessDenied)
    return (
      <main className={styles.page}>
        <h1>Доступ к статистике ограничен</h1>
        <p>
          Финансовая статистика доступна администраторам компании и диспетчерам с доступом к аренде.
        </p>
      </main>
    );
  const { selected, stats, window } = workspace;
  return (
    <main className={styles.page}>
      <header className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>АНАЛИТИКА АВТОПАРКА</p>
          <h1>Статистика автомобиля</h1>
          <p>Реальные поступления, расходы и история аренды.</p>
        </div>
        <form method="get" action="/statistics" className={styles.filters}>
          <label htmlFor="statistics-vehicle">
            Автомобиль
            <select id="statistics-vehicle" name="vehicleId" defaultValue={selected?.id ?? ''}>
              <option value="" disabled>
                Выберите автомобиль
              </option>
              {workspace.vehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.name}, {vehicle.registrationNumber ?? 'без номера'}
                </option>
              ))}
            </select>
          </label>
          <label htmlFor="statistics-period">
            Период
            <select
              id="statistics-period"
              name="period"
              defaultValue={workspace.allTime ? 'all' : String(window.days)}
            >
              <option value="7">7 дней</option>
              <option value="30">30 дней</option>
              <option value="90">90 дней</option>
              <option value="all">Вся история аренды</option>
            </select>
          </label>
          <button type="submit">Показать</button>
        </form>
      </header>
      {workspace.partial ? (
        <p className={styles.notice} role="status">
          Частичная выборка: достигнут лимит истории (2 000 записей на источник) или списка
          автомобилей (500). Итоги не отражают все данные. Сократите период.
        </p>
      ) : null}
      {!selected || !stats ? (
        <section className={styles.panel}>
          <h2>Автомобиль не выбран</h2>
          <p>Выберите доступный автомобиль. Архивные и демонстрационные автомобили не включены.</p>
        </section>
      ) : (
        <>
          <section className={styles.hero} aria-labelledby="statistics-car-name">
            <div className={styles.heroCopy}>
              <p className={styles.eyebrow}>
                {rangeDateFormat.format(window.from)} —{' '}
                {rangeDateFormat.format(new Date(window.to.getTime() - 1))}, Москва
              </p>
              <h2 id="statistics-car-name">{selected.name}</h2>
              <span className={styles.plate}>
                {selected.registrationNumber ?? 'Госномер не указан'}
              </span>
              <p className={styles.incomeLabel}>Доход от аренды</p>
              <p className={styles.income}>{money(stats.incomeMinor)}</p>
              <p>Подтверждённые поступления в RUB. Залоги не включены.</p>
              <Link href={`/vehicles/${selected.id}`}>Карточка автомобиля ↗</Link>
            </div>
            <div className={styles.heroImage}>
              {selected.image ? (
                <Image
                  src={selected.image.localPath}
                  alt={selected.image.alt}
                  width={720}
                  height={420}
                  priority
                />
              ) : (
                <p>Изображение автомобиля пока не добавлено</p>
              )}
            </div>
          </section>
          {stats.excludedPayments ? (
            <p className={styles.notice}>
              Не учтено платежей: {stats.excludedPayments}. Частичные возвраты не имеют суммы
              возврата в источнике; платежи в другой валюте не конвертируются.
            </p>
          ) : null}
          <section className={styles.metrics} aria-label="Показатели автомобиля">
            <article className={styles.panel}>
              <h2>Учтённые расходы</h2>
              <strong>{money(stats.costMinor)}</strong>
              <p>
                Завершённые ТО, ремонт и мойки. Не полный баланс расходов.
                {workspace.unknownCosts ? ` Без суммы: ${workspace.unknownCosts}.` : ''}
              </p>
            </article>
            <article className={styles.panel}>
              <h2>Загрузка в аренде</h2>
              <strong>{numberFormat.format(stats.utilizationPercent)}%</strong>
              <p>
                {numberFormat.format(stats.utilizedDays)} из {window.days} дней. Активные и
                завершённые договоры; пересечения объединены.
              </p>
            </article>
            <article className={styles.panel}>
              <h2>Пробег в аренде</h2>
              <strong>
                {stats.distanceCoveredRentals
                  ? `${numberFormat.format(stats.rentalKm)} км`
                  : 'Нет данных'}
              </strong>
              <p>
                По выдаче и возврату: {stats.distanceCoveredRentals} из {stats.returnedRentals}{' '}
                возвратов за период. Полный пробег этих аренд, не GPS-пробег периода.
              </p>
            </article>
            <article className={styles.panel}>
              <h2>Моточасы</h2>
              <strong>Нет данных</strong>
              <p>Нет истории зажигания. Время поездок не подменяет время работы двигателя.</p>
            </article>
          </section>
          <div className={styles.charts}>
            <section className={styles.panel}>
              <div className={styles.panelHeading}>
                <h2>Доходы и расходы</h2>
                <span className={styles.legend}>
                  <i />
                  Доход <i />
                  Расход
                </span>
              </div>
              <p>
                Разница учтённых поступлений и расходов:{' '}
                {money(stats.incomeMinor - stats.costMinor)}. Это не чистая прибыль.
              </p>
              <div className={styles.financialChart} aria-hidden="true">
                {stats.buckets.map((bucket) => {
                  const max = Math.max(
                    1,
                    ...stats.buckets.flatMap((item) => [
                      Number(item.incomeMinor),
                      Number(item.costMinor),
                    ]),
                  );
                  return (
                    <div className={styles.chartColumn} key={bucket.date.toISOString()}>
                      <div className={styles.bars}>
                        <span style={{ height: `${(Number(bucket.incomeMinor) / max) * 100}%` }} />
                        <span style={{ height: `${(Number(bucket.costMinor) / max) * 100}%` }} />
                      </div>
                      <small>{dateFormat.format(bucket.date)}</small>
                    </div>
                  );
                })}
              </div>
              {!stats.incomeMinor && !stats.costMinor ? (
                <p>За период нет подтверждённых поступлений или учтённых расходов.</p>
              ) : null}
              <details className={styles.details}>
                <summary>Точные значения по периодам</summary>
                <div className={styles.tableWrap}>
                  <table>
                    <caption>Поступления и расходы в рублях; дата — начало интервала</caption>
                    <thead>
                      <tr>
                        <th scope="col">Дата</th>
                        <th scope="col">Доход</th>
                        <th scope="col">Расход</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.buckets.map((bucket) => (
                        <tr key={bucket.date.toISOString()}>
                          <th scope="row">{dateFormat.format(bucket.date)}</th>
                          <td>{money(bucket.incomeMinor)}</td>
                          <td>{money(bucket.costMinor)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </section>
            <section className={styles.panel}>
              <h2>Частота выдачи по дням недели</h2>
              <p>Начало активной или завершённой аренды, по московскому времени.</p>
              <div className={styles.weekdays}>
                {stats.weekdays.map((count, index) => (
                  <div className={styles.weekday} key={weekdays[index]}>
                    <span>{count}</span>
                    <div aria-hidden="true">
                      <i style={{ height: `${(count / Math.max(1, ...stats.weekdays)) * 100}%` }} />
                    </div>
                    <span>{weekdays[index]}</span>
                  </div>
                ))}
              </div>
              <p>Всего выдач за период: {stats.weekdays.reduce((sum, count) => sum + count, 0)}.</p>
            </section>
          </div>
          <section className={styles.panel}>
            <h2>Тепловая карта посещений</h2>
            <p>
              Только подтверждённые телематикой посещения АЗС. Одна запись посещения — один визит,
              не количество GPS-сообщений.
            </p>
            {!stats.locations.length ? (
              <div className={styles.emptyMap}>
                <span aria-hidden="true">◎</span>
                <p>Нет подтверждённых посещений за выбранный период.</p>
                <small>Общая история посещений и стоянок пока не подключена.</small>
              </div>
            ) : (
              <div className={styles.visits}>
                <VisitHeatmap locations={stats.locations} />
                <div>
                  <p>
                    Всего посещений АЗС: {stats.visitCount}. Мест: {stats.locations.length}.
                  </p>
                  <ul>
                    {stats.locations.slice(0, 5).map((location) => (
                      <li key={`${location.latitude},${location.longitude}`}>
                        <span>{location.name}</span>
                        <strong>{location.count}</strong>
                      </li>
                    ))}
                  </ul>
                  <small>
                    Схема координат, не дорожная карта. Более яркое пятно означает больше отдельных
                    визитов.
                  </small>
                </div>
              </div>
            )}
          </section>
          <p className={styles.footnote}>
            Данные PostgreSQL. Поступления — по дате регистрации платежа, расходы — по дате
            завершения работы. При отсутствии даты фактической выдачи загрузка использует начало
            договора. Сегодня включён целиком; показатели текущего дня ещё меняются. Вся история
            начинается с первой доступной аренды или арендного платежа, не с даты создания
            автомобиля; расходы до этой даты не включены.
          </p>
        </>
      )}
    </main>
  );
}
function VisitHeatmap({
  locations,
}: {
  locations: NonNullable<StatisticsWorkspace['stats']>['locations'];
}) {
  const latitudes = locations.map((item) => item.latitude);
  const longitudes = locations.map((item) => item.longitude);
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLon = Math.min(...longitudes);
  const maxLon = Math.max(...longitudes);
  const maximum = Math.max(...locations.map((item) => item.count));
  return (
    <div className={styles.heatmap}>
      <svg
        viewBox="0 0 600 260"
        role="img"
        aria-label={`Тепловая схема ${locations.length} мест посещения АЗС`}
      >
        <defs>
          <radialGradient id="statistics-heat">
            <stop offset="0" stopColor="var(--color-primary)" stopOpacity=".9" />
            <stop offset="1" stopColor="var(--color-primary)" stopOpacity="0" />
          </radialGradient>
        </defs>
        {[60, 120, 180, 240].map((y) => (
          <path key={y} d={`M0 ${y}H600`} stroke="var(--color-border)" />
        ))}
        {locations.map((location) => (
          <circle
            key={`${location.latitude},${location.longitude}`}
            cx={
              maxLon === minLon
                ? 300
                : 40 + ((location.longitude - minLon) / (maxLon - minLon)) * 520
            }
            cy={
              maxLat === minLat
                ? 130
                : 30 + ((maxLat - location.latitude) / (maxLat - minLat)) * 200
            }
            r={18 + (location.count / maximum) * 24}
            fill="url(#statistics-heat)"
          >
            <title>
              {location.name}: {location.count} посещений; {location.latitude}, {location.longitude}
            </title>
          </circle>
        ))}
      </svg>
      <small>
        {minLat.toFixed(4)}–{maxLat.toFixed(4)}° с. ш., {minLon.toFixed(4)}–{maxLon.toFixed(4)}° в.
        д.
      </small>
    </div>
  );
}
