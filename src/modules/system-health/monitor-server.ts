import 'server-only';
import { cpus, totalmem, uptime } from 'node:os';
import { readFile, statfs } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { getSystemHealth } from './get-system-health';
import { getOperationalHealth } from './get-operational-health';
import { resourceUsage, type MonitorCard, type MonitorSnapshot } from './monitor-model';
import { getAvitoProfileControl } from '@/modules/profile/avito-actions';
import { remoteMonitorCards } from './remote-monitor';

const run = promisify(execFile);
const gb = (bytes: number) =>
  `${(bytes / 1024 ** 3).toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ГБ`;

async function serverCard(): Promise<MonitorCard> {
  const checkedAt = new Date().toISOString();
  const metrics: MonitorCard['metrics'] = [];
  const disk = await statfs(process.cwd()).catch(() => null);
  const diskUsage = disk ? resourceUsage(disk.blocks * disk.bsize, disk.bavail * disk.bsize) : null;
  metrics.push({
    label: 'Диск',
    value: diskUsage ? `${gb(diskUsage.used)} / ${gb(diskUsage.total)}` : 'Нет данных',
    percent: diskUsage?.percent,
  });
  metrics.push({
    label: 'Свободно на диске',
    value: diskUsage ? gb(diskUsage.available) : 'Нет данных',
  });
  const mem = await readFile('/proc/meminfo', 'utf8').catch(() => '');
  const available = /MemAvailable:\s+(\d+)/u.exec(mem);
  const ram = available ? resourceUsage(totalmem(), Number(available[1]) * 1024) : null;
  metrics.push({
    label: 'Оперативная память',
    value: ram ? `${gb(ram.used)} / ${gb(ram.total)}` : 'Нет данных',
    percent: ram?.percent,
  });
  const sample = () =>
    cpus().reduce(
      (sum, cpu) => ({
        idle: sum.idle + cpu.times.idle,
        total: sum.total + Object.values(cpu.times).reduce((a, b) => a + b, 0),
      }),
      { idle: 0, total: 0 },
    );
  const start = sample();
  await new Promise((resolve) => setTimeout(resolve, 150));
  const end = sample();
  const cpu =
    end.total > start.total
      ? Math.round(100 * (1 - (end.idle - start.idle) / (end.total - start.total)))
      : null;
  metrics.push({
    label: 'Загрузка CPU',
    value: cpu === null ? 'Нет данных' : `${cpu}%`,
    percent: cpu ?? undefined,
  });
  metrics.push({
    label: 'Время работы сервера',
    value: `${Math.floor(uptime() / 86400)} д. ${Math.floor(uptime() / 3600) % 24} ч.`,
  });
  const warning = (diskUsage?.percent ?? 0) >= 80 || (ram?.percent ?? 0) >= 90;
  return {
    key: 'host',
    label: 'Сервер СУПА ПРО',
    status: warning ? 'degraded' : 'healthy',
    checkedAt,
    message: warning
      ? 'Ресурсы требуют внимания. Диск: порог 80%, память: 90%.'
      : 'Показатели операционной системы получены.',
    metrics,
  };
}

async function avitoCard(): Promise<MonitorCard> {
  const checkedAt = new Date().toISOString();
  const [service, control] = await Promise.all([
    run('systemctl', ['is-active', 'pilot-plus-avito.service'], { timeout: 1500, maxBuffer: 1024 })
      .then(({ stdout }) => stdout.trim() === 'active')
      .catch(() => null),
    getAvitoProfileControl().catch(() => null),
  ]);
  return {
    key: 'avito',
    label: 'Авито',
    status: service === true ? 'healthy' : 'unknown',
    checkedAt,
    message:
      service === true
        ? 'Процесс обработки запущен. Это не проверка ответа API Авито.'
        : 'Не удалось подтвердить работу процесса.',
    metrics: [
      { label: 'Процесс', value: service === true ? 'Запущен' : 'Нет подтверждения' },
      {
        label: 'Автоответы',
        value: control === null ? 'Нет данных' : control.enabled ? 'Включены' : 'Отключены вручную',
      },
    ],
  };
}

export async function getMonitorSnapshot(): Promise<MonitorSnapshot> {
  const [host, avito, services, operations, remote] = await Promise.all([
    serverCard(),
    avitoCard(),
    getSystemHealth(),
    getOperationalHealth(),
    readFile('/var/lib/pilot-plus-monitor/bot.json', 'utf8')
      .then((value) => JSON.parse(value) as unknown)
      .catch(() => null),
  ]);
  const checkedAt = new Date().toISOString();
  return {
    checkedAt,
    cards: [
      host,
      ...remoteMonitorCards(remote),
      ...operations
        .filter((item) => item.key === 'telegram')
        .map((item): MonitorCard => ({
          key: item.key,
          label: 'Очередь Telegram',
          status:
            item.status === 'healthy'
              ? 'unknown'
              : item.status === 'unconfigured'
                ? 'unknown'
                : item.status,
          checkedAt: item.checkedAt,
          message: `${item.message} Состояние процесса показано отдельно. Ошибки очереди могут относиться к прошлым отправкам.`,
          metrics: item.metrics,
        })),
      avito,
      ...operations
        .filter((item) => item.key !== 'telegram')
        .map((item): MonitorCard => ({
          key: item.key,
          label: item.label,
          status: item.status === 'unconfigured' ? 'unknown' : item.status,
          checkedAt: item.checkedAt,
          message: item.message,
          metrics: [
            ...item.metrics,
            {
              label: 'Последний успех',
              value: item.lastSuccessAt
                ? new Date(item.lastSuccessAt).toLocaleString('ru-RU', {
                    timeZone: 'Europe/Moscow',
                  })
                : 'Нет данных',
            },
          ],
        })),
      ...services
        .filter((item) => item.key !== 'api')
        .map((item): MonitorCard => ({
          key: item.key,
          label: item.label,
          status: item.status === 'unconfigured' ? 'unknown' : item.status,
          checkedAt: item.checkedAt,
          message:
            item.key === 'postgresql' ? item.message : `${item.message} Проверка TCP-подключения.`,
          metrics: [
            {
              label: 'Время проверки',
              value: item.status === 'healthy' ? `${item.latencyMs} мс` : 'Нет данных',
            },
          ],
        })),
    ],
  };
}
