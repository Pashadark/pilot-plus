'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Image from 'next/image';
import {
  motion,
  AnimatePresence,
  useInView,
  useSpring,
  useTime,
  useTransform,
  useMotionValue,
  Reorder,
} from 'framer-motion';
import {
  FiBell,
  FiMapPin,
  FiMoreHorizontal,
  FiTruck,
  FiCheck,
  FiX,
  FiLoader,
  FiDroplet,
  FiActivity,
  FiUser,
  FiNavigation,
  FiArrowUp,
  FiArrowDown,
  FiAlertTriangle,
  FiInfo,
  FiSun,
  FiCloudRain,
  FiTool,
  FiCalendar,
  FiAlertCircle,
  FiFlag,
  FiStopCircle,
  FiPlay,
  FiCamera,
} from 'react-icons/fi';

import {
  Alert,
  Avatar,
  Badge,
  BottomSheet,
  Breadcrumbs,
  Button,
  Card,
  CardContent,
  CardHeader,
  Checkbox,
  ConfirmationDialog,
  DropdownMenu,
  Drawer,
  EmptyState,
  ErrorState,
  FilterChip,
  IconButton,
  Input,
  ListItem,
  Modal,
  PageHeader,
  Popover,
  Progress,
  Radio,
  StatCard,
  StatusIndicator,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Textarea,
  VehiclePlate,
  Pagination,
  SearchInput,
  SegmentedControl,
  Select,
  Skeleton,
  Spinner,
  Tabs,
  Tooltip,
  type ComponentSize,
} from '@/shared/ui';
import { ConnectionStatus, SpeedIndicator, VehicleMarker } from '@/shared/components/fleet';
import { demoNotifications } from '@/modules/notifications/fixtures';
import { NotificationCenter } from '@/modules/notifications/NotificationCenter';

/* ==========================================================================
   Фото автомобиля
   ========================================================================== */

const DEMO_PHOTO = '/vehicles/vladivostok/fleet-116/primary.webp';

function CarPhoto({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  const dims = { sm: 36, md: 52, lg: 76, xl: 108 };
  const s = dims[size];
  return (
    <Image
      src={DEMO_PHOTO}
      alt="Автомобиль из автопарка Pilot+"
      width={s}
      height={s}
      className="shrink-0 rounded-[var(--radius-md)] object-cover"
      style={{ width: s, height: s }}
    />
  );
}

/* ==========================================================================
   Анимированные компоненты
   ========================================================================== */

function AnimatedCounter({ from, to, duration }: { from: number; to: number; duration: number }) {
  const [count, setCount] = useState(from);
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: false, margin: '-50px' });
  useEffect(() => {
    if (!inView) {
      const resetFrame = requestAnimationFrame(() => setCount(from));
      return () => cancelAnimationFrame(resetFrame);
    }
    const start = performance.now();
    let frame: number;
    const step = (now: number) => {
      const p = Math.min((now - start) / (duration * 1000), 1);
      setCount(Math.round(from + (to - from) * (1 - Math.pow(1 - p, 3))));
      if (p < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [inView, from, to, duration]);
  return (
    <span ref={ref} className="text-3xl font-bold text-[var(--color-primary)] tabular-nums">
      {count.toLocaleString()}
    </span>
  );
}

function AlarmPulse() {
  const [on, setOn] = useState(true);
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <motion.div
          animate={
            on
              ? {
                  boxShadow: ['0 0 0 0 rgba(239,68,68,0.6)', '0 0 0 14px rgba(239,68,68,0)'],
                  scale: [1, 1.08, 1],
                }
              : {}
          }
          transition={on ? { repeat: Infinity, duration: 1.2 } : {}}
          className="size-3.5 rounded-full bg-[var(--color-danger)]"
        />
        <span
          className={`text-sm font-semibold ${on ? 'text-[var(--color-danger)]' : 'text-[var(--color-text-secondary)]'}`}
        >
          {on ? 'ТРЕВОГА!' : 'Отключена'}
        </span>
      </div>
      <Button size="xs" variant="outline" onClick={() => setOn(!on)}>
        {on ? 'Сбросить' : 'Включить'}
      </Button>
    </div>
  );
}

function NotificationBadge() {
  const [count, setCount] = useState(0);
  const [anim, setAnim] = useState(false);
  return (
    <div className="space-y-2">
      <div className="relative inline-flex">
        <FiBell className="size-5" />
        <AnimatePresence>
          {count > 0 && (
            <motion.span
              key={count}
              initial={{ scale: 0 }}
              animate={{ scale: anim ? [1, 1.2, 1] : 1 }}
              exit={{ scale: 0 }}
              className="absolute -top-2 -right-2 flex size-4 items-center justify-center rounded-full bg-[var(--color-danger)] text-[9px] font-bold text-white"
            >
              {count}
            </motion.span>
          )}
        </AnimatePresence>
      </div>
      <div className="flex gap-1.5">
        <Button
          size="xs"
          onClick={() => {
            setCount((c) => c + 1);
            setAnim(true);
            setTimeout(() => setAnim(false), 500);
          }}
        >
          +1
        </Button>
        {count > 0 && (
          <Button size="xs" variant="outline" onClick={() => setCount(0)}>
            Очистить
          </Button>
        )}
      </div>
    </div>
  );
}

function AnimatedList() {
  const [items, setItems] = useState([
    { id: 1, text: 'Въезд в геозону — Haval Jolion', tone: 'info' as const },
    { id: 2, text: 'Превышение скорости — А 123 МР 77', tone: 'danger' as const },
    { id: 3, text: 'ТО через 500 км — Lada Vesta', tone: 'warning' as const },
  ]);
  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <AnimatePresence initial={false}>
          {items.map((item) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="flex items-center gap-2 rounded-[var(--radius-sm)] bg-[var(--color-surface)] px-2.5 py-1.5 text-xs">
                <span
                  className={`size-1.5 rounded-full ${item.tone === 'danger' ? 'bg-[var(--color-danger)]' : item.tone === 'warning' ? 'bg-[var(--color-warning)]' : 'bg-[var(--color-primary)]'}`}
                />
                {item.text}
                <button
                  onClick={() => setItems((prev) => prev.filter((i) => i.id !== item.id))}
                  className="ml-auto"
                >
                  <FiX className="size-3" />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      <Button
        size="xs"
        onClick={() =>
          setItems((prev) => [
            { id: Date.now(), text: `Событие #${prev.length + 1}`, tone: 'info' },
            ...prev,
          ])
        }
      >
        + Событие
      </Button>
    </div>
  );
}

function ShimmerBox() {
  return (
    <motion.div
      animate={{ backgroundPosition: ['200% 0', '-200% 0'] }}
      transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
      className="h-10 rounded-[var(--radius-md)]"
      style={{
        backgroundImage:
          'linear-gradient(90deg, var(--color-border) 0%, var(--color-surface) 50%, var(--color-border) 100%)',
        backgroundSize: '200% 100%',
      }}
    />
  );
}

function PressButton() {
  const [c, setC] = useState(0);
  return (
    <div className="space-y-2 text-center">
      <motion.button
        whileTap={{ scale: 0.93 }}
        whileHover={{ scale: 1.03 }}
        transition={{ type: 'spring', stiffness: 400 }}
        onClick={() => setC(c + 1)}
        className="rounded-[var(--radius-lg)] bg-[var(--color-primary)] px-6 py-2.5 text-sm font-semibold text-white shadow-lg"
      >
        Нажми
      </motion.button>
      <p className="text-xs text-[var(--color-text-secondary)]">
        Нажатий: <strong>{c}</strong>
      </p>
    </div>
  );
}

function StaggerCards() {
  const [v, setV] = useState(false);
  const cards = [
    { t: 'На линии', v: '184', c: 'var(--color-primary)' },
    { t: 'В движении', v: '42', c: 'var(--color-success)' },
    { t: 'Стоянка', v: '128', c: 'var(--color-warning)' },
    { t: 'Офлайн', v: '14', c: 'var(--color-danger)' },
  ];
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <AnimatePresence>
          {v &&
            cards.map((c, i) => (
              <motion.div
                key={c.t}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ delay: i * 0.05 }}
                className="rounded-[var(--radius-md)] border p-3"
              >
                <p className="text-xs text-[var(--color-text-secondary)]">{c.t}</p>
                <p className="text-lg font-bold" style={{ color: c.c }}>
                  {c.v}
                </p>
              </motion.div>
            ))}
        </AnimatePresence>
      </div>
      <Button size="xs" onClick={() => setV(!v)}>
        {v ? 'Скрыть' : 'Показать'}
      </Button>
    </div>
  );
}

function LoadingSequence() {
  const [s, setS] = useState(0);
  const stages = ['Загрузка...', 'Обработка...', 'Маршрут...', 'Готово'];
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs">
        {s < 3 ? (
          <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}>
            <FiLoader className="size-3.5 text-[var(--color-primary)]" />
          </motion.div>
        ) : (
          <FiCheck className="size-3.5 text-[var(--color-success)]" />
        )}
        {stages[s]}
      </div>
      <Progress value={(s / 3) * 100} label="Прогресс синхронизации" />
      <Button
        size="xs"
        onClick={() => {
          setS(0);
          const i = setInterval(
            () =>
              setS((p) => {
                if (p >= 3) {
                  clearInterval(i);
                  return p;
                }
                return p + 1;
              }),
            800,
          );
        }}
      >
        Запустить
      </Button>
    </div>
  );
}

function ToggleAnimation() {
  const [on, setOn] = useState(false);
  return (
    <div className="space-y-1.5">
      <motion.button
        onClick={() => setOn(!on)}
        className={`flex h-6 w-10 rounded-full p-0.5 ${on ? 'bg-[var(--color-success)]' : 'bg-[var(--color-border)]'}`}
        whileTap={{ scale: 0.95 }}
      >
        <motion.div
          layout
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          className={`size-5 rounded-full bg-white shadow ${on ? 'ml-auto' : ''}`}
        />
      </motion.button>
      <p className="text-xs text-[var(--color-text-secondary)]">{on ? 'ВКЛ' : 'ВЫКЛ'}</p>
    </div>
  );
}

/* ==========================================================================
   Продвинутые анимации
   ========================================================================== */

function DragCard() {
  return (
    <div className="relative h-32">
      <motion.div
        drag
        dragConstraints={{ left: 0, right: 120, top: 0, bottom: 40 }}
        whileDrag={{ scale: 1.1, boxShadow: '0 20px 40px rgba(0,0,0,0.25)' }}
        whileHover={{ scale: 1.05 }}
        className="flex size-16 cursor-grab items-center justify-center rounded-xl bg-[var(--color-primary)] text-xs font-bold text-white shadow-md active:cursor-grabbing"
      >
        Тяни
      </motion.div>
    </div>
  );
}

function ReorderDemo() {
  const [items, setItems] = useState([
    'Москва',
    'Санкт-Петербург',
    'Казань',
    'Сочи',
    'Новосибирск',
  ]);
  return (
    <div className="space-y-2">
      <p className="mb-2 text-xs text-[var(--color-text-secondary)]">
        Тяни за строку — меняй порядок
      </p>
      <Reorder.Group axis="y" values={items} onReorder={setItems} className="space-y-1">
        {items.map((item) => (
          <Reorder.Item
            key={item}
            value={item}
            className="cursor-grab rounded-lg border bg-[var(--color-surface)] px-3 py-2 text-sm active:cursor-grabbing active:shadow-md"
          >
            📍 {item}
          </Reorder.Item>
        ))}
      </Reorder.Group>
    </div>
  );
}

function LayoutAccordion() {
  const [open, setOpen] = useState(false);
  const [open2, setOpen2] = useState(false);
  return (
    <div className="space-y-2">
      <motion.div
        layout
        className="cursor-pointer rounded-xl border p-3 select-none"
        onClick={() => setOpen(!open)}
      >
        <motion.div layout className="flex items-center justify-between">
          <span className="text-sm font-semibold">🚗 Haval Jolion — информация</span>
          <motion.span animate={{ rotate: open ? 180 : 0 }}>▼</motion.span>
        </motion.div>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-2 space-y-1 text-xs text-[var(--color-text-secondary)]"
          >
            <p>📍 Ленинградский пр-т, 32</p>
            <p>📏 Пробег: 45 680 км</p>
            <p>⛽ Топливо: 78%</p>
          </motion.div>
        )}
      </motion.div>
      <motion.div
        layout
        className="cursor-pointer rounded-xl border p-3 select-none"
        onClick={() => setOpen2(!open2)}
      >
        <motion.div layout className="flex items-center justify-between">
          <span className="text-sm font-semibold">🔧 Lada Vesta — обслуживание</span>
          <motion.span animate={{ rotate: open2 ? 180 : 0 }}>▼</motion.span>
        </motion.div>
        {open2 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-2 space-y-1 text-xs text-[var(--color-text-secondary)]"
          >
            <p>🛠️ Замена масла: через 1 200 км</p>
            <p>📅 Последнее ТО: 12.07.2026</p>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}

