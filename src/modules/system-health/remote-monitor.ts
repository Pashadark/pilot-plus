import { resourceUsage, type MonitorCard } from './monitor-model';

export function remoteMonitorCards(input: unknown, now = Date.now()): MonitorCard[] {
  const data = input as Record<string, unknown> | null;
  const checkedAt =
    typeof data?.checkedAt === 'string' ? data.checkedAt : new Date(now).toISOString();
  const age = now - Date.parse(checkedAt);
  const valid =
    data &&
    ['diskTotal', 'diskAvailable', 'ramTotal', 'ramAvailable', 'cpu', 'uptime', 'latencyMs'].every(
      (k) => typeof data[k] === 'number' && Number.isFinite(data[k]) && Number(data[k]) >= 0,
    );
  const disk = valid ? resourceUsage(Number(data.diskTotal), Number(data.diskAvailable)) : null;
  const ram = valid ? resourceUsage(Number(data.ramTotal), Number(data.ramAvailable)) : null;
  if (
    !valid ||
    !disk ||
    !ram ||
    Number(data.cpu) > 100 ||
    !Number.isFinite(age) ||
    age < -10000 ||
    age > 60000
  ) {
    return ['bot-host', 'bot-process'].map((key): MonitorCard => ({
      key,
      label: key === 'bot-host' ? 'Сервер бота' : 'Процесс Telegram-бота',
      checkedAt,
      status: 'unknown',
      message: 'Нет свежего сигнала мониторинга. Связь или сбор показателей недоступны.',
      metrics: [],
    }));
  }
  const gb = (n: number) =>
    `${(n / 1024 ** 3).toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ГБ`;
  const botOk = data.bot === 'healthy';
  const redisOk = data.redis === 'healthy';
  return [
    {
      key: 'bot-host',
      label: 'Сервер бота',
      checkedAt,
      status: disk.percent >= 80 || ram.percent >= 90 ? 'degraded' : 'healthy',
      message:
        'Защищённая проверка сервера 176.124.202.120. Показатели обновляются каждые 15 секунд.',
      metrics: [
        { label: 'Диск', value: `${gb(disk.used)} / ${gb(disk.total)}`, percent: disk.percent },
        { label: 'Свободно на диске', value: gb(disk.available) },
        {
          label: 'Оперативная память',
          value: `${gb(ram.used)} / ${gb(ram.total)}`,
          percent: ram.percent,
        },
        { label: 'Загрузка CPU', value: `${data.cpu}%`, percent: Number(data.cpu) },
        { label: 'Задержка проверки SSH', value: `${data.latencyMs} мс` },
        {
          label: 'Время работы сервера',
          value: `${Math.floor(Number(data.uptime) / 86400)} д. ${Math.floor(Number(data.uptime) / 3600) % 24} ч.`,
        },
      ],
    },
    {
      key: 'bot-process',
      label: 'Процесс Telegram-бота',
      checkedAt,
      status: botOk && redisOk ? 'healthy' : 'unavailable',
      message:
        'Проверка состояния контейнеров Docker. Доставка сообщений показана отдельно в очереди Telegram.',
      metrics: [
        { label: 'Telegram-бот', value: botOk ? 'Запущен · healthy' : 'Не подтверждён / сбой' },
        { label: 'Redis бота', value: redisOk ? 'Запущен · healthy' : 'Не подтверждён / сбой' },
      ],
    },
  ];
}