function ScrollCards() {
  return (
    <div className="max-h-52 space-y-2 overflow-y-auto pr-1">
      {vcData.map((v, i) => (
        <motion.div
          key={v.plate}
          initial={{ opacity: 0, x: -30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: false, margin: '-30px' }}
          transition={{ delay: i * 0.08, duration: 0.35 }}
          className="flex items-center gap-2 rounded-lg border p-2 text-xs"
        >
          <CarPhoto size="sm" />
          <div>
            <p className="font-semibold">{v.plate}</p>
            <p className="text-[var(--color-text-secondary)]">{v.model}</p>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

function HoverGallery() {
  return (
    <div className="flex flex-wrap gap-2">
      {vcData.slice(0, 5).map((v) => (
        <motion.div
          key={v.plate}
          whileHover={{ scale: 1.1, y: -4, boxShadow: '0 12px 24px rgba(0,0,0,0.15)' }}
          whileTap={{ scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 400, damping: 15 }}
          className="cursor-pointer overflow-hidden rounded-lg border bg-[var(--color-surface)]"
        >
          <CarPhoto size="sm" />
          <p className="p-1.5 text-center text-[10px] font-medium">{v.plate}</p>
        </motion.div>
      ))}
    </div>
  );
}

function SwipeCard() {
  const x = useMotionValue(0);
  const [status, setStatus] = useState('');
  return (
    <div className="space-y-2">
      <motion.div
        drag="x"
        dragConstraints={{ left: -120, right: 120 }}
        dragElastic={0.15}
        style={{ x }}
        onDragEnd={(_, info) => {
          if (info.offset.x > 60) setStatus('➡️ Принято');
          else if (info.offset.x < -60) setStatus('⬅️ Отклонено');
          else setStatus('');
        }}
        className="flex h-16 w-full cursor-grab items-center justify-center rounded-xl bg-[var(--color-primary-soft)] text-sm font-semibold select-none active:cursor-grabbing"
      >
        ← Свайп →
      </motion.div>
      {status && <p className="text-center text-xs font-medium">{status}</p>}
      <p className="text-center text-[10px] text-[var(--color-text-secondary)]">
        Свайпни влево или вправо
      </p>
    </div>
  );
}

function SpringNumber() {
  const target = useMotionValue(0);
  const spring = useSpring(target, { stiffness: 200, damping: 20 });
  const display = useTransform(spring, (v) => Math.round(v));
  return (
    <div className="space-y-2 text-center">
      <motion.div className="text-4xl font-bold text-[var(--color-primary)]">{display}</motion.div>
      <div className="flex justify-center gap-1.5">
        <Button size="xs" onClick={() => target.set(0)}>
          0
        </Button>
        <Button size="xs" onClick={() => target.set(42)}>
          42
        </Button>
        <Button size="xs" onClick={() => target.set(184)}>
          184
        </Button>
        <Button size="xs" onClick={() => target.set(999)}>
          999
        </Button>
      </div>
    </div>
  );
}

function PerpetualRotation() {
  const time = useTime();
  const rotate = useTransform(time, [0, 3000], [0, 360], { clamp: false });
  return (
    <div className="flex items-center justify-center">
      <motion.div
        style={{ rotate }}
        className="flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-danger)] text-2xl text-white shadow-lg"
      >
        ⚙️
      </motion.div>
    </div>
  );
}

/* ==========================================================================
   Switch и Toggle
   ========================================================================== */

function SwitchRow({
  label,
  defaultChecked,
  disabled,
}: {
  label: string;
  defaultChecked?: boolean;
  disabled?: boolean;
}) {
  const [on, setOn] = useState(defaultChecked || false);
  return (
    <label
      className={`flex items-center gap-3 text-xs ${disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'}`}
    >
      <motion.button
        onClick={() => !disabled && setOn(!on)}
        whileTap={disabled ? {} : { scale: 0.9 }}
        className={`flex h-5 w-9 shrink-0 rounded-full p-0.5 transition-colors ${on ? 'bg-[var(--color-success)]' : 'bg-[var(--color-border)]'}`}
        disabled={disabled}
      >
        <motion.div
          animate={{ x: on ? 14 : 0 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          className="size-4 rounded-full bg-white shadow-sm"
        />
      </motion.button>
      <span
        className={
          on ? 'font-medium text-[var(--color-text)]' : 'text-[var(--color-text-secondary)]'
        }
      >
        {label}
      </span>
    </label>
  );
}

function AnimatedToggle({ label, defaultOn }: { label: string; defaultOn?: boolean }) {
  const [on, setOn] = useState(defaultOn || false);
  return (
    <motion.button
      onClick={() => setOn(!on)}
      whileTap={{ scale: 0.95 }}
      className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-medium transition-all ${on ? 'border-[var(--color-success)] bg-[var(--color-success-soft)] text-[var(--color-success)]' : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)]'}`}
    >
      <motion.div
        animate={{ backgroundColor: on ? 'var(--color-success)' : 'var(--color-border)' }}
        className="flex h-4 w-7 shrink-0 rounded-full p-0.5"
      >
        <motion.div
          animate={{ x: on ? 11 : 0 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          className="size-3 rounded-full bg-white shadow-sm"
        />
      </motion.div>
      {label}
    </motion.button>
  );
}

/* ==========================================================================
   Событие
   ========================================================================== */

function EventCard({
  title,
  vehicleName,
  timeLabel,
  tone = 'info',
}: {
  title: string;
  vehicleName: string;
  timeLabel: string;
  tone?: 'info' | 'success' | 'warning' | 'danger';
}) {
  const colors: Record<string, string> = {
    info: 'bg-[var(--color-primary)]',
    success: 'bg-[var(--color-success)]',
    warning: 'bg-[var(--color-warning)]',
    danger: 'bg-[var(--color-danger)]',
  };
  const icons: Record<string, ReactNode> = {
    info: <FiInfo className="size-3" />,
    success: <FiCheck className="size-3" />,
    warning: <FiAlertTriangle className="size-3" />,
    danger: <FiAlertCircle className="size-3" />,
  };
  return (
    <div className="flex items-center gap-2 rounded-[var(--radius-md)] border px-2.5 py-2">
      <span
        className={`flex size-6 shrink-0 items-center justify-center rounded-full text-white ${colors[tone]}`}
      >
        {icons[tone]}
      </span>
      <div className="min-w-0">
        <p className="truncate text-xs font-medium">{title}</p>
        <p className="text-[10px] text-[var(--color-text-secondary)]">
          {vehicleName} · {timeLabel}
        </p>
      </div>
    </div>
  );
}

/* ==========================================================================
   Календарь моек
   ========================================================================== */

function WashCalendar() {
  const [currentMonth, setCurrentMonth] = useState(new Date(2026, 6, 1));
  const monthNames = [
    'Январь',
    'Февраль',
    'Март',
    'Апрель',
    'Май',
    'Июнь',
    'Июль',
    'Август',
    'Сентябрь',
    'Октябрь',
    'Ноябрь',
    'Декабрь',
  ];
  const dayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  const dots: Record<string, { color: string; count: number }> = {
    '2026-07-17': { color: 'bg-green-500', count: 3 },
    '2026-07-16': { color: 'bg-green-500', count: 2 },
    '2026-07-18': { color: 'bg-blue-500', count: 1 },
    '2026-07-15': { color: 'bg-green-500', count: 1 },
    '2026-07-14': { color: 'bg-red-400', count: 1 },
  };
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDay = (firstDay.getDay() + 6) % 7;
  const days: (number | null)[] = [];
  for (let i = 0; i < startDay; i++) days.push(null);
  for (let d = 1; d <= lastDay.getDate(); d++) days.push(d);
  const today = new Date();
  const isCurrentMonth = today.getMonth() === month && today.getFullYear() === year;
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <button
          className="rounded p-1 text-xs hover:bg-[var(--color-border)]"
          onClick={() => setCurrentMonth(new Date(year, month - 1, 1))}
        >
          ←
        </button>
        <h4 className="text-sm font-semibold">
          {monthNames[month]} {year}
        </h4>
        <button
          className="rounded p-1 text-xs hover:bg-[var(--color-border)]"
          onClick={() => setCurrentMonth(new Date(year, month + 1, 1))}
        >
          →
        </button>
      </div>
      <div className="mb-1 grid grid-cols-7">
        {dayNames.map((d) => (
          <div key={d} className="py-1 text-center text-[10px] text-[var(--color-text-secondary)]">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {days.map((day, i) => {
          if (day === null) return <div key={`empty-${i}`} />;
          const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const dot = dots[dateKey];
          const isToday = isCurrentMonth && day === today.getDate();
          return (
            <button
              key={dateKey}
              className={`relative min-h-[44px] rounded-md p-1.5 text-xs transition-colors ${isToday ? 'bg-[var(--color-primary-soft)] ring-1 ring-[var(--color-primary)]' : 'hover:bg-[var(--color-border)]'}`}
            >
              <span className={isToday ? 'font-bold text-[var(--color-primary)]' : ''}>{day}</span>
              {dot && (
                <div className="mt-1 flex justify-center gap-0.5">
                  {Array.from({ length: Math.min(dot.count, 3) }).map((_, j) => (
                    <span key={j} className={`size-1.5 rounded-full ${dot.color}`} />
                  ))}
                </div>
              )}
              {dot && dot.count > 3 && (
                <span className="absolute right-1 bottom-1 text-[9px] text-[var(--color-text-secondary)]">
                  +{dot.count - 3}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-[10px] text-[var(--color-text-secondary)]">
        <span className="flex items-center gap-1">
          <span className="size-1.5 rounded-full bg-green-500" /> Выполнена
        </span>
        <span className="flex items-center gap-1">
          <span className="size-1.5 rounded-full bg-blue-500" /> Запланирована
        </span>
        <span className="flex items-center gap-1">
          <span className="size-1.5 rounded-full bg-red-400" /> Просрочена
        </span>
      </div>
    </div>
  );
}

/* ==========================================================================
   Календарь ТО
   ========================================================================== */

function MaintenanceCalendar() {
  const [currentMonth, setCurrentMonth] = useState(new Date(2026, 6, 1));
  const monthNames = [
    'Январь',
    'Февраль',
    'Март',
    'Апрель',
    'Май',
    'Июнь',
    'Июль',
    'Август',
    'Сентябрь',
    'Октябрь',
    'Ноябрь',
    'Декабрь',
  ];
  const dayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  const dots: Record<string, { color: string; count: number }> = {
    '2026-07-17': { color: 'bg-green-500', count: 1 },
    '2026-07-15': { color: 'bg-green-500', count: 1 },
    '2026-07-20': { color: 'bg-blue-500', count: 1 },
    '2026-07-22': { color: 'bg-blue-500', count: 1 },
    '2026-07-10': { color: 'bg-red-500', count: 1 },
  };
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDay = (firstDay.getDay() + 6) % 7;
  const days: (number | null)[] = [];
  for (let i = 0; i < startDay; i++) days.push(null);
  for (let d = 1; d <= lastDay.getDate(); d++) days.push(d);
  const today = new Date();
  const isCurrentMonth = today.getMonth() === month && today.getFullYear() === year;
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <button
          className="rounded p-1 text-xs hover:bg-[var(--color-border)]"
          onClick={() => setCurrentMonth(new Date(year, month - 1, 1))}
        >
          ←
        </button>
        <h4 className="text-sm font-semibold">
          {monthNames[month]} {year}
        </h4>
        <button
          className="rounded p-1 text-xs hover:bg-[var(--color-border)]"
          onClick={() => setCurrentMonth(new Date(year, month + 1, 1))}
        >
          →
        </button>
      </div>
      <div className="mb-1 grid grid-cols-7">
        {dayNames.map((d) => (
          <div key={d} className="py-1 text-center text-[10px] text-[var(--color-text-secondary)]">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {days.map((day, i) => {
          if (day === null) return <div key={`empty-${i}`} />;
          const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const dot = dots[dateKey];
          const isToday = isCurrentMonth && day === today.getDate();
          return (
            <button
              key={dateKey}
              className={`relative min-h-[44px] rounded-md p-1.5 text-xs transition-colors ${isToday ? 'bg-[var(--color-primary-soft)] ring-1 ring-[var(--color-primary)]' : 'hover:bg-[var(--color-border)]'}`}
            >
              <span className={isToday ? 'font-bold text-[var(--color-primary)]' : ''}>{day}</span>
              {dot && (
                <div className="mt-1 flex justify-center gap-0.5">
                  {Array.from({ length: Math.min(dot.count, 3) }).map((_, j) => (
                    <span key={j} className={`size-1.5 rounded-full ${dot.color}`} />
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-[10px] text-[var(--color-text-secondary)]">
        <span className="flex items-center gap-1">
          <span className="size-1.5 rounded-full bg-green-500" /> Выполнено
        </span>
        <span className="flex items-center gap-1">
          <span className="size-1.5 rounded-full bg-blue-500" /> Запланировано
        </span>
        <span className="flex items-center gap-1">
          <span className="size-1.5 rounded-full bg-red-500" /> Просрочено
        </span>
      </div>
    </div>
  );
}

/* ==========================================================================
   Вспомогательные компоненты
   ========================================================================== */

function KitSection({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 border-t border-[var(--color-border)] py-7">
      <h2 className="text-lg font-bold">{title}</h2>
      <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">{description}</p>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">{children}</div>
    </section>
  );
}

function KitSectionFull({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 border-t border-[var(--color-border)] py-7">
      <h2 className="text-lg font-bold">{title}</h2>
      <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">{description}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function ExampleCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="p-3.5">
      <CardHeader className="p-0 pb-2.5">
        <h3 className="text-sm font-semibold">{title}</h3>
      </CardHeader>
      <CardContent className="p-0 pt-3.5">{children}</CardContent>
    </Card>
  );
}

function Guidance({ use, avoid }: { use: string; avoid: string }) {
  return (
    <div className="space-y-0.5 text-xs text-[var(--color-text-secondary)]">
      <p>
        <strong className="text-[var(--color-text)]">Когда:</strong> {use}
      </p>
      <p>
        <strong className="text-[var(--color-text)]">Не когда:</strong> {avoid}
      </p>
    </div>
  );
}

/* ==========================================================================
   Данные
   ========================================================================== */

const sizes: readonly ComponentSize[] = ['xs', 'sm', 'md', 'lg'];

const vcData = [
  {
    plate: 'А 123 МР 77',
    model: 'Haval Jolion',
    status: 'online',
    speed: 62,
    fuel: 78,
    driver: 'Иван Петров',
    location: 'Ленинградский пр-т, 32',
    lastSeen: 'сейчас',
    mileage: 45680,
    nextService: 3200,
    rentStatus: 'В аренде',
    rentClient: 'ООО "ТрансЛогистик"',
    rentEnd: 'до 21.07.2026',
    isClean: true,
    events: [{ title: 'Превышение скорости (105 км/ч)', time: '10:45', tone: 'danger' as const }],
  },
  {
    plate: 'В 456 КХ 178',
    model: 'Lada Vesta Cross',
    status: 'moving',
    speed: 94,
    fuel: 45,
    driver: 'Сергей Кузнецов',
    location: 'МКАД, 41-й км',
    lastSeen: '1 мин',
    mileage: 12890,
    nextService: 15000,
    rentStatus: 'Свободна',
    rentClient: '—',
    rentEnd: '—',
    isClean: false,
    events: [],
  },
  {
    plate: 'Е 789 НО 77',
    model: 'Toyota Camry',
    status: 'parked',
    speed: 0,
    fuel: 92,
    driver: '—',
    location: 'ул. Тверская, 15',
    lastSeen: '5 мин',
    mileage: 89200,
    nextService: 800,
    rentStatus: 'Свободна',
    rentClient: '—',
    rentEnd: '—',
    isClean: true,
    events: [{ title: 'Плановое ТО через 800 км', time: '09:30', tone: 'warning' as const }],
  },
  {
    plate: 'К 111 МР 199',
    model: 'Kia Rio X-Line',
    status: 'offline',
    speed: 0,
    fuel: 12,
    driver: '—',
    location: 'Неизвестно',
    lastSeen: '2 часа',
    mileage: 67450,
    nextService: 0,
    rentStatus: 'В аренде',
    rentClient: 'ИП Сидоров',
    rentEnd: 'до 22.07.2026',
    isClean: false,
    events: [],
  },
  {
    plate: 'М 333 АХ 750',
    model: 'ГАЗель Next',
    status: 'alarm',
    speed: 0,
    fuel: 34,
    driver: 'Алексей Смирнов',
    location: 'Дмитровское ш., 64',
    lastSeen: '10 сек',
    mileage: 234100,
    nextService: 1200,
    rentStatus: 'Свободна',
    rentClient: '—',
    rentEnd: '—',
    isClean: true,
    events: [{ title: 'Датчик удара сработал', time: '11:02', tone: 'danger' as const }],
  },
];

const statusMap: Record<
  string,
  { tone: 'success' | 'primary' | 'warning' | 'neutral' | 'danger'; label: string }
> = {
  online: { tone: 'success', label: 'На связи' },
  moving: { tone: 'primary', label: 'В движении' },
  parked: { tone: 'warning', label: 'Стоянка' },
  offline: { tone: 'neutral', label: 'Офлайн' },
  alarm: { tone: 'danger', label: 'Тревога' },
};

const washRecords = [
  {
    id: '1',
    date: '17.07',
    time: '14:30',
    plate: 'А 123 МР 77',
    model: 'Haval Jolion',
    washTypeLabel: ['Комплекс'],
    performer: 'Иванов И.',
    cost: '2 500 ₽',
    status: 'completed' as const,
    statusTone: 'success' as const,
    statusLabel: '✅ Выполнена',
    photoCount: 2,
  },
  {
    id: '2',
    date: '17.07',
    time: '11:15',
    plate: 'В 456 КХ 178',
    model: 'Lada Vesta Cross',
    washTypeLabel: ['Кузов', 'Коврики'],
    performer: 'Петров С.',
    cost: '1 200 ₽',
    status: 'completed' as const,
    statusTone: 'success' as const,
    statusLabel: '✅ Выполнена',
    photoCount: 2,
  },
  {
    id: '3',
    date: '17.07',
    time: '09:00',
    plate: 'Е 789 НО 77',
    model: 'Toyota Camry',
    washTypeLabel: ['Багажник'],
    performer: 'Сидоров А.',
    cost: '800 ₽',
    status: 'completed' as const,
    statusTone: 'success' as const,
    statusLabel: '✅ Выполнена',
    photoCount: 1,
  },
  {
    id: '4',
    date: '18.07',
    time: '08:00',
    plate: 'М 333 АХ 750',
    model: 'ГАЗель Next',
    washTypeLabel: ['Кузов'],
    performer: '—',
    cost: '—',
    status: 'planned' as const,
    statusTone: 'primary' as const,
    statusLabel: '📅 Запланирована',
    photoCount: 0,
  },
  {
    id: '5',
    date: '16.07',
    time: '16:45',
    plate: 'К 111 МР 199',
    model: 'Kia Rio X-Line',
    washTypeLabel: ['Комплекс'],
    performer: 'Иванов И.',
    cost: '2 500 ₽',
    status: 'completed' as const,
    statusTone: 'success' as const,
    statusLabel: '✅ Выполнена',
    photoCount: 2,
  },
];

const maintenanceRecords = [
  {
    id: '1',
    date: '17.07',
    plate: 'А 123 МР 77',
    model: 'Haval Jolion',
    typeLabel: ['Замена масла'],
    mileage: 45680,
    serviceName: 'АвтоСпец',
    cost: '12 500 ₽',
    status: 'completed' as const,
    statusTone: 'success' as const,
    statusLabel: '✅ Выполнено',
    photoCount: 1,
  },
  {
    id: '2',
    date: '15.07',
    plate: 'В 456 КХ 178',
    model: 'Lada Vesta Cross',
    typeLabel: ['Замена колодок'],
    mileage: 12450,
    serviceName: 'Сервис №5',
    cost: '8 200 ₽',
    status: 'completed' as const,
    statusTone: 'success' as const,
    statusLabel: '✅ Выполнено',
    photoCount: 1,
  },
  {
    id: '3',
    date: '20.07',
    plate: 'Е 789 НО 77',
    model: 'Toyota Camry',
    typeLabel: ['Регламентное ТО'],
    mileage: 89200,
    serviceName: 'Дилер Toyota',
    cost: '25 000 ₽',
    status: 'planned' as const,
    statusTone: 'primary' as const,
    statusLabel: '📅 Запланировано',
    photoCount: 0,
  },
  {
    id: '4',
    date: '22.07',
    plate: 'К 111 МР 199',
    model: 'Kia Rio X-Line',
    typeLabel: ['ГРМ + помпа'],
    mileage: 67450,
    serviceName: 'ИП Сидоров',
    cost: '18 000 ₽',
    status: 'planned' as const,
    statusTone: 'primary' as const,
    statusLabel: '📅 Запланировано',
    photoCount: 0,
  },
  {
    id: '5',
    date: '10.07',
    plate: 'М 333 АХ 750',
    model: 'ГАЗель Next',
    typeLabel: ['Замена свечей'],
    mileage: 234100,
    serviceName: 'Грузосервис',
    cost: '6 500 ₽',
    status: 'overdue' as const,
    statusTone: 'danger' as const,
    statusLabel: '⚠️ Просрочено',
    photoCount: 1,
  },
];

const maintenanceProgress = [
  {
    icon: '🛢️',
    label: 'Замена масла',
    car: 'Haval Jolion',
    currentKm: 45680,
    nextKm: 50000,
    percent: 86,
    remaining: 4320,
    color: 'bg-[var(--color-success)]',
  },
  {
    icon: '🔍',
    label: 'Замена фильтров',
    car: 'Toyota Camry',
    currentKm: 89200,
    nextKm: 90000,
    percent: 88,
    remaining: 800,
    color: 'bg-[var(--color-warning)]',
  },
  {
    icon: '⚙️',
    label: 'ГРМ + помпа',
    car: 'Kia Rio X-Line',
    currentKm: 67450,
    nextKm: 66000,
    percent: 102,
    remaining: -1450,
    color: 'bg-[var(--color-danger)]',
  },
  {
    icon: '🛞',
    label: 'Замена колодок',
    car: 'Lada Vesta Cross',
    currentKm: 12450,
    nextKm: 30000,
    percent: 41,
    remaining: 17550,
    color: 'bg-[var(--color-success)]',
  },
  {
    icon: '📋',
    label: 'Регламентное ТО',
    car: 'ГАЗель Next',
    currentKm: 234100,
    nextKm: 240000,
    percent: 74,
    remaining: 5900,
    color: 'bg-[var(--color-success)]',
  },
  {
    icon: '🔥',
    label: 'Замена свечей',
    car: 'Haval Jolion',
    currentKm: 45680,
    nextKm: 60000,
    percent: 55,
    remaining: 14320,
    color: 'bg-[var(--color-success)]',
  },
];

const orders = [
  {
    id: '1423',
    clientName: 'ООО "ТрансЛогистик"',
    clientPhone: '+7 (999) 111-22-33',
    plate: 'А 123 МР 77',
    model: 'Haval Jolion',
    from: 'ул. Ленина, 15',
    to: 'Шереметьево, Терм. D',
    date: '20.07',
    time: '09:00',
    responsible: 'Иванов И.',
    status: 'planned' as const,
    statusTone: 'primary' as const,
    statusLabel: '📅 Назначен',
  },
  {
    id: '1422',
    clientName: 'ИП Сидоров',
    clientPhone: '+7 (999) 222-33-44',
    plate: 'В 456 КХ 178',
    model: 'Lada Vesta Cross',
    from: 'МКАД, 41-й км',
    to: 'Домодедово',
    date: '19.07',
    time: '14:00',
    responsible: 'Петров С.',
    status: 'completed' as const,
    statusTone: 'success' as const,
    statusLabel: '✅ Выполнен',
  },
  {
    id: '1421',
    clientName: 'Анна Петрова',
    clientPhone: '+7 (999) 333-44-55',
    plate: 'Е 789 НО 77',
    model: 'Toyota Camry',
    from: 'ул. Тверская, 15',
    to: 'Внуково',
    date: '18.07',
    time: '11:00',
    responsible: 'Иванов И.',
    status: 'completed' as const,
    statusTone: 'success' as const,
    statusLabel: '✅ Выполнен',
  },
  {
    id: '1420',
    clientName: 'ООО "ГрузЛайн"',
    clientPhone: '+7 (999) 444-55-66',
    plate: 'М 333 АХ 750',
    model: 'ГАЗель Next',
    from: 'Дмитровское ш., 64',
    to: 'Склад №12',
    date: '21.07',
    time: '08:00',
    responsible: 'Сидоров А.',
    status: 'planned' as const,
    statusTone: 'primary' as const,
    statusLabel: '📅 Назначен',
  },
  {
    id: '1419',
    clientName: 'Сергей Волков',
    clientPhone: '+7 (999) 555-66-77',
    plate: 'К 111 МР 199',
    model: 'Kia Rio X-Line',
    from: 'Неизвестно',
    to: 'Сервис Kia',
    date: '17.07',
    time: '10:00',
    responsible: '—',
    status: 'cancelled' as const,
    statusTone: 'neutral' as const,
    statusLabel: '❌ Отменён',
  },
];

const roles = [
  {
    name: 'Администратор',
    icon: '👑',
    level: 'Полный доступ',
    tone: 'primary' as const,
    borderColor: 'border-[var(--color-primary)]',
    desc: 'Управляет всей системой: пользователи, машины, заказы, финансы, настройки.',
    permissions: [
      { label: 'Просмотр всех заказов', allowed: true },
      { label: 'Создание и удаление заказов', allowed: true },
      { label: 'Назначение ответственных', allowed: true },
      { label: 'Управление пользователями', allowed: true },
      { label: 'Редактирование тарифов', allowed: true },
      { label: 'Просмотр финансов', allowed: true },
      { label: 'Экспорт отчётов', allowed: true },
      { label: 'Системные настройки', allowed: true },
    ],
  },
  {
    name: 'Оператор',
    icon: '🧑‍💼',
    level: 'Управление заказами',
    tone: 'warning' as const,
    borderColor: 'border-[var(--color-warning)]',
    desc: 'Работает с заказами: создаёт, назначает, редактирует. Не трогает системные настройки.',
    permissions: [
      { label: 'Просмотр всех заказов', allowed: true },
      { label: 'Создание и удаление заказов', allowed: true },
      { label: 'Назначение ответственных', allowed: true },
      { label: 'Управление пользователями', allowed: false },
      { label: 'Редактирование тарифов', allowed: false },
      { label: 'Просмотр финансов', allowed: true },
      { label: 'Экспорт отчётов', allowed: false },
      { label: 'Системные настройки', allowed: false },
    ],
  },
  {
    name: 'Водитель',
    icon: '🚗',
    level: 'Просмотр заявок',
    tone: 'success' as const,
    borderColor: 'border-[var(--color-success)]',
    desc: 'Видит свои заявки, машину, может отмечать выполнение. Минимум прав.',
    permissions: [
      { label: 'Просмотр всех заказов', allowed: false },
      { label: 'Создание и удаление заказов', allowed: false },
      { label: 'Назначение ответственных', allowed: false },
      { label: 'Управление пользователями', allowed: false },
      { label: 'Редактирование тарифов', allowed: false },
      { label: 'Просмотр финансов', allowed: false },
      { label: 'Экспорт отчётов', allowed: false },
      { label: 'Системные настройки', allowed: false },
    ],
  },
];

const users = [
  {
    name: 'Павел Седов',
    email: 'sedoffwork@mail.ru',
    phone: '+7 (999) 123-45-67',
    role: 'Администратор',
    roleTone: 'primary' as const,
    lastLogin: 'Сегодня, 09:15',
    active: true,
  },
  {
    name: 'Иван Петров',
    email: 'ivan@mail.ru',
    phone: '+7 (999) 555-44-33',
    role: 'Оператор',
    roleTone: 'warning' as const,
    lastLogin: 'Вчера, 18:30',
    active: true,
  },
  {
    name: 'Сергей Кузнецов',
    email: 'sergey@mail.ru',
    phone: '+7 (999) 777-88-99',
    role: 'Водитель',
    roleTone: 'success' as const,
    lastLogin: 'Сегодня, 07:00',
    active: true,
  },
  {
    name: 'Алексей Смирнов',
    email: 'alex@mail.ru',
    phone: '+7 (999) 888-99-00',
    role: 'Водитель',
    roleTone: 'success' as const,
    lastLogin: '15.07.2026',
    active: false,
  },
];

/* ==========================================================================
   ГЛАВНЫЙ КОМПОНЕНТ
   ========================================================================== */

export function UiKitSections() {
  const [seg, setSeg] = useState<'all' | 'online'>('all');
  const [tab, setTab] = useState<'overview' | 'events' | 'service'>('overview');
  const [page, setPage] = useState(1);
  const [filt, setFilt] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalRevision, setModalRevision] = useState(0);
  const [firstDialogOpen, setFirstDialogOpen] = useState(false);
  const [secondDialogOpen, setSecondDialogOpen] = useState(false);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetSnap, setSheetSnap] = useState<'collapsed' | 'intermediate' | 'expanded'>(
    'intermediate',
  );

  return (
    <div className="space-y-0">
      {/* ================================================================ */}
      {/* 1. ОСНОВЫ */}
      {/* ================================================================ */}
      <KitSection
        id="foundations"
        title="Основы"
        description="Семантические токены задают цвет, поверхность, радиус и визуальную иерархию обеих тем."
      >
        <ExampleCard title="Токены интерфейса">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ['Основной', 'bg-[var(--color-primary)]'],
              ['Поверхность', 'bg-[var(--color-surface)]'],
              ['Успех', 'bg-[var(--color-success)]'],
              ['Опасность', 'bg-[var(--color-danger)]'],
            ].map(([l, c]) => (
              <div key={l} className="grid gap-2 text-sm">
                <span className={`h-11 rounded-[var(--radius-md)] border ${c}`} />
                <span className="text-center">{l}</span>
              </div>
            ))}
          </div>
        </ExampleCard>
        <ExampleCard title="Правила">
          <Guidance
            use="для общих визуальных решений и темизации."
            avoid="сырые значения цвета и локальные визуальные исключения."
          />
        </ExampleCard>
      </KitSection>

      <KitSectionFull
        id="product-contracts"
        title="Контракты продуктового интерфейса"
        description="Production-компоненты задают общую геометрию страниц, представление пользователя и доступ к уведомлениям."
      >
        <div className="grid gap-3 lg:grid-cols-2">
          <Card className="p-4 lg:col-span-2">
            <PageHeader
              eyebrow="Пример раздела"
              title="Заголовок страницы"
              description="Единая композиция заголовка, пояснения и действий для продуктовых маршрутов."
              actions={<Button>Основное действие</Button>}
            />
          </Card>
          <ExampleCard title="Аватары и профиль">
            <div className="flex flex-wrap items-center gap-3">
              <Avatar name="Павел Седов" size="xs" />
              <Avatar name="Павел Седов" size="sm" />
              <Avatar name="Павел Седов" size="md" />
              <Avatar name="Павел Седов" size="lg" />
            </div>
          </ExampleCard>
          <ExampleCard title="Центр уведомлений">
            <div className="flex min-h-14 items-center gap-3">
              <NotificationCenter notifications={demoNotifications} />
              <p className="text-sm text-[var(--color-text-secondary)]">
                Демонстрационные события и локальное состояние прочтения.
              </p>
            </div>
          </ExampleCard>
        </div>
      </KitSectionFull>

      {/* ================================================================ */}
      {/* 2. ПРОДВИНУТЫЕ АНИМАЦИИ */}
      {/* ================================================================ */}
      <KitSectionFull
        id="advanced-animations"
        title="Продвинутые анимации"
        description="Drag, Reorder, Layout, Scroll, Hover, Pan, Spring, Perpetual — всё на Motion."
      >
        <div className="space-y-8">
          <div>
            <h3 className="mb-2 text-sm font-semibold">Drag (перетаскивание) и Swipe (свайп)</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-xl border p-4">
                <p className="mb-3 text-xs text-[var(--color-text-secondary)]">
                  Свободное перетаскивание в пределах контейнера
                </p>
                <DragCard />
              </div>
              <div className="rounded-xl border p-4">
                <p className="mb-3 text-xs text-[var(--color-text-secondary)]">
                  Свайп с определением направления
                </p>
                <SwipeCard />
              </div>
            </div>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold">Reorder (drag-to-reorder)</h3>
            <div className="max-w-md rounded-xl border p-4">
              <ReorderDemo />
            </div>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold">Layout Animations (аккордеон)</h3>
            <div className="max-w-md rounded-xl border p-4">
              <LayoutAccordion />
            </div>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold">Scroll-triggered (whileInView)</h3>
            <div className="max-w-md rounded-xl border p-4">
              <p className="mb-3 text-xs text-[var(--color-text-secondary)]">
                Прокрути — карточки появляются с анимацией
              </p>
              <ScrollCards />
            </div>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold">Hover Gallery (whileHover + scale)</h3>
            <div className="rounded-xl border p-4">
              <p className="mb-3 text-xs text-[var(--color-text-secondary)]">
                Наведи — карточка увеличивается
              </p>
              <HoverGallery />
            </div>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold">Spring Number (useSpring)</h3>
            <div className="max-w-md rounded-xl border p-4">
              <p className="mb-3 text-xs text-[var(--color-text-secondary)]">
                Пружинная анимация числа
              </p>
              <SpringNumber />
            </div>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold">Perpetual Rotation (useTime)</h3>
            <div className="max-w-md rounded-xl border p-4">
              <p className="mb-3 text-xs text-[var(--color-text-secondary)]">
                Бесконечное вращение через useTime + useTransform
              </p>
              <PerpetualRotation />
            </div>
          </div>
        </div>
      </KitSectionFull>

      {/* ================================================================ */}
      {/* 3. БАЗОВЫЕ АНИМАЦИИ */}
      {/* ================================================================ */}
      <KitSection
        id="animations"
        title="Анимации (базовые)"
        description="Framer Motion. Нажимай — смотри."
      >
        <ExampleCard title="Пульсация тревоги">
          <AlarmPulse />
        </ExampleCard>
        <ExampleCard title="Счётчик (Animated Counter)">
          <AnimatedCounter from={0} to={184} duration={2} />
        </ExampleCard>
        <ExampleCard title="Значок уведомлений">
          <NotificationBadge />
        </ExampleCard>
        <ExampleCard title="Анимированный список">
          <AnimatedList />
        </ExampleCard>
        <ExampleCard title="Stagger Cards">
          <StaggerCards />
        </ExampleCard>
        <ExampleCard title="Кнопка с отдачей">
          <PressButton />
        </ExampleCard>
        <ExampleCard title="Toggle">
          <ToggleAnimation />
        </ExampleCard>
        <ExampleCard title="Последовательность загрузки">
          <LoadingSequence />
        </ExampleCard>
        <ExampleCard title="Shimmer">
          <ShimmerBox />
        </ExampleCard>
      </KitSection>

      {/* ================================================================ */}
      {/* 4. СКЕЛЕТОНЫ С АНИМАЦИЕЙ */}
      {/* ================================================================ */}
      <KitSectionFull
        id="skeletons"
        title="Скелетоны с анимацией загрузки"
        description="Пульсирующие заполнители с shimmer-эффектом. Предотвращают скачки макета (layout shift)."
      >
        <div className="space-y-6">
          <div>
            <h3 className="mb-3 text-sm font-semibold">Текстовые строки</h3>
            <div className="grid gap-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold">Карточки статистики</h3>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="rounded-[var(--radius-lg)] border border-[var(--color-border)] p-4"
                >
                  <Skeleton className="mb-2 h-3 w-16" />
                  <Skeleton className="h-7 w-12" />
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold">Таблица (строки)</h3>
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="size-9 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3.5 w-1/3" />
                    <Skeleton className="h-2.5 w-1/2" />
                  </div>
                  <Skeleton className="h-5 w-14 rounded-full" />
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold">Карточка автомобиля (полная)</h3>
            <div className="grid gap-4 md:grid-cols-2">
              {[1, 2].map((i) => (
                <div
                  key={i}
                  className="rounded-[var(--radius-lg)] border border-[var(--color-border)] p-4"
                >
                  <div className="mb-3 flex items-center gap-3">
                    <Skeleton className="size-14 rounded-[var(--radius-md)]" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-3 w-16" />
                      <Skeleton className="h-4 w-14 rounded-full" />
                    </div>
                  </div>
                  <div className="mb-3">
                    <Skeleton className="h-2 w-full rounded-full" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Skeleton className="h-8 w-full rounded-[var(--radius-sm)]" />
                    <Skeleton className="h-8 w-full rounded-[var(--radius-sm)]" />
                    <Skeleton className="h-8 w-full rounded-[var(--radius-sm)]" />
                    <Skeleton className="h-8 w-full rounded-[var(--radius-sm)]" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold">Карта (плейсхолдер)</h3>
            <div className="relative overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)]">
              <Skeleton className="h-52 w-full" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="rounded-full bg-[var(--color-surface)] p-3 shadow-lg">
                  <FiMapPin className="size-6 text-[var(--color-primary)]" />
                </div>
              </div>
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold">Форма (поля ввода)</h3>
            <div className="max-w-md space-y-3">
              <Skeleton className="h-3 w-14" />
              <Skeleton className="h-10 w-full rounded-[var(--radius-md)]" />
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-10 w-full rounded-[var(--radius-md)]" />
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-24 w-full rounded-[var(--radius-md)]" />
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold">Календарь</h3>
            <div className="max-w-md rounded-[var(--radius-lg)] border p-4">
              <div className="mb-3 flex items-center justify-between">
                <Skeleton className="h-4 w-8" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-8" />
              </div>
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: 35 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full rounded-md" />
                ))}
              </div>
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold">Карточка заказа</h3>
            <div className="grid gap-4 md:grid-cols-2">
              {[1, 2].map((i) => (
                <div
                  key={i}
                  className="rounded-[var(--radius-lg)] border border-[var(--color-border)] p-4"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <Skeleton className="h-4 w-12" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                  <div className="mb-3 flex items-center gap-3">
                    <Skeleton className="size-10 rounded-[var(--radius-md)]" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3.5 w-20" />
                      <Skeleton className="h-2.5 w-16" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </KitSectionFull>

      {/* ================================================================ */}
      {/* 5. ДЕЙСТВИЯ */}
      {/* ================================================================ */}
      <KitSection
        id="actions"
        title="Действия"
        description="Кнопки передают приоритет действия, состояние выполнения и доступную область касания."
      >
        <ExampleCard title="Варианты и состояния">
          <div className="flex flex-wrap gap-3">
            <Button>Основное</Button>
            <Button variant="secondary">Вторичное</Button>
            <Button variant="soft">Мягкое</Button>
            <Button variant="outline">Контурное</Button>
            <Button variant="ghost">Нейтральное</Button>
            <Button variant="danger">Опасное</Button>
            <Button loading>Сохранение</Button>
            <Button disabled>Недоступно</Button>
          </div>
        </ExampleCard>
        <ExampleCard title="Размеры">
          <div className="flex flex-wrap items-center gap-3">
            {sizes.map((size) => (
              <Button key={size} size={size}>
                {size.toUpperCase()}
              </Button>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {sizes.map((size) => (
              <IconButton key={size} size={size} label={`Уведомления, размер ${size}`}>
                <FiBell aria-hidden="true" />
              </IconButton>
            ))}
          </div>
        </ExampleCard>
        <div className="lg:col-span-2">
          <Guidance
            use="для явных действий с понятным приоритетом."
            avoid="кнопки для перехода между страницами."
          />
        </div>
      </KitSection>

      {/* ================================================================ */}
      {/* 6. ФОРМЫ И ВЫБОР */}
      {/* ================================================================ */}
      <KitSectionFull
        id="forms"
        title="Формы и элементы выбора"
        description="Инпуты, селекты, чекбоксы, радио, свитчи, тумблеры, segmented control."
      >
        <div className="space-y-8">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Текстовые поля</h3>
              <Input label="Название *" placeholder="Фургон 12" error="Обязательно" required />
              <Input label="Госномер" placeholder="А 123 МР 77" />
              <Select label="Группа" defaultValue="city">
                <option value="city">Городской парк</option>
                <option value="delivery">Доставка</option>
              </Select>
              <SearchInput placeholder="Поиск..." />
              <Textarea label="Комментарий" hint="Необязательно" />
            </div>
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Правила</h3>
              <Guidance
                use="для ввода и явного выбора данных."
                avoid="placeholder вместо подписи или ошибку без связи с полем."
              />
            </div>
          </div>
          <div className="border-t border-[var(--color-border)]" />
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <div>
              <h3 className="mb-3 text-xs font-semibold tracking-wider text-[var(--color-text-secondary)] uppercase">
                Чекбоксы
              </h3>
              <div className="space-y-2">
                <label className="group flex cursor-pointer items-center gap-2.5 text-xs">
                  <Checkbox defaultChecked />
                  <span className="transition-colors group-hover:text-[var(--color-text)]">
                    Показывать тревоги
                  </span>
                </label>
                <label className="group flex cursor-pointer items-center gap-2.5 text-xs">
                  <Checkbox />
                  <span className="transition-colors group-hover:text-[var(--color-text)]">
                    Звуковое оповещение
                  </span>
                </label>
                <label className="group flex cursor-pointer items-center gap-2.5 text-xs">
                  <Checkbox />
                  <span className="transition-colors group-hover:text-[var(--color-text)]">
                    Push-уведомления
                  </span>
                </label>
                <label className="flex cursor-not-allowed items-center gap-2.5 text-xs opacity-50">
                  <Checkbox disabled />
                  <span>Email-рассылка (недоступно)</span>
                </label>
              </div>
            </div>
            <div>
              <h3 className="mb-3 text-xs font-semibold tracking-wider text-[var(--color-text-secondary)] uppercase">
                Радио-кнопки
              </h3>
              <div className="space-y-2">
                <label className="group flex cursor-pointer items-center gap-2.5 text-xs">
                  <Radio name="period-v2" defaultChecked />
                  <span className="transition-colors group-hover:text-[var(--color-text)]">
                    Сегодня
                  </span>
                </label>
                <label className="group flex cursor-pointer items-center gap-2.5 text-xs">
                  <Radio name="period-v2" />
                  <span className="transition-colors group-hover:text-[var(--color-text)]">
                    Неделя
                  </span>
                </label>
                <label className="group flex cursor-pointer items-center gap-2.5 text-xs">
                  <Radio name="period-v2" />
                  <span className="transition-colors group-hover:text-[var(--color-text)]">
                    Месяц
                  </span>
                </label>
                <label className="group flex cursor-pointer items-center gap-2.5 text-xs">
                  <Radio name="period-v2" />
                  <span className="transition-colors group-hover:text-[var(--color-text)]">
                    Год
                  </span>
                </label>
              </div>
            </div>
            <div>
              <h3 className="mb-3 text-xs font-semibold tracking-wider text-[var(--color-text-secondary)] uppercase">
                Switch (анимированные)
              </h3>
              <div className="space-y-3">
                <SwitchRow label="Только онлайн" defaultChecked />
                <SwitchRow label="Ночной режим" />
                <SwitchRow label="Автообновление" disabled />
              </div>
            </div>
            <div>
              <h3 className="mb-3 text-xs font-semibold tracking-wider text-[var(--color-text-secondary)] uppercase">
                Segmented Control
              </h3>
              <div className="space-y-3">
                <SegmentedControl
                  value={seg}
                  onChange={setSeg}
                  options={[
                    { value: 'all', label: 'Все' },
                    { value: 'online', label: 'Онлайн' },
                  ]}
                />
                <SegmentedControl
                  value="day"
                  onChange={() => {}}
                  options={[
                    { value: 'day', label: 'День' },
                    { value: 'week', label: 'Неделя' },
                    { value: 'month', label: 'Месяц' },
                  ]}
                />
              </div>
            </div>
          </div>
          <div className="border-t border-[var(--color-border)]" />
          <div>
            <h3 className="mb-3 text-xs font-semibold tracking-wider text-[var(--color-text-secondary)] uppercase">
              Анимированные тумблеры (Motion Spring)
            </h3>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              <AnimatedToggle label="Карта" />
              <AnimatedToggle label="События" defaultOn />
              <AnimatedToggle label="ТО" />
              <AnimatedToggle label="WiFi" defaultOn />
              <AnimatedToggle label="GPS" defaultOn />
              <AnimatedToggle label="Звук" />
            </div>
          </div>
        </div>
      </KitSectionFull>

      {/* ================================================================ */}
      {/* 7. БЕЙДЖИ */}
      {/* ================================================================ */}
      <KitSectionFull
        id="badges"
        title="Бейджи (Badge)"
        description="Метки для статусов, категорий и быстрой идентификации. 3 размера × 5 тонов."
      >
        <div className="space-y-4">
          <div>
            <h3 className="mb-2 text-sm font-semibold">Тона</h3>
            <div className="flex flex-wrap gap-2">
              <Badge>Нейтрально</Badge>
              <Badge tone="primary">Основное</Badge>
              <Badge tone="success">Онлайн</Badge>
              <Badge tone="warning">Внимание</Badge>
              <Badge tone="danger">Тревога</Badge>
            </div>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold">Размеры</h3>
            <div className="space-y-3">
              {(['sm', 'md', 'lg'] as const).map((size) => (
                <div key={size} className="flex items-center gap-4">
                  <span className="w-8 text-xs font-medium text-[var(--color-text-secondary)]">
                    {size.toUpperCase()}
                  </span>
                  <div className="flex flex-wrap gap-2">
                    <Badge size={size} tone="neutral">
                      Нейтр.
                    </Badge>
                    <Badge size={size} tone="primary">
                      Осн.
                    </Badge>
                    <Badge size={size} tone="success">
                      Онлайн
                    </Badge>
                    <Badge size={size} tone="warning">
                      Вним.
                    </Badge>
                    <Badge size={size} tone="danger">
                      Тревога
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold">Примеры в интерфейсе</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] p-3">
                <span className="text-sm font-medium">Haval Jolion</span>
                <Badge size="sm" tone="success">
                  На связи
                </Badge>
              </div>
              <div className="flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] p-3">
                <span className="text-sm font-medium">Lada Vesta</span>
                <Badge size="sm" tone="warning">
                  ТО через 500 км
                </Badge>
              </div>
              <div className="flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] p-3">
                <span className="text-sm font-medium">Kia Rio</span>
                <Badge size="sm" tone="danger">
                  Тревога
                </Badge>
              </div>
              <div className="flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] p-3">
                <span className="text-sm font-medium">ГАЗель Next</span>
                <Badge size="sm" tone="neutral">
                  Офлайн
                </Badge>
              </div>
            </div>
          </div>
          <Guidance
            use="для статусов, категорий, счётчиков."
            avoid="для длинных текстов и как замену Alert."
          />
        </div>
      </KitSectionFull>

      {/* ================================================================ */}
      {/* 8. КАРТОЧКИ ПОКАЗАТЕЛЕЙ */}
      {/* ================================================================ */}
      <KitSectionFull
        id="stat-cards"
        title="Карточки показателей"
        description="Базовый, с трендом, с иконкой, погода, топливо, ТО, пробег."
      >
        <div className="space-y-8">
          <div>
            <h3 className="mb-2 text-sm font-semibold">Базовый</h3>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard label="На линии" value="184" />
              <StatCard label="В движении" value="42" />
              <StatCard label="Стоянка" value="128" />
              <StatCard label="Тревог" value="3" />
            </div>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold">С трендом</h3>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                { l: 'Пробег за день', v: '1 245', u: 'км', t: 'up', p: '12%' },
                { l: 'Расход топлива', v: '8.4', u: 'л/100', t: 'down', p: '3%' },
                { l: 'Время в пути', v: '142', u: 'ч', t: 'up', p: '5%' },
                { l: 'Простой', v: '18', u: '%', t: 'down', p: '↓' },
              ].map((c) => (
                <div key={c.l} className="rounded-[var(--radius-md)] border p-3">
                  <p className="text-xs text-[var(--color-text-secondary)]">{c.l}</p>
                  <div className="mt-0.5 flex items-end gap-1">
                    <span className="text-xl font-bold">{c.v}</span>
                    <span className="text-xs text-[var(--color-text-secondary)]">{c.u}</span>
                  </div>
                  <div
                    className={`mt-0.5 flex items-center gap-0.5 text-xs ${c.t === 'up' ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}
                  >
                    {c.t === 'up' ? (
                      <FiArrowUp className="size-3" />
                    ) : (
                      <FiArrowDown className="size-3" />
                    )}
                    {c.p}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold">С иконкой</h3>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                { l: 'Автомобилей', v: '245', c: 'primary', i: <FiTruck className="size-4" /> },
                { l: 'Активных', v: '231', c: 'success', i: <FiCheck className="size-4" /> },
                { l: 'На ТО', v: '12', c: 'warning', i: <FiTool className="size-4" /> },
                { l: 'Тревог', v: '7', c: 'danger', i: <FiAlertTriangle className="size-4" /> },
              ].map((c) => (
                <div key={c.l} className="rounded-[var(--radius-md)] border p-3">
                  <div
                    className={`size-7 rounded-[var(--radius-sm)] bg-[var(--color-${c.c}-soft)] mb-1.5 flex items-center justify-center text-[var(--color-${c.c})]`}
                  >
                    {c.i}
                  </div>
                  <p className="text-xs text-[var(--color-text-secondary)]">{c.l}</p>
                  <p className="mt-0.5 text-xl font-bold">{c.v}</p>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold">Погода и топливо</h3>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <div className="rounded-[var(--radius-md)] border bg-gradient-to-br from-blue-50 to-blue-100 p-3 dark:from-blue-950 dark:to-blue-900">
                <div className="mb-2 flex items-center gap-2">
                  <FiSun className="size-5 text-amber-500" />
                  <span className="text-xs font-medium">Москва</span>
                </div>
                <p className="text-2xl font-bold">+24°</p>
                <p className="text-xs text-[var(--color-text-secondary)]">Ясно, ветер 3 м/с</p>
              </div>
              <div className="rounded-[var(--radius-md)] border bg-gradient-to-br from-gray-50 to-gray-100 p-3 dark:from-gray-900 dark:to-gray-800">
                <div className="mb-2 flex items-center gap-2">
                  <FiCloudRain className="size-5 text-blue-500" />
                  <span className="text-xs font-medium">Питер</span>
                </div>
                <p className="text-2xl font-bold">+17°</p>
                <p className="text-xs text-[var(--color-text-secondary)]">Дождь, ветер 5 м/с</p>
              </div>
              <div className="rounded-[var(--radius-md)] border bg-gradient-to-br from-emerald-50 to-emerald-100 p-3 dark:from-emerald-950 dark:to-emerald-900">
                <div className="mb-2 flex items-center gap-2">
                  <FiDroplet className="size-5 text-emerald-500" />
                  <span className="text-xs font-medium">Всего топлива</span>
                </div>
                <p className="text-2xl font-bold">2 840 л</p>
                <p className="text-xs text-[var(--color-text-secondary)]">Заправлено за месяц</p>
              </div>
              <div className="rounded-[var(--radius-md)] border bg-gradient-to-br from-orange-50 to-orange-100 p-3 dark:from-orange-950 dark:to-orange-900">
                <div className="mb-2 flex items-center gap-2">
                  <FiActivity className="size-5 text-orange-500" />
                  <span className="text-xs font-medium">Расход</span>
                </div>
                <p className="text-2xl font-bold">8.4 л</p>
                <p className="text-xs text-[var(--color-text-secondary)]">На 100 км в среднем</p>
              </div>
            </div>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold">Обслуживание и пробег</h3>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <div className="rounded-[var(--radius-md)] border p-3">
                <div className="mb-2 flex items-center gap-2">
                  <FiTool className="size-4 text-[var(--color-warning)]" />
                  <span className="text-xs font-medium">Ближайшее ТО</span>
                </div>
                <p className="text-2xl font-bold text-[var(--color-warning)]">3</p>
                <p className="text-xs text-[var(--color-text-secondary)]">Машины до 500 км</p>
              </div>
              <div className="rounded-[var(--radius-md)] border p-3">
                <div className="mb-2 flex items-center gap-2">
                  <FiAlertCircle className="size-4 text-[var(--color-danger)]" />
                  <span className="text-xs font-medium">Просрочено ТО</span>
                </div>
                <p className="text-2xl font-bold text-[var(--color-danger)]">2</p>
                <p className="text-xs text-[var(--color-text-secondary)]">Срочно в сервис</p>
              </div>
              <div className="rounded-[var(--radius-md)] border p-3">
                <div className="mb-2 flex items-center gap-2">
                  <FiNavigation className="size-4 text-[var(--color-primary)]" />
                  <span className="text-xs font-medium">Общий пробег</span>
                </div>
                <p className="text-2xl font-bold">1.2M</p>
                <p className="text-xs text-[var(--color-text-secondary)]">км за всё время</p>
              </div>
              <div className="rounded-[var(--radius-md)] border p-3">
                <div className="mb-2 flex items-center gap-2">
                  <FiCalendar className="size-4 text-[var(--color-success)]" />
                  <span className="text-xs font-medium">ТО в этом месяце</span>
                </div>
                <p className="text-2xl font-bold">8</p>
                <p className="text-xs text-[var(--color-text-secondary)]">Запланировано</p>
              </div>
            </div>
          </div>
        </div>
      </KitSectionFull>

      {/* ================================================================ */}
      {/* 9. КОНТРАКТЫ ДАННЫХ */}
      {/* ================================================================ */}
      <KitSection
        id="data-display"
        title="Контракты данных"
        description="Индикаторы, номера, таблицы, списки."
      >
        <ExampleCard title="Индикаторы статуса">
          <div className="space-y-1">
            <StatusIndicator label="На связи" tone="success" />
            <StatusIndicator label="В движении" tone="primary" />
            <StatusIndicator label="Стоянка" tone="warning" />
            <StatusIndicator label="Офлайн" tone="neutral" />
            <StatusIndicator label="Тревога" tone="danger" />
          </div>
        </ExampleCard>
        <ExampleCard title="Номера и аватары">
          <div className="space-y-2">
            <VehiclePlate>А 123 МР 77</VehiclePlate>
            <div className="flex gap-1.5">
              <Avatar name="ПС" size="sm" />
              <Avatar name="ИП" size="md" />
              <Avatar name="СК" size="lg" />
            </div>
            <ListItem
              leading={<Avatar name="ПС" size="sm" />}
              title="Павел Седов"
              description="Администратор"
            />
          </div>
        </ExampleCard>
        <ExampleCard title="Таблица">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Автомобиль</TableHead>
                <TableHead>Госномер</TableHead>
                <TableHead>Статус</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>Haval Jolion</TableCell>
                <TableCell>А 123 МР 77</TableCell>
                <TableCell>
                  <Badge size="sm" tone="success">
                    На связи
                  </Badge>
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>ГАЗель Next</TableCell>
                <TableCell>М 333 АХ 750</TableCell>
                <TableCell>
                  <Badge size="sm" tone="danger">
                    Тревога
                  </Badge>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </ExampleCard>
      </KitSection>

      {/* ================================================================ */}
      {/* 10. КАРТОЧКИ АВТОМОБИЛЕЙ */}
      {/* ================================================================ */}
      <KitSectionFull
        id="photo-cards"
        title="Карточки автомобилей"
        description="6 вариантов с реальным фото. Все 5 статусов + полная карточка с пробегом, топливом, арендой, чистотой и событиями."
      >
        <div className="space-y-8">
          <div>
            <h3 className="mb-2 text-sm font-semibold">1. Микро (для карты/сайдбара)</h3>
            <div className="grid grid-cols-2 gap-1.5 lg:grid-cols-4">
              {vcData.slice(0, 4).map((v) => {
                const t =
                  v.status === 'online'
                    ? 'success'
                    : v.status === 'moving'
                      ? 'primary'
                      : v.status === 'alarm'
                        ? 'danger'
                        : 'neutral';
                return (
                  <div
                    key={v.plate}
                    className="flex items-center gap-1.5 rounded-[var(--radius-sm)] border px-2 py-1"
                  >
                    <StatusIndicator tone={t} />
                    <span className="truncate text-xs font-semibold">{v.plate}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold">2. Компактный (список)</h3>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {vcData.slice(0, 3).map((v) => {
                const sb = statusMap[v.status];
                return (
                  <div
                    key={v.plate}
                    className="flex items-center gap-2.5 rounded-[var(--radius-md)] border p-2.5"
                  >
                    <CarPhoto size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{v.plate}</p>
                      <p className="text-xs text-[var(--color-text-secondary)]">{v.model}</p>
                    </div>
                    <Badge size="sm" tone={sb.tone}>
                      {sb.label}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold">3. Стандартный (дашборд)</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {vcData.slice(0, 3).map((v) => {
                const sb = statusMap[v.status];
                return (
                  <div key={v.plate} className="rounded-[var(--radius-lg)] border p-3">
                    <div className="mb-2.5 flex items-center gap-3">
                      <CarPhoto size="md" />
                      <div className="flex-1">
                        <p className="text-sm font-semibold">{v.plate}</p>
                        <p className="text-xs text-[var(--color-text-secondary)]">{v.model}</p>
                      </div>
                      <Badge size="sm" tone={sb.tone}>
                        {sb.label}
                      </Badge>
                    </div>
                    <div className="mb-2.5 grid grid-cols-2 gap-1.5 text-xs text-[var(--color-text-secondary)]">
                      <span>
                        <FiActivity className="mr-0.5 inline size-3" />
                        {v.speed > 0 ? `${v.speed} км/ч` : '—'}
                      </span>
                      <span>
                        <FiDroplet className="mr-0.5 inline size-3" />
                        {v.fuel}%
                      </span>
                      <span className="truncate">
                        <FiMapPin className="mr-0.5 inline size-3" />
                        {v.location}
                      </span>
                      <span>
                        <FiUser className="mr-0.5 inline size-3" />
                        {v.driver}
                      </span>
                    </div>
                    <Button size="xs" variant="outline" className="w-full">
                      <FiNavigation className="mr-1 size-3" />
                      На карте
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold">4. Горизонтальный (лента/поиск)</h3>
            <div className="grid gap-3 lg:grid-cols-2">
              {vcData.slice(0, 4).map((v) => {
                const sb = statusMap[v.status];
                return (
                  <div key={v.plate} className="flex gap-3 rounded-[var(--radius-md)] border p-3">
                    <CarPhoto size="md" />
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center gap-2">
                        <span className="text-sm font-semibold">{v.plate}</span>
                        <Badge size="sm" tone={sb.tone}>
                          {sb.label}
                        </Badge>
                      </div>
                      <p className="text-xs text-[var(--color-text-secondary)]">
                        {v.model} · {v.mileage.toLocaleString()} км
                      </p>
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-[var(--color-text-secondary)]">
                        <FiMapPin className="size-3" />
                        {v.location}
                      </p>
                      <div className="mt-2 flex gap-1.5">
                        <Button size="xs" variant="outline">
                          Карта
                        </Button>
                        <Button size="xs" variant="ghost">
                          История
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold">5. Превью (галерея/быстрый выбор)</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {vcData.map((v) => (
                <div
                  key={v.plate}
                  className="cursor-pointer overflow-hidden rounded-[var(--radius-md)] border transition-shadow hover:shadow-md"
                >
                  <CarPhoto size="xl" />
                  <div className="p-2 text-center">
                    <p className="text-xs font-semibold">{v.plate}</p>
                    <p className="text-[10px] text-[var(--color-text-secondary)]">{v.model}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold">6. Полная карточка (все данные)</h3>
            <div className="grid gap-4 md:grid-cols-2">
              {vcData.map((v) => {
                const sb = statusMap[v.status];
                const isMoving = v.speed > 0;
                const trackColor = isMoving
                  ? 'var(--color-success)'
                  : v.status === 'alarm'
                    ? 'var(--color-danger)'
                    : 'var(--color-warning)';
                return (
                  <div
                    key={v.plate}
                    className="overflow-hidden rounded-[var(--radius-lg)] border bg-[var(--color-surface)]"
                  >
                    <div className="p-4 pb-0">
                      <div className="mb-3 flex items-start gap-4">
                        <div className="relative">
                          <CarPhoto size="lg" />
                          <div
                            className="absolute -right-1 -bottom-1 flex size-5 items-center justify-center rounded-full border-2 border-white shadow-sm"
                            style={{ backgroundColor: trackColor }}
                          >
                            {isMoving ? (
                              <FiPlay className="size-2.5 text-white" />
                            ) : (
                              <FiStopCircle className="size-2.5 text-white" />
                            )}
                          </div>
                        </div>
                        <div className="flex-1">
                          <div className="mb-1 flex items-center gap-2">
                            <p className="text-base font-semibold">{v.plate}</p>
                            <Badge size="sm" tone={sb.tone}>
                              {sb.label}
                            </Badge>
                          </div>
                          <p className="text-sm text-[var(--color-text-secondary)]">{v.model}</p>
                          <div className="mt-1.5 flex items-center gap-1.5">
                            <FiFlag
                              className={`size-3 ${v.rentStatus === 'В аренде' ? 'text-[var(--color-primary)]' : 'text-[var(--color-success)]'}`}
                            />
                            <span className="text-xs font-medium">{v.rentStatus}</span>
                            {v.rentClient !== '—' && (
                              <span className="text-xs text-[var(--color-text-secondary)]">
                                · {v.rentClient}
                              </span>
                            )}
                          </div>
                          {v.rentEnd !== '—' && (
                            <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
                              {v.rentEnd}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 px-4">
                      <div className="h-1.5 overflow-hidden rounded-full bg-[var(--color-border)]">
                        <motion.div
                          animate={{ width: isMoving ? `${Math.min(v.speed, 100)}%` : '100%' }}
                          className="h-full rounded-full"
                          style={{ backgroundColor: trackColor }}
                        />
                      </div>
                      <div className="mt-1 flex justify-between">
                        <span className="text-[10px] text-[var(--color-text-secondary)]">
                          {isMoving
                            ? 'В движении'
                            : v.status === 'parked'
                              ? 'Стоянка'
                              : v.status === 'alarm'
                                ? 'Тревога'
                                : 'Нет данных'}
                        </span>
                        <span className="text-[10px] text-[var(--color-text-secondary)]">
                          {v.speed} км/ч
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 p-4 text-sm">
                      <div>
                        <p className="mb-0.5 text-xs text-[var(--color-text-secondary)]">
                          Водитель
                        </p>
                        <div className="flex items-center gap-1.5">
                          <FiUser className="size-3.5 text-[var(--color-text-secondary)]" />
                          <p className="font-medium">{v.driver}</p>
                        </div>
                      </div>
                      <div>
                        <p className="mb-0.5 text-xs text-[var(--color-text-secondary)]">Пробег</p>
                        <div className="flex items-center gap-1.5">
                          <FiNavigation className="size-3.5 text-[var(--color-text-secondary)]" />
                          <p className="font-medium">{v.mileage.toLocaleString()} км</p>
                        </div>
                      </div>
                      <div>
                        <p className="mb-0.5 text-xs text-[var(--color-text-secondary)]">Топливо</p>
                        <div className="flex items-center gap-2">
                          <FiDroplet className="size-3.5 text-[var(--color-text-secondary)]" />
                          <div className="flex-1">
                            <div className="h-2 overflow-hidden rounded-full bg-[var(--color-border)]">
                              <div
                                className={`h-full rounded-full ${v.fuel > 20 ? 'bg-[var(--color-success)]' : v.fuel > 10 ? 'bg-[var(--color-warning)]' : 'bg-[var(--color-danger)]'}`}
                                style={{ width: `${v.fuel}%` }}
                              />
                            </div>
                          </div>
                          <span className="w-8 text-right text-xs font-medium">{v.fuel}%</span>
                        </div>
                      </div>
                      <div>
                        <p className="mb-0.5 text-xs text-[var(--color-text-secondary)]">
                          Скорость
                        </p>
                        <div className="flex items-center gap-1.5">
                          <FiActivity className="size-3.5 text-[var(--color-text-secondary)]" />
                          <p className="font-medium">{v.speed} км/ч</p>
                        </div>
                      </div>
                      <div>
                        <p className="mb-0.5 text-xs text-[var(--color-text-secondary)]">
                          Состояние
                        </p>
                        <Badge size="sm" tone={v.isClean ? 'success' : 'warning'}>
                          {v.isClean ? '✨ Чистая' : '🧹 Грязная'}
                        </Badge>
                      </div>
                      <div>
                        <p className="mb-0.5 text-xs text-[var(--color-text-secondary)]">До ТО</p>
                        <p
                          className={`text-sm font-medium ${v.nextService < 1000 ? 'text-[var(--color-danger)]' : v.nextService < 3000 ? 'text-[var(--color-warning)]' : ''}`}
                        >
                          {v.nextService === 0
                            ? 'Просрочено'
                            : `${v.nextService.toLocaleString()} км`}
                        </p>
                      </div>
                      <div className="col-span-2">
                        <p className="mb-0.5 text-xs text-[var(--color-text-secondary)]">
                          Местоположение
                        </p>
                        <div className="flex items-center gap-1.5">
                          <FiMapPin className="size-3.5 text-[var(--color-primary)]" />
                          <p className="text-sm">{v.location}</p>
                        </div>
                      </div>
                    </div>
                    {v.events.length > 0 && (
                      <div className="px-4 pb-3">
                        <div className="space-y-1.5 border-t pt-3">
                          {v.events.map((e, i) => (
                            <EventCard
                              key={i}
                              title={e.title}
                              vehicleName={v.plate}
                              timeLabel={e.time}
                              tone={e.tone}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="flex gap-2 px-4 pb-4">
                      <Button size="sm" className="flex-1">
                        <FiNavigation className="mr-1 size-3" />
                        На карте
                      </Button>
                      <Button size="sm" variant="secondary">
                        <FiActivity className="mr-1 size-3" />
                        История
                      </Button>
                      <IconButton size="sm" label="Действия" variant="ghost">
                        <FiMoreHorizontal className="size-4" />
                      </IconButton>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </KitSectionFull>

      {/* ================================================================ */}
      {/* 11. МОЙКА АВТОПАРКА */}
      {/* ================================================================ */}
      <KitSectionFull
        id="wash"
        title="Мойка автопарка"
        description="Учёт моек: календарь с точками, список, карточки, статусы в карточке авто."
      >
        <div className="space-y-8">
          <div>
            <h3 className="mb-3 text-sm font-semibold">Статус мойки в карточке автомобиля</h3>
            <p className="mb-4 text-xs text-[var(--color-text-secondary)]">
              В любой карточке авто отображается статус: ✨ Помыта (зелёный), 🧽 Запланирована
              (синий), ⚠️ Просрочена (красный), 🧹 Грязная (жёлтый), ✨ Чистая (зелёный).
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {[
                { label: '✨ Помыта', tone: 'success' as const, desc: 'Сегодня выполнена' },
                { label: '🧽 Запланирована', tone: 'primary' as const, desc: 'На сегодня/завтра' },
                {
                  label: '⚠️ Просрочена',
                  tone: 'danger' as const,
                  desc: 'План на вчера, не выполнена',
                },
                { label: '🧹 Грязная', tone: 'warning' as const, desc: 'Мойка не запланирована' },
                { label: '✨ Чистая', tone: 'success' as const, desc: 'Моек нет, состояние ок' },
              ].map((item) => (
                <div key={item.label} className="rounded-[var(--radius-md)] border p-3 text-center">
                  <Badge size="md" tone={item.tone}>
                    {item.label}
                  </Badge>
                  <p className="mt-2 text-[10px] text-[var(--color-text-secondary)]">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="border-t border-[var(--color-border)]" />
          <div>
            <h3 className="mb-3 text-sm font-semibold">Статистика моек</h3>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                { label: 'Всего за месяц', value: '47' },
                { label: 'Запланировано', value: '8' },
                { label: 'Сегодня', value: '3' },
                { label: 'Средний чек', value: '1 850 ₽' },
              ].map((s) => (
                <div key={s.label} className="rounded-[var(--radius-md)] border p-3">
                  <p className="text-[11px] text-[var(--color-text-secondary)]">{s.label}</p>
                  <p className="mt-0.5 text-lg font-bold">{s.value}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="border-t border-[var(--color-border)]" />
          <div>
            <h3 className="mb-3 text-sm font-semibold">Панель инструментов</h3>
            <div className="flex flex-wrap items-center gap-2 rounded-[var(--radius-md)] border bg-[var(--color-surface)] p-3">
              <SegmentedControl
                value="list"
                onChange={() => {}}
                options={[
                  { value: 'list', label: '📋 Список' },
                  { value: 'calendar', label: '📅 Календарь' },
                ]}
              />
              <div className="mx-1 h-6 w-px bg-[var(--color-border)]" />
              <SearchInput placeholder="Поиск по номеру..." />
              <Select label="Тип мойки" defaultValue="all">
                <option value="all">Все типы</option>
                <option value="complex">Комплекс</option>
                <option value="body">Кузов</option>
                <option value="mats">Коврики</option>
                <option value="trunk">Багажник</option>
                <option value="interior">Салон</option>
                <option value="engine">Двигатель</option>
              </Select>
              <Select label="Статус мойки" defaultValue="all">
                <option value="all">Все статусы</option>
                <option value="completed">✅ Выполнена</option>
                <option value="planned">📅 Запланирована</option>
                <option value="cancelled">❌ Отменена</option>
              </Select>
              <Button size="xs">+ Новая мойка</Button>
            </div>
          </div>
          <div className="border-t border-[var(--color-border)]" />
          <div>
            <h3 className="mb-3 text-sm font-semibold">Таблица моек (режим «Список»)</h3>
            <div className="overflow-x-auto rounded-[var(--radius-md)] border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Дата</TableHead>
                    <TableHead>Автомобиль</TableHead>
                    <TableHead>Тип мойки</TableHead>
                    <TableHead>Исполнитель</TableHead>
                    <TableHead className="w-[80px]">Сумма</TableHead>
                    <TableHead className="w-[110px]">Статус</TableHead>
                    <TableHead className="w-[80px]">Фото</TableHead>
                    <TableHead className="w-[40px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {washRecords.map((w) => (
                    <TableRow key={w.id}>
                      <TableCell>
                        <p className="text-xs font-medium">{w.date}</p>
                        <p className="text-[10px] text-[var(--color-text-secondary)]">{w.time}</p>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <CarPhoto size="sm" />
                          <div>
                            <p className="text-xs font-semibold">{w.plate}</p>
                            <p className="text-[10px] text-[var(--color-text-secondary)]">
                              {w.model}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-0.5">
                          {w.washTypeLabel.map((t) => (
                            <Badge key={t} size="sm" tone="neutral">
                              {t}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="text-xs">{w.performer}</p>
                      </TableCell>
                      <TableCell>
                        <p className="text-xs font-medium">{w.cost}</p>
                      </TableCell>
                      <TableCell>
                        <Badge size="sm" tone={w.statusTone}>
                          {w.statusLabel}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-xs text-[var(--color-text-secondary)]">
                          <FiCamera className="size-3" />
                          <span>{w.photoCount}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <IconButton size="xs" label="Действия" variant="ghost">
                          <FiMoreHorizontal className="size-3" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
          <div className="border-t border-[var(--color-border)]" />
          <div>
            <h3 className="mb-3 text-sm font-semibold">Календарь моек</h3>
            <div className="max-w-lg rounded-[var(--radius-lg)] border bg-[var(--color-surface)] p-4">
              <WashCalendar />
            </div>
          </div>
          <div className="border-t border-[var(--color-border)]" />
          <div>
            <h3 className="mb-3 text-sm font-semibold">Карточки моек (мобильный вид)</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {washRecords.slice(0, 3).map((w) => (
                <div
                  key={w.id}
                  className="rounded-[var(--radius-lg)] border bg-[var(--color-surface)] p-3"
                >
                  <div className="mb-2.5 flex items-center gap-2.5">
                    <CarPhoto size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{w.plate}</p>
                      <p className="text-[11px] text-[var(--color-text-secondary)]">{w.model}</p>
                    </div>
                    <Badge size="sm" tone={w.statusTone}>
                      {w.statusLabel}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 text-xs text-[var(--color-text-secondary)]">
                    <span>🧽 {w.washTypeLabel.join(', ')}</span>
                    <span>👤 {w.performer}</span>
                    <span>💰 {w.cost}</span>
                    <span>
                      📅 {w.date} {w.time}
                    </span>
                  </div>
                  {w.photoCount > 0 && (
                    <div className="mt-2 flex gap-1.5">
                      <span className="cursor-pointer text-[10px] text-[var(--color-primary)] hover:underline">
                        🖼️ До
                      </span>
                      <span className="cursor-pointer text-[10px] text-[var(--color-primary)] hover:underline">
                        🖼️ После
                      </span>
                    </div>
                  )}
                  {w.status === 'planned' && (
                    <div className="mt-2 flex gap-1.5">
                      <Button size="xs" className="flex-1">
                        ✅ Выполнена
                      </Button>
                      <Button size="xs" variant="outline">
                        ✏️
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
          <div className="border-t border-[var(--color-border)]" />
          <div>
            <h3 className="mb-3 text-sm font-semibold">Форма «Новая мойка»</h3>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-3 rounded-[var(--radius-lg)] border bg-[var(--color-surface)] p-4">
                <p className="text-xs font-semibold tracking-wider text-[var(--color-text-secondary)] uppercase">
                  Данные мойки
                </p>
                <Select label="Автомобиль *" defaultValue="">
                  <option value="">Выберите автомобиль...</option>
                  <option value="1">А 123 МР 77 — Haval Jolion</option>
                  <option value="2">В 456 КХ 178 — Lada Vesta Cross</option>
                  <option value="3">Е 789 НО 77 — Toyota Camry</option>
                </Select>
                <div>
                  <p className="mb-1.5 text-xs font-medium text-[var(--color-text)]">Тип мойки *</p>
                  <div className="space-y-1">
                    <label className="flex items-center gap-2 text-xs">
                      <Checkbox />
                      Кузов
                    </label>
                    <label className="flex items-center gap-2 text-xs">
                      <Checkbox />
                      Коврики
                    </label>
                    <label className="flex items-center gap-2 text-xs">
                      <Checkbox />
                      Багажник
                    </label>
                    <label className="flex items-center gap-2 text-xs">
                      <Checkbox />
                      Салон
                    </label>
                    <label className="flex items-center gap-2 text-xs">
                      <Checkbox />
                      Двигатель
                    </label>
                    <label className="flex items-center gap-2 text-xs">
                      <Checkbox defaultChecked />
                      Комплекс (всё сразу)
                    </label>
                  </div>
                </div>
                <div>
                  <p className="mb-1.5 text-xs font-medium text-[var(--color-text)]">Когда *</p>
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-2 text-xs">
                      <Radio name="when" defaultChecked />
                      Сейчас (выполнена)
                    </label>
                    <label className="flex items-center gap-2 text-xs">
                      <Radio name="when" />
                      Запланировать
                    </label>
                  </div>
                </div>
                <Select label="Исполнитель" defaultValue="">
                  <option value="">Выберите...</option>
                  <option value="1">Иванов Иван</option>
                  <option value="2">Петров Сергей</option>
                </Select>
                <Input label="Стоимость" placeholder="2 500" hint="₽" />
              </div>
              <div className="space-y-3 rounded-[var(--radius-lg)] border bg-[var(--color-surface)] p-4">
                <p className="text-xs font-semibold tracking-wider text-[var(--color-text-secondary)] uppercase">
                  Фото и комментарий
                </p>
                <div>
                  <p className="mb-1.5 text-xs font-medium text-[var(--color-text)]">Фото ДО *</p>
                  <div className="cursor-pointer rounded-[var(--radius-md)] border-2 border-dashed p-4 text-center transition-colors hover:border-[var(--color-primary)]">
                    <FiCamera className="mx-auto mb-1 size-6 text-[var(--color-text-secondary)]" />
                    <p className="text-xs text-[var(--color-text-secondary)]">
                      Нажмите для загрузки
                    </p>
                    <p className="text-[10px] text-[var(--color-text-secondary)]">0/5 фото</p>
                  </div>
                </div>
                <div>
                  <p className="mb-1.5 text-xs font-medium text-[var(--color-text)]">Фото ПОСЛЕ</p>
                  <div className="cursor-pointer rounded-[var(--radius-md)] border-2 border-dashed p-4 text-center transition-colors hover:border-[var(--color-primary)]">
                    <FiCamera className="mx-auto mb-1 size-6 text-[var(--color-text-secondary)]" />
                    <p className="text-xs text-[var(--color-text-secondary)]">
                      Нажмите для загрузки
                    </p>
                    <p className="text-[10px] text-[var(--color-text-secondary)]">0/5 фото</p>
                  </div>
                  <p className="mt-1 text-[10px] text-[var(--color-text-secondary)]">
                    Обязательно, если статус «Выполнена»
                  </p>
                </div>
                <Textarea label="Комментарий" hint="Необязательно" />
                <div className="flex gap-2 pt-2">
                  <Button size="sm" variant="outline" className="flex-1">
                    ❌ Отмена
                  </Button>
                  <Button size="sm" className="flex-1">
                    💾 Сохранить
                  </Button>
                </div>
              </div>
            </div>
          </div>
          <div className="border-t border-[var(--color-border)]" />
          <div>
            <h3 className="mb-3 text-sm font-semibold">Интеграция с карточкой авто</h3>
            <p className="mb-4 text-xs text-[var(--color-text-secondary)]">
              Если машина подаётся клиенту и она грязная — система предлагает запланировать мойку.
            </p>
            <div className="max-w-md overflow-hidden rounded-[var(--radius-lg)] border bg-[var(--color-surface)]">
              <div className="border-b border-[var(--color-warning)] bg-[var(--color-warning-soft)] px-4 py-3">
                <div className="flex items-start gap-2">
                  <FiAlertTriangle className="mt-0.5 size-4 shrink-0 text-[var(--color-warning)]" />
                  <div>
                    <p className="text-xs font-semibold text-[var(--color-warning)]">
                      ⚠️ Внимание! Требуется мойка
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
                      Monjaro (А 123 МР 77) подаётся клиенту завтра в 9:00. Текущее состояние: 🧹
                      Грязная.
                    </p>
                  </div>
                </div>
                <div className="mt-2 flex gap-2">
                  <Button size="xs">🧽 Да, на завтра 7:00</Button>
                  <Button size="xs" variant="ghost">
                    ❌ Пропустить
                  </Button>
                </div>
              </div>
              <div className="p-4">
                <div className="flex items-center gap-2.5">
                  <CarPhoto size="sm" />
                  <div>
                    <p className="text-sm font-semibold">А 123 МР 77</p>
                    <p className="text-[11px] text-[var(--color-text-secondary)]">Haval Jolion</p>
                  </div>
                  <Badge size="sm" tone="warning">
                    🧹 Грязная
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </div>
      </KitSectionFull>

      {/* ================================================================ */}
      {/* 12. ТЕХНИЧЕСКОЕ ОБСЛУЖИВАНИЕ */}
      {/* ================================================================ */}
      <KitSectionFull
        id="maintenance"
        title="Техническое обслуживание"
        description="Учёт ТО: календарь, список, карточки, пробег, регламент, прогресс-бар, предупреждения."
      >
        <div className="space-y-8">
          <div>
            <h3 className="mb-3 text-sm font-semibold">Статус ТО в карточке автомобиля</h3>
            <p className="mb-4 text-xs text-[var(--color-text-secondary)]">
              В карточке авто: ✅ ТО пройдено (зелёный), 📅 Запланировано (синий), ⚠️ Просрочено
              (красный), 🔶 Скоро (жёлтый), ✅ Ок (зелёный с километражем).
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {[
                { label: '✅ ТО пройдено', tone: 'success' as const, desc: 'Выполнено сегодня' },
                { label: '📅 Запланировано', tone: 'primary' as const, desc: 'Дата назначена' },
                { label: '⚠️ Просрочено', tone: 'danger' as const, desc: 'План на вчера' },
                { label: '🔶 ТО скоро', tone: 'warning' as const, desc: '< 500 км или < 7 дн' },
                { label: '✅ ТО: 3 200 км', tone: 'success' as const, desc: 'Более 3000 км' },
              ].map((item) => (
                <div key={item.label} className="rounded-[var(--radius-md)] border p-3 text-center">
                  <Badge size="md" tone={item.tone}>
                    {item.label}
                  </Badge>
                  <p className="mt-2 text-[10px] text-[var(--color-text-secondary)]">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="border-t border-[var(--color-border)]" />
          <div>
            <h3 className="mb-3 text-sm font-semibold">Статистика ТО</h3>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                { label: 'Всего за год', value: '34' },
                { label: 'Ближайшее ТО', value: '3 (до 500 км)' },
                { label: 'Просрочено', value: '2 (срочно!)' },
                { label: 'Затраты за год', value: '187 500 ₽' },
              ].map((s) => (
                <div key={s.label} className="rounded-[var(--radius-md)] border p-3">
                  <p className="text-[11px] text-[var(--color-text-secondary)]">{s.label}</p>
                  <p className="mt-0.5 text-lg font-bold">{s.value}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="border-t border-[var(--color-border)]" />
          <div>
            <h3 className="mb-3 text-sm font-semibold">Панель инструментов</h3>
            <div className="flex flex-wrap items-center gap-2 rounded-[var(--radius-md)] border bg-[var(--color-surface)] p-3">
              <SegmentedControl
                value="list"
                onChange={() => {}}
                options={[
                  { value: 'list', label: '📋 Список' },
                  { value: 'calendar', label: '📅 Календарь' },
                ]}
              />
              <div className="mx-1 h-6 w-px bg-[var(--color-border)]" />
              <SearchInput placeholder="Поиск по номеру..." />
              <Select label="Тип обслуживания" defaultValue="all">
                <option value="all">Все типы</option>
                <option value="oil">Замена масла</option>
                <option value="filters">Замена фильтров</option>
                <option value="brakes">Замена колодок</option>
                <option value="timing">ГРМ + помпа</option>
                <option value="spark">Свечи</option>
                <option value="to_reg">Регламентное ТО</option>
                <option value="other">Прочее</option>
              </Select>
              <Select label="Статус обслуживания" defaultValue="all">
                <option value="all">Все статусы</option>
                <option value="completed">✅ Выполнено</option>
                <option value="planned">📅 Запланировано</option>
                <option value="overdue">⚠️ Просрочено</option>
                <option value="cancelled">❌ Отменено</option>
              </Select>
              <Button size="xs">+ Новое ТО</Button>
            </div>
          </div>
          <div className="border-t border-[var(--color-border)]" />
          <div>
            <h3 className="mb-3 text-sm font-semibold">Таблица ТО (режим «Список»)</h3>
            <div className="overflow-x-auto rounded-[var(--radius-md)] border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Дата</TableHead>
                    <TableHead>Автомобиль</TableHead>
                    <TableHead>Тип ТО</TableHead>
                    <TableHead className="w-[80px]">Пробег</TableHead>
                    <TableHead>Сервис</TableHead>
                    <TableHead className="w-[90px]">Стоимость</TableHead>
                    <TableHead className="w-[110px]">Статус</TableHead>
                    <TableHead className="w-[60px]">Чек</TableHead>
                    <TableHead className="w-[40px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {maintenanceRecords.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell>
                        <p className="text-xs font-medium">{m.date}</p>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <CarPhoto size="sm" />
                          <div>
                            <p className="text-xs font-semibold">{m.plate}</p>
                            <p className="text-[10px] text-[var(--color-text-secondary)]">
                              {m.model}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-0.5">
                          {m.typeLabel.map((t) => (
                            <Badge key={t} size="sm" tone="neutral">
                              {t}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="text-xs">{m.mileage.toLocaleString()}</p>
                      </TableCell>
                      <TableCell>
                        <p className="text-xs">{m.serviceName}</p>
                      </TableCell>
                      <TableCell>
                        <p className="text-xs font-medium">{m.cost}</p>
                      </TableCell>
                      <TableCell>
                        <Badge size="sm" tone={m.statusTone}>
                          {m.statusLabel}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {m.photoCount > 0 ? (
                          <FiCamera className="size-3.5 text-[var(--color-text-secondary)]" />
                        ) : (
                          <span className="text-[10px] text-[var(--color-text-secondary)]">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <IconButton size="xs" label="Действия" variant="ghost">
                          <FiMoreHorizontal className="size-3" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
          <div className="border-t border-[var(--color-border)]" />
          <div>
            <h3 className="mb-3 text-sm font-semibold">Календарь ТО</h3>
            <div className="max-w-lg rounded-[var(--radius-lg)] border bg-[var(--color-surface)] p-4">
              <MaintenanceCalendar />
            </div>
          </div>
          <div className="border-t border-[var(--color-border)]" />
          <div>
            <h3 className="mb-3 text-sm font-semibold">Прогресс-бар до следующего ТО</h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {maintenanceProgress.map((p) => (
                <div key={p.label} className="rounded-[var(--radius-md)] border p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="text-lg">{p.icon}</span>
                    <div>
                      <p className="text-xs font-semibold">{p.label}</p>
                      <p className="text-[10px] text-[var(--color-text-secondary)]">{p.car}</p>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px]">
                      <span className="text-[var(--color-text-secondary)]">
                        {p.currentKm.toLocaleString()} км
                      </span>
                      <span className="text-[var(--color-text-secondary)]">
                        {p.nextKm.toLocaleString()} км
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-[var(--color-border)]">
                      <div
                        className={`h-full rounded-full ${p.color}`}
                        style={{ width: `${Math.min(p.percent, 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px]">
                      <span className="font-medium">
                        {p.remaining > 0
                          ? `Осталось: ${p.remaining.toLocaleString()} км`
                          : 'Просрочено!'}
                      </span>
                      <span>{p.percent}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="border-t border-[var(--color-border)]" />
          <div>
            <h3 className="mb-3 text-sm font-semibold">Карточки ТО (мобильный вид)</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {maintenanceRecords.slice(0, 3).map((m) => (
                <div
                  key={m.id}
                  className="rounded-[var(--radius-lg)] border bg-[var(--color-surface)] p-3"
                >
                  <div className="mb-2.5 flex items-center gap-2.5">
                    <CarPhoto size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{m.plate}</p>
                      <p className="text-[11px] text-[var(--color-text-secondary)]">{m.model}</p>
                    </div>
                    <Badge size="sm" tone={m.statusTone}>
                      {m.statusLabel}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 text-xs text-[var(--color-text-secondary)]">
                    <span>🔧 {m.typeLabel.join(', ')}</span>
                    <span>📏 {m.mileage.toLocaleString()} км</span>
                    <span>🏪 {m.serviceName}</span>
                    <span>💰 {m.cost}</span>
                  </div>
                  {m.status === 'planned' && (
                    <div className="mt-2 flex gap-1.5">
                      <Button size="xs" className="flex-1">
                        ✅ Выполнено
                      </Button>
                      <Button size="xs" variant="outline">
                        ✏️
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
          <div className="border-t border-[var(--color-border)]" />
          <div>
            <h3 className="mb-3 text-sm font-semibold">Предупреждения в карточке авто</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="overflow-hidden rounded-[var(--radius-lg)] border bg-[var(--color-surface)]">
                <div className="border-b border-[var(--color-warning)] bg-[var(--color-warning-soft)] px-4 py-3">
                  <div className="flex items-start gap-2">
                    <FiAlertTriangle className="mt-0.5 size-4 shrink-0 text-[var(--color-warning)]" />
                    <div>
                      <p className="text-xs font-semibold">🔶 Ближайшее ТО</p>
                      <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
                        Toyota Camry (Е 789 НО 77) — замена масла через 800 км. ТО на 90 000 км.
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--color-border)]">
                    <div
                      className="h-full rounded-full bg-[var(--color-warning)]"
                      style={{ width: '88%' }}
                    />
                  </div>
                  <div className="mt-2 flex gap-2">
                    <Button size="xs">🔧 Запланировать</Button>
                    <Button size="xs" variant="ghost">
                      📅 В календарь
                    </Button>
                  </div>
                </div>
              </div>
              <div className="overflow-hidden rounded-[var(--radius-lg)] border bg-[var(--color-surface)]">
                <div className="border-b border-[var(--color-danger)] bg-[var(--color-danger-soft)] px-4 py-3">
                  <div className="flex items-start gap-2">
                    <FiAlertTriangle className="mt-0.5 size-4 shrink-0 text-[var(--color-danger)]" />
                    <div>
                      <p className="text-xs font-semibold text-[var(--color-danger)]">
                        🚨 Просрочено ТО!
                      </p>
                      <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
                        Kia Rio (К 111 МР 199) — замена ГРМ просрочена на 1 450 км. Срочно в сервис!
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 flex gap-2">
                    <Button size="xs" variant="danger">
                      🔧 Запланировать
                    </Button>
                    <Button size="xs" variant="ghost">
                      📞 Позвонить
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="border-t border-[var(--color-border)]" />
          <div>
            <h3 className="mb-3 text-sm font-semibold">Форма «Новое ТО»</h3>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-3 rounded-[var(--radius-lg)] border bg-[var(--color-surface)] p-4">
                <p className="text-xs font-semibold tracking-wider text-[var(--color-text-secondary)] uppercase">
                  Данные ТО
                </p>
                <Select label="Автомобиль *" defaultValue="">
                  <option value="">Выберите автомобиль...</option>
                  <option value="1">А 123 МР 77 — Haval Jolion</option>
                  <option value="3">Е 789 НО 77 — Toyota Camry</option>
                  <option value="4">К 111 МР 199 — Kia Rio X-Line</option>
                </Select>
                <Select label="Тип ТО *" defaultValue="">
                  <option value="">Выберите тип...</option>
                  <option value="oil">🛢️ Замена масла</option>
                  <option value="filters">🔍 Замена фильтров</option>
                  <option value="brakes">🛞 Замена колодок</option>
                  <option value="timing">⚙️ ГРМ + помпа</option>
                  <option value="spark">🔥 Замена свечей</option>
                  <option value="to_reg">📋 Регламентное ТО</option>
                  <option value="other">🔩 Прочее</option>
                </Select>
                <Input
                  label="Пробег на момент ТО *"
                  placeholder="45 680"
                  hint="км · последний: 45 680 км"
                />
                <div>
                  <p className="mb-1.5 text-xs font-medium text-[var(--color-text)]">Когда *</p>
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-2 text-xs">
                      <Radio name="when-to" defaultChecked />
                      Сейчас (выполнено)
                    </label>
                    <label className="flex items-center gap-2 text-xs">
                      <Radio name="when-to" />
                      Запланировать
                    </label>
                  </div>
                </div>
                <Select label="Сервис" defaultValue="">
                  <option value="">Выберите...</option>
                  <option value="1">АвтоСпец</option>
                  <option value="2">Сервис №5</option>
                  <option value="3">Дилер Toyota</option>
                  <option value="4">ИП Сидоров</option>
                  <option value="5">Грузосервис</option>
                </Select>
                <Input label="Стоимость" placeholder="12 500" hint="₽" />
                <Input label="Запчасти" placeholder="Каталожные номера или названия" />
              </div>
              <div className="space-y-3 rounded-[var(--radius-lg)] border bg-[var(--color-surface)] p-4">
                <p className="text-xs font-semibold tracking-wider text-[var(--color-text-secondary)] uppercase">
                  Документы
                </p>
                <div>
                  <p className="mb-1.5 text-xs font-medium text-[var(--color-text)]">
                    Фото чека / заказ-наряда
                  </p>
                  <div className="cursor-pointer rounded-[var(--radius-md)] border-2 border-dashed p-4 text-center transition-colors hover:border-[var(--color-primary)]">
                    <FiCamera className="mx-auto mb-1 size-6 text-[var(--color-text-secondary)]" />
                    <p className="text-xs text-[var(--color-text-secondary)]">
                      Нажмите для загрузки
                    </p>
                    <p className="text-[10px] text-[var(--color-text-secondary)]">0/5 фото</p>
                  </div>
                </div>
                <Textarea label="Комментарий" hint="Необязательно" />
                <div className="flex gap-2 pt-2">
                  <Button size="sm" variant="outline" className="flex-1">
                    ❌ Отмена
                  </Button>
                  <Button size="sm" className="flex-1">
                    💾 Сохранить
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </KitSectionFull>

      {/* ================================================================ */}
      {/* 13. КЛИЕНТЫ И ЗАКАЗЫ */}
      {/* ================================================================ */}
      <KitSectionFull
        id="clients"
        title="Клиенты и заказы"
        description="Кто заказал, куда подать, какая машина, кто ответственный, статус заказа."
      >
        <div className="space-y-8">
          <div>
            <h3 className="mb-3 text-sm font-semibold">Статистика заказов</h3>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                { label: 'Активных заказов', value: '18' },
                { label: 'На сегодня', value: '7' },
                { label: 'Выполнено за месяц', value: '142' },
                { label: 'Постоянных клиентов', value: '34' },
              ].map((s) => (
                <div key={s.label} className="rounded-[var(--radius-md)] border p-3">
                  <p className="text-[11px] text-[var(--color-text-secondary)]">{s.label}</p>
                  <p className="mt-0.5 text-lg font-bold">{s.value}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="border-t border-[var(--color-border)]" />
          <div>
            <h3 className="mb-3 text-sm font-semibold">Таблица заказов</h3>
            <div className="overflow-x-auto rounded-[var(--radius-md)] border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[60px]">№</TableHead>
                    <TableHead>Клиент</TableHead>
                    <TableHead>Автомобиль</TableHead>
                    <TableHead>Маршрут</TableHead>
                    <TableHead>Дата подачи</TableHead>
                    <TableHead>Ответственный</TableHead>
                    <TableHead className="w-[100px]">Статус</TableHead>
                    <TableHead className="w-[40px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell>
                        <p className="font-mono text-xs font-semibold text-[var(--color-primary)]">
                          #{o.id}
                        </p>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="text-xs font-semibold">{o.clientName}</p>
                          <p className="text-[10px] text-[var(--color-text-secondary)]">
                            {o.clientPhone}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <CarPhoto size="sm" />
                          <div>
                            <p className="text-xs font-semibold">{o.plate}</p>
                            <p className="text-[10px] text-[var(--color-text-secondary)]">
                              {o.model}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="text-xs">{o.from}</p>
                          <p className="flex items-center gap-1 text-[10px] text-[var(--color-text-secondary)]">
                            <FiArrowDown className="size-2.5" />
                            {o.to}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="text-xs">{o.date}</p>
                        <p className="text-[10px] text-[var(--color-text-secondary)]">{o.time}</p>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Avatar name={o.responsible} size="xs" />
                          <p className="text-xs">{o.responsible}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge size="sm" tone={o.statusTone}>
                          {o.statusLabel}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <IconButton size="xs" label="Действия" variant="ghost">
                          <FiMoreHorizontal className="size-3" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
          <div className="border-t border-[var(--color-border)]" />
          <div>
            <h3 className="mb-3 text-sm font-semibold">Карточки заказов (мобильный вид)</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {orders.slice(0, 3).map((o) => (
                <div
                  key={o.id}
                  className="rounded-[var(--radius-lg)] border bg-[var(--color-surface)] p-3"
                >
                  <div className="mb-2.5 flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-[var(--color-primary)]">
                      #{o.id}
                    </span>
                    <Badge size="sm" tone={o.statusTone}>
                      {o.statusLabel}
                    </Badge>
                  </div>
                  <div className="mb-2.5 flex items-center gap-2.5">
                    <CarPhoto size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{o.plate}</p>
                      <p className="text-[11px] text-[var(--color-text-secondary)]">{o.model}</p>
                    </div>
                  </div>
                  <div className="space-y-1 text-xs text-[var(--color-text-secondary)]">
                    <div className="flex items-center gap-1.5">
                      <FiUser className="size-3" />
                      <span>
                        {o.clientName} · {o.clientPhone}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <FiMapPin className="size-3" />
                      <span>
                        {o.from} → {o.to}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <FiCalendar className="size-3" />
                      <span>
                        {o.date} {o.time}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <FiFlag className="size-3" />
                      <span>Отв: {o.responsible}</span>
                    </div>
                  </div>
                  <div className="mt-2.5 flex gap-1.5">
                    <Button size="xs" variant="outline" className="flex-1">
                      📋 Детали
                    </Button>
                    <Button size="xs" variant="ghost">
                      ✏️
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="border-t border-[var(--color-border)]" />
          <div>
            <h3 className="mb-3 text-sm font-semibold">Форма «Новый заказ»</h3>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-3 rounded-[var(--radius-lg)] border bg-[var(--color-surface)] p-4">
                <p className="text-xs font-semibold tracking-wider text-[var(--color-text-secondary)] uppercase">
                  Клиент и автомобиль
                </p>
                <Select label="Клиент *" defaultValue="">
                  <option value="">Выберите клиента...</option>
                  <option value="1">ООО «ТрансЛогистик»</option>
                  <option value="2">ИП Сидоров</option>
                  <option value="3">Анна Петрова</option>
                  <option value="new">+ Новый клиент</option>
                </Select>
                <Input label="Телефон клиента" placeholder="+7 (999) 123-45-67" />
                <Select label="Автомобиль *" defaultValue="">
                  <option value="">Выберите автомобиль...</option>
                  <option value="1">А 123 МР 77 — Haval Jolion (свободна)</option>
                  <option value="2">В 456 КХ 178 — Lada Vesta (свободна)</option>
                </Select>
                <Select label="Ответственный *" defaultValue="">
                  <option value="">Назначить...</option>
                  <option value="1">Иванов Иван</option>
                  <option value="2">Петров Сергей</option>
                </Select>
              </div>
              <div className="space-y-3 rounded-[var(--radius-lg)] border bg-[var(--color-surface)] p-4">
                <p className="text-xs font-semibold tracking-wider text-[var(--color-text-secondary)] uppercase">
                  Маршрут и дата
                </p>
                <Input label="Откуда *" placeholder="ул. Ленина, 15" />
                <Input label="Куда *" placeholder="Шереметьево, Терминал D" />
                <Input label="Дата подачи *" placeholder="20.07.2026" hint="ДД.ММ.ГГГГ" />
                <Input label="Время подачи *" placeholder="09:00" hint="ЧЧ:ММ" />
                <Input label="Стоимость" placeholder="5 000" hint="₽" />
                <Textarea label="Комментарий" hint="Пожелания клиента, особенности" />
                <div className="flex gap-2 pt-2">
                  <Button size="sm" variant="outline" className="flex-1">
                    ❌ Отмена
                  </Button>
                  <Button size="sm" className="flex-1">
                    💾 Создать заказ
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </KitSectionFull>

      {/* ================================================================ */}
      {/* 14. ПРОФИЛИ И РОЛИ */}
      {/* ================================================================ */}
      <KitSectionFull
        id="profiles"
        title="Профили и роли"
        description="Администратор (все права), Оператор (управление заказами), Водитель (просмотр заявок и машины)."
      >
        <div className="space-y-8">
          <div>
            <h3 className="mb-3 text-sm font-semibold">Роли пользователей</h3>
            <div className="grid gap-4 md:grid-cols-3">
              {roles.map((role) => (
                <div
                  key={role.name}
                  className={`rounded-[var(--radius-lg)] border-2 p-4 ${role.borderColor}`}
                >
                  <div className="mb-3 flex items-center gap-3">
                    <span className="text-2xl">{role.icon}</span>
                    <div>
                      <p className="text-base font-semibold">{role.name}</p>
                      <Badge size="sm" tone={role.tone}>
                        {role.level}
                      </Badge>
                    </div>
                  </div>
                  <p className="mb-3 text-xs text-[var(--color-text-secondary)]">{role.desc}</p>
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-semibold text-[var(--color-text-secondary)] uppercase">
                      Права:
                    </p>
                    {role.permissions.map((p) => (
                      <div key={p.label} className="flex items-center gap-1.5 text-xs">
                        {p.allowed ? (
                          <FiCheck className="size-3 text-[var(--color-success)]" />
                        ) : (
                          <FiX className="size-3 text-[var(--color-text-secondary)]" />
                        )}
                        <span
                          className={
                            p.allowed ? '' : 'text-[var(--color-text-secondary)] line-through'
                          }
                        >
                          {p.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="border-t border-[var(--color-border)]" />
          <div>
            <h3 className="mb-3 text-sm font-semibold">Профиль администратора (полный доступ)</h3>
            <div className="max-w-lg overflow-hidden rounded-[var(--radius-lg)] border bg-[var(--color-surface)]">
              <div className="flex items-center gap-4 bg-[var(--color-primary-soft)] p-4">
                <Avatar name="Павел Седов" size="lg" />
                <div>
                  <p className="text-base font-semibold">Павел Седов</p>
                  <p className="text-sm text-[var(--color-text-secondary)]">sedoffwork@mail.ru</p>
                  <Badge size="sm" tone="primary">
                    Администратор
                  </Badge>
                </div>
              </div>
              <div className="space-y-3 p-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-[var(--color-text-secondary)]">Телефон</p>
                    <p className="font-medium">+7 (999) 123-45-67</p>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--color-text-secondary)]">Последний вход</p>
                    <p className="font-medium">Сегодня, 09:15</p>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--color-text-secondary)]">Заказов назначено</p>
                    <p className="font-medium">47</p>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--color-text-secondary)]">В системе с</p>
                    <p className="font-medium">15.07.2026</p>
                  </div>
                </div>
                <div className="flex gap-2 border-t pt-2">
                  <Button size="sm" variant="outline">
                    ✏️ Редактировать
                  </Button>
                  <Button size="sm" variant="outline">
                    🔒 Сменить пароль
                  </Button>
                </div>
              </div>
            </div>
          </div>
          <div className="border-t border-[var(--color-border)]" />
          <div>
            <h3 className="mb-3 text-sm font-semibold">Профиль оператора (управление заказами)</h3>
            <div className="max-w-lg overflow-hidden rounded-[var(--radius-lg)] border bg-[var(--color-surface)]">
              <div className="flex items-center gap-4 bg-[var(--color-warning-soft)] p-4">
                <Avatar name="Иван Петров" size="lg" />
                <div>
                  <p className="text-base font-semibold">Иван Петров</p>
                  <p className="text-sm text-[var(--color-text-secondary)]">ivan@mail.ru</p>
                  <Badge size="sm" tone="warning">
                    Оператор
                  </Badge>
                </div>
              </div>
              <div className="space-y-3 p-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-[var(--color-text-secondary)]">Телефон</p>
                    <p className="font-medium">+7 (999) 555-44-33</p>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--color-text-secondary)]">Последний вход</p>
                    <p className="font-medium">Вчера, 18:30</p>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--color-text-secondary)]">Активных заказов</p>
                    <p className="font-medium">5</p>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--color-text-secondary)]">Выполнено за месяц</p>
                    <p className="font-medium">32</p>
                  </div>
                </div>
                <div className="flex gap-2 border-t pt-2">
                  <Button size="sm" variant="outline">
                    ✏️ Редактировать
                  </Button>
                  <Button size="sm" variant="outline">
                    📋 Мои заказы
                  </Button>
                </div>
              </div>
            </div>
          </div>
          <div className="border-t border-[var(--color-border)]" />
          <div>
            <h3 className="mb-3 text-sm font-semibold">
              Профиль водителя (просмотр заявок и машины)
            </h3>
            <div className="max-w-lg overflow-hidden rounded-[var(--radius-lg)] border bg-[var(--color-surface)]">
              <div className="flex items-center gap-4 bg-[var(--color-success-soft)] p-4">
                <Avatar name="Сергей Кузнецов" size="lg" />
                <div>
                  <p className="text-base font-semibold">Сергей Кузнецов</p>
                  <p className="text-sm text-[var(--color-text-secondary)]">sergey@mail.ru</p>
                  <Badge size="sm" tone="success">
                    Водитель
                  </Badge>
                </div>
              </div>
              <div className="space-y-3 p-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-[var(--color-text-secondary)]">Телефон</p>
                    <p className="font-medium">+7 (999) 777-88-99</p>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--color-text-secondary)]">Последний вход</p>
                    <p className="font-medium">Сегодня, 07:00</p>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--color-text-secondary)]">Текущая машина</p>
                    <p className="font-medium">Lada Vesta Cross</p>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--color-text-secondary)]">Заявок сегодня</p>
                    <p className="font-medium">3</p>
                  </div>
                </div>
                <div className="flex gap-2 border-t pt-2">
                  <Button size="sm" variant="outline">
                    📋 Мои заявки
                  </Button>
                  <Button size="sm" variant="outline">
                    🚗 Моя машина
                  </Button>
                </div>
              </div>
            </div>
          </div>
          <div className="border-t border-[var(--color-border)]" />
          <div>
            <h3 className="mb-3 text-sm font-semibold">
              Таблица пользователей (вид администратора)
            </h3>
            <div className="overflow-x-auto rounded-[var(--radius-md)] border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Пользователь</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Роль</TableHead>
                    <TableHead>Последний вход</TableHead>
                    <TableHead className="w-[80px]">Статус</TableHead>
                    <TableHead className="w-[40px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.email}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar name={u.name} size="sm" />
                          <div>
                            <p className="text-xs font-semibold">{u.name}</p>
                            <p className="text-[10px] text-[var(--color-text-secondary)]">
                              {u.phone}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="text-xs">{u.email}</p>
                      </TableCell>
                      <TableCell>
                        <Badge size="sm" tone={u.roleTone}>
                          {u.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <p className="text-xs">{u.lastLogin}</p>
                      </TableCell>
                      <TableCell>
                        <StatusIndicator tone={u.active ? 'success' : 'neutral'} label="" />
                      </TableCell>
                      <TableCell>
                        <IconButton size="xs" label="Действия" variant="ghost">
                          <FiMoreHorizontal className="size-3" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </KitSectionFull>

      {/* ================================================================ */}
      {/* 15. НАВИГАЦИЯ */}
      {/* ================================================================ */}
      <KitSectionFull
        id="navigation"
        title="Навигация"
        description="Хлебные крошки, табы, пагинация, фильтр-чипсы."
      >
        <div className="space-y-4">
          <div>
            <h3 className="mb-1 text-sm font-semibold">Хлебные крошки</h3>
            <Breadcrumbs items={[{ label: 'Pilot+', href: '/' }, { label: 'Транспорт' }]} />
          </div>
          <div>
            <h3 className="mb-1 text-sm font-semibold">Табы</h3>
            <Tabs
              value={tab}
              onChange={setTab}
              items={[
                { value: 'overview', label: 'Обзор' },
                { value: 'events', label: 'События', badge: 3 },
                { value: 'service', label: 'ТО' },
              ]}
            />
          </div>
          <div>
            <h3 className="mb-1 text-sm font-semibold">Пагинация</h3>
            <Pagination page={page} totalPages={4} onChange={setPage} />
          </div>
          <div>
            <h3 className="mb-1 text-sm font-semibold">Фильтр-чипсы</h3>
            <div className="flex flex-wrap gap-1.5">
              <FilterChip selected={filt} onClick={() => setFilt(!filt)}>
                Активные
              </FilterChip>
              <FilterChip selected={false} onClick={() => {}}>
                Тревоги
              </FilterChip>
              <FilterChip selected={false} onClick={() => {}}>
                ТО
              </FilterChip>
            </div>
          </div>
        </div>
      </KitSectionFull>

      {/* ================================================================ */}
      {/* 16. ОБРАТНАЯ СВЯЗЬ */}
      {/* ================================================================ */}
      <KitSection
        id="feedback"
        title="Обратная связь"
        description="Сообщения, состояния загрузки, ошибки и уведомления."
      >
        <ExampleCard title="Сообщения (Alert)">
          <div className="grid gap-3">
            <Alert title="Информация" description="Телеметрия обновлена." />
            <Alert tone="success" title="Готово" description="Настройки сохранены." />
            <Alert tone="warning" title="Внимание" description="Сигнал нестабилен." />
            <Alert tone="danger" title="Ошибка" description="Нет связи с устройством." />
          </div>
        </ExampleCard>
        <ExampleCard title="Состояния данных">
          <div className="grid gap-3">
            <div className="flex min-h-11 items-center gap-3">
              <Spinner /> Загрузка транспорта
            </div>
            <Skeleton className="h-11" />
            <EmptyState title="Ничего не найдено" description="Измените условия поиска." />
            <ErrorState title="Данные недоступны" description="Повторите попытку позже." />
            <Progress value={68} label="Загрузка маршрута" />
            <Alert
              tone="success"
              title="Маршрут сохранён"
              description="Данные поездки добавлены в историю."
            />
          </div>
        </ExampleCard>
        <div className="lg:col-span-2">
          <Guidance
            use="для понятного результата операции."
            avoid="цвет как единственный способ сообщить статус."
          />
        </div>
      </KitSection>

      {/* ================================================================ */}
      {/* 17. ТИПОГРАФИКА */}
      {/* ================================================================ */}
      <KitSectionFull
        id="typography"
        title="Типографика"
        description="Шрифт Inter. Иерархия заголовков и текста с размерами, жирностью и высотой строки."
      >
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <h3 className="mb-4 text-lg font-semibold">Заголовки</h3>
            <div className="space-y-4">
              <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] p-4">
                <h1 className="text-[30px] leading-tight font-bold">
                  H1 · 30px · Bold · line-height: 1.25
                </h1>
                <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                  Заголовок страницы, hero-секции
                </p>
              </div>
              <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] p-4">
                <h2 className="text-2xl leading-tight font-bold">
                  H2 · 24px · Bold · line-height: 1.25
                </h2>
                <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                  Заголовок секции, карточки
                </p>
              </div>
              <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] p-4">
                <h3 className="text-xl leading-snug font-semibold">
                  H3 · 20px · Semibold · line-height: 1.35
                </h3>
                <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                  Подзаголовок, заголовок модалки
                </p>
              </div>
              <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] p-4">
                <h4 className="text-lg leading-snug font-semibold">
                  H4 · 18px · Semibold · line-height: 1.35
                </h4>
                <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                  Заголовок блока, карточки метрики
                </p>
              </div>
            </div>
          </div>
          <div>
            <h3 className="mb-4 text-lg font-semibold">Текст</h3>
            <div className="space-y-4">
              <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] p-4">
                <p className="text-base leading-relaxed">
                  Body · 16px · Regular · line-height: 1.6
                </p>
                <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                  Основной текст интерфейса, описания
                </p>
              </div>
              <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] p-4">
                <p className="text-sm leading-relaxed text-[var(--color-text-secondary)]">
                  Caption · 14px · Regular · line-height: 1.5
                </p>
                <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                  Подписи, мета-информация
                </p>
              </div>
              <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] p-4">
                <p className="text-xs leading-normal text-[var(--color-text-secondary)]">
                  Fine print · 12px · Regular · line-height: 1.4
                </p>
                <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                  Юридическая информация, мелкие метки
                </p>
              </div>
              <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] p-4">
                <p className="text-sm font-medium">Label · 14px · Medium</p>
                <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                  Подписи полей, заголовки фильтров
                </p>
              </div>
              <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] p-4">
                <p className="text-sm font-semibold">Label Semibold · 14px · Semibold</p>
                <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                  Активные элементы, выделенные значения
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-6">
          <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
            <h3 className="mb-2 font-semibold">Системный стек шрифтов</h3>
            <p className="text-sm text-[var(--color-text-secondary)]">
              Inter, -apple-system, BlinkMacSystemFont, &apos;Segoe UI&apos;, Roboto,
              &apos;Helvetica Neue&apos;, Arial, sans-serif
            </p>
            <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
              Основной шрифт: <strong>Inter</strong>. Загружается через next/font/google с
              подмножествами latin и cyrillic.
            </p>
          </div>
        </div>
      </KitSectionFull>

      {/* ================================================================ */}
      {/* 18. ТЕНИ И РАДИУСЫ */}
      {/* ================================================================ */}
      <KitSection
        id="elevation"
        title="Тени и радиусы"
        description="Визуальная иерархия через elevation. Радиусы скругления стандартизированы."
      >
        <ExampleCard title="Тени">
          <div className="grid gap-3">
            {[
              ['Низкая (карточка)', 'shadow-sm'],
              ['Средняя (дропдаун)', 'shadow-md'],
              ['Высокая (модалка)', 'shadow-lg'],
            ].map(([l, s]) => (
              <div
                key={l}
                className={`rounded-[var(--radius-md)] bg-[var(--color-surface)] px-4 py-4 text-sm font-medium ${s}`}
              >
                {l}
              </div>
            ))}
          </div>
        </ExampleCard>
        <ExampleCard title="Радиусы">
          <div className="grid grid-cols-2 gap-3 text-center text-sm">
            {[
              ['SM', '6px', '--radius-sm'],
              ['MD', '8px', '--radius-md'],
              ['LG', '12px', '--radius-lg'],
              ['XL', '16px', '--radius-xl'],
            ].map(([l, s, t]) => (
              <div
                key={l}
                className="border-2 border-[var(--color-primary)] px-4 py-5 font-semibold text-[var(--color-primary)]"
                style={{ borderRadius: `var(${t})` }}
              >
                {l} · {s}
              </div>
            ))}
          </div>
        </ExampleCard>
      </KitSection>

      {/* ================================================================ */}
      {/* 19. ВСПЛЫВАЮЩИЕ СЛОИ */}
      {/* ================================================================ */}
      <KitSection
        id="overlays"
        title="Всплывающие слои"
        description="Временные слои удерживают фокус, блокируют фон и возвращают управление инициатору."
      >
        <ExampleCard title="Диалоги и панель">
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => setModalOpen(true)}>Открыть окно</Button>
            <Button variant="outline" onClick={() => setSheetOpen(true)}>
              Открыть нижнюю панель
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setFirstDialogOpen(true);
                setSecondDialogOpen(true);
              }}
            >
              Открыть два окна
            </Button>
          </div>
        </ExampleCard>
        <ExampleCard title="Подсказка и меню">
          <div className="flex flex-wrap gap-3">
            <Tooltip content="Дополнительная информация">
              <Button variant="ghost">Подсказка</Button>
            </Tooltip>
            <DropdownMenu label="Действия">
              <Button variant="ghost" className="w-full justify-start">
                Открыть карточку
              </Button>
            </DropdownMenu>
            <Popover label="Открыть сведения">
              <p className="p-3">Последний сигнал получен сейчас.</p>
            </Popover>
            <Button variant="danger" onClick={() => setConfirmationOpen(true)}>
              Подтвердить удаление
            </Button>
            <Button variant="outline" onClick={() => setDrawerOpen(true)}>
              Открыть боковую панель
            </Button>
          </div>
        </ExampleCard>
        <div className="lg:col-span-2">
          <Guidance
            use="для короткой сфокусированной задачи."
            avoid="длинные сценарии, обязательную навигацию."
          />
        </div>
        <Modal
          open={modalOpen}
          onOpenChange={setModalOpen}
          title="Пример окна"
          description={`Версия демонстрации: ${modalRevision + 1}`}
          data-testid="modal-example"
          footer={
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="secondary" onClick={() => setModalRevision((v) => v + 1)}>
                Перерисовать пример
              </Button>
              <Button onClick={() => setModalOpen(false)}>Закрыть</Button>
            </div>
          }
        >
          <p>Диалог для короткой задачи, требующей полного внимания.</p>
        </Modal>
        <Modal
          open={firstDialogOpen}
          onOpenChange={setFirstDialogOpen}
          title="Первое окно"
          footer={<Button onClick={() => setFirstDialogOpen(false)}>Закрыть</Button>}
        >
          <p>Первый независимый слой.</p>
        </Modal>
        <Modal
          open={secondDialogOpen}
          onOpenChange={setSecondDialogOpen}
          title="Второе окно"
          footer={<Button onClick={() => setSecondDialogOpen(false)}>Закрыть</Button>}
        >
          <p>Второй независимый слой.</p>
        </Modal>
        <BottomSheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          title="Пример нижней панели"
          description="Управляемое положение панели"
          snap={sheetSnap}
          onSnapChange={setSheetSnap}
          footer={<Button onClick={() => setSheetOpen(false)}>Закрыть</Button>}
        >
          <p>Подходит для дополнительных действий на узком экране.</p>
        </BottomSheet>
        <ConfirmationDialog
          open={confirmationOpen}
          onOpenChange={setConfirmationOpen}
          title="Удалить автомобиль?"
          description="Демонстрация опасного необратимого действия."
          onConfirm={() => setConfirmationOpen(false)}
        >
          <p>Автомобиль будет удалён из демонстрационного списка.</p>
        </ConfirmationDialog>
        <Drawer
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          title="Параметры автомобиля"
          description="Боковая панель сохраняет контекст рабочей области."
          footer={<Button onClick={() => setDrawerOpen(false)}>Закрыть панель</Button>}
        >
          <p>Настройки оповещений и отображения автомобиля.</p>
        </Drawer>
      </KitSection>

      {/* ================================================================ */}
      {/* 20. КОМПОНЕНТЫ АВТОПАРКА */}
      {/* ================================================================ */}
      <KitSectionFull
        id="fleet"
        title="Компоненты автопарка"
        description="Специализированные компоненты для отображения телематических данных."
      >
        <div className="space-y-8">
          <div>
            <h3 className="mb-2 text-sm font-semibold">SpeedIndicator</h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] p-4 text-center">
                <SpeedIndicator speedKph={0} state="idle" />
                <p className="mt-2 text-xs text-[var(--color-text-secondary)]">Стоянка</p>
              </div>
              <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] p-4 text-center">
                <SpeedIndicator speedKph={62} state="moving" />
                <p className="mt-2 text-xs text-[var(--color-text-secondary)]">В движении</p>
              </div>
              <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] p-4 text-center">
                <SpeedIndicator speedKph={94} state="moving" />
                <p className="mt-2 text-xs text-[var(--color-text-secondary)]">Скоростной режим</p>
              </div>
              <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] p-4 text-center">
                <SpeedIndicator speedKph={0} state="offline" />
                <p className="mt-2 text-xs text-[var(--color-text-secondary)]">Нет данных</p>
              </div>
            </div>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold">ConnectionStatus</h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] p-4">
                <ConnectionStatus state="online" lastSeenLabel="сигнал получен сейчас" />
              </div>
              <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] p-4">
                <ConnectionStatus state="offline" lastSeenLabel="последний сигнал 2 часа назад" />
              </div>
              <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] p-4">
                <ConnectionStatus state="offline" lastSeenLabel="сигнал нестабилен" />
              </div>
            </div>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold">События</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              <EventCard
                title="Въезд в геозону"
                vehicleName="Haval Jolion"
                timeLabel="10:42"
                tone="info"
              />
              <EventCard
                title="Превышение скорости (105 км/ч)"
                vehicleName="А 123 МР 77"
                timeLabel="10:45"
                tone="danger"
              />
              <EventCard
                title="Плановое ТО через 800 км"
                vehicleName="Toyota Camry"
                timeLabel="09:30"
                tone="warning"
              />
              <EventCard
                title="Замена масла выполнена"
                vehicleName="Lada Vesta"
                timeLabel="08:15"
                tone="success"
              />
            </div>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold">VehicleMarker</h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] p-4">
                <VehicleMarker
                  name="Haval Jolion"
                  plate="А 123 МР 77"
                  speedKph={62}
                  status="moving"
                />
              </div>
              <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] p-4">
                <VehicleMarker name="Toyota Camry" plate="Е 789 НО 77" speedKph={0} status="idle" />
              </div>
              <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] p-4">
                <VehicleMarker
                  name="ГАЗель Next"
                  plate="М 333 АХ 750"
                  speedKph={0}
                  status="alarm"
                />
              </div>
            </div>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold">Положение и статус</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex items-start gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] p-4">
                <FiMapPin className="mt-1 size-5 text-[var(--color-primary)]" />
                <div>
                  <p className="font-semibold">Ленинградский проспект, 32</p>
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    Москва · зажигание включено
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] p-4">
                <FiMapPin className="mt-1 size-5 text-[var(--color-danger)]" />
                <div>
                  <p className="font-semibold">МКАД, 41-й км</p>
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    Превышение скорости · 94 км/ч
                  </p>
                </div>
              </div>
            </div>
          </div>
          <Guidance
            use="для повторяемых транспортных сущностей и оперативных статусов."
            avoid="для данных без телематического контекста."
          />
        </div>
      </KitSectionFull>
    </div>
  );
}
