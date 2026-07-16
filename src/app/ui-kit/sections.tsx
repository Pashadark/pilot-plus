'use client';

import { useState, type ReactNode } from 'react';
import { FiBell, FiMapPin, FiMoreHorizontal, FiTruck } from 'react-icons/fi';

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
  DropdownMenu,
  EmptyState,
  ErrorState,
  FilterChip,
  IconButton,
  Input,
  ListItem,
  Modal,
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
  Toast,
  VehiclePlate,
  Pagination,
  SearchInput,
  SegmentedControl,
  Select,
  Skeleton,
  Spinner,
  Switch,
  Tabs,
  Tooltip,
  type ComponentSize,
} from '@/shared/ui';

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
    <section
      id={id}
      data-testid={`ui-kit-${id}`}
      className="scroll-mt-24 border-t border-[var(--color-border)] py-10"
    >
      <h2 className="text-2xl font-bold text-[var(--color-text)]">{title}</h2>
      <p className="mt-2 max-w-3xl text-[var(--color-text-secondary)]">{description}</p>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">{children}</div>
    </section>
  );
}

function ExampleCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="min-w-0">
      <CardHeader>
        <h3 className="font-semibold">{title}</h3>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function Guidance({ use, avoid }: { use: string; avoid: string }) {
  return (
    <div className="grid gap-2 text-sm text-[var(--color-text-secondary)]">
      <p>
        <strong className="text-[var(--color-text)]">Когда использовать:</strong> {use}
      </p>
      <p>
        <strong className="text-[var(--color-text)]">Не использовать:</strong> {avoid}
      </p>
    </div>
  );
}

const sizes: readonly ComponentSize[] = ['xs', 'sm', 'md', 'lg'];

export function UiKitSections() {
  const [segment, setSegment] = useState<'all' | 'online'>('all');
  const [tab, setTab] = useState<'overview' | 'events' | 'service'>('overview');
  const [page, setPage] = useState(1);
  const [filterSelected, setFilterSelected] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalRevision, setModalRevision] = useState(0);
  const [firstDialogOpen, setFirstDialogOpen] = useState(false);
  const [secondDialogOpen, setSecondDialogOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetSnap, setSheetSnap] = useState<'collapsed' | 'intermediate' | 'expanded'>(
    'intermediate',
  );

  return (
    <div>
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
            ].map(([label, color]) => (
              <div key={label} className="grid gap-2 text-sm">
                <span className={`h-11 rounded-[var(--radius-md)] border ${color}`} />
                <span>{label}</span>
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

      <KitSection
        id="actions"
        title="Действия"
        description="Кнопки передают приоритет действия, состояние выполнения и доступную область касания."
      >
        <ExampleCard title="Варианты и состояния">
          <div className="flex flex-wrap gap-3">
            <Button data-testid="button-primary">Основное</Button>
            <Button variant="secondary">Вторичное</Button>
            <Button variant="soft">Мягкое</Button>
            <Button variant="outline">Контурное</Button>
            <Button variant="ghost">Нейтральное</Button>
            <Button variant="danger">Опасное</Button>
            <Button data-testid="button-loading" loading>
              Сохранение
            </Button>
            <Button data-testid="button-disabled" disabled>
              Недоступно
            </Button>
          </div>
        </ExampleCard>
        <ExampleCard title="Размеры">
          <div className="flex flex-wrap items-center gap-3">
            {sizes.map((size) => (
              <Button key={size} size={size} data-testid={`button-size-${size}`}>
                {size.toUpperCase()}
              </Button>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {sizes.map((size) => (
              <IconButton
                key={size}
                size={size}
                label={`Уведомления, размер ${size}`}
                data-testid={`icon-button-size-${size}`}
              >
                <FiBell aria-hidden="true" />
              </IconButton>
            ))}
          </div>
        </ExampleCard>
        <div className="lg:col-span-2">
          <Guidance
            use="для явных действий с понятным приоритетом и доступным состоянием выполнения."
            avoid="кнопки для перехода между страницами и несколько одинаково главных действий рядом."
          />
        </div>
      </KitSection>

      <KitSection
        id="forms"
        title="Формы"
        description="Поля всегда имеют видимую подпись, подсказку и локальное сообщение об ошибке."
      >
        <ExampleCard title="Поля">
          <div className="grid gap-4">
            <Input
              label="Название автомобиля"
              hint="Например, фургон 12"
              error="Укажите название автомобиля"
              defaultValue=""
              required
            />
            <Select label="Группа" hint="Определяет область мониторинга" defaultValue="city">
              <option value="city">Городской парк</option>
              <option value="delivery">Доставка</option>
            </Select>
            <SearchInput aria-label="Поиск компонентов" placeholder="Поиск компонентов" />
            <div data-testid="showcase-textarea">
              <Textarea label="Комментарий" hint="Необязательное пояснение" />
            </div>
          </div>
        </ExampleCard>
        <ExampleCard title="Выбор">
          <div className="grid gap-4">
            <label className="flex min-h-11 items-center gap-3">
              <Checkbox defaultChecked aria-label="Показывать тревоги" /> Показывать тревоги
            </label>
            <label className="flex min-h-11 items-center gap-3">
              <Switch aria-label="Только онлайн" /> Только онлайн
            </label>
            <label data-testid="showcase-radio" className="flex min-h-11 items-center gap-3">
              <Radio name="period" defaultChecked /> Сегодня
            </label>
            <SegmentedControl
              aria-label="Состояние транспорта"
              value={segment}
              onChange={setSegment}
              options={[
                { value: 'all', label: 'Все' },
                { value: 'online', label: 'Онлайн' },
              ]}
            />
            <Guidance
              use="для ввода и явного выбора данных."
              avoid="placeholder вместо подписи или ошибку без связи с полем."
            />
          </div>
        </ExampleCard>
      </KitSection>

      <KitSection
        id="data-display"
        title="Отображение данных"
        description="Карточки и метки группируют данные, сохраняя читаемую плотность диспетчерского интерфейса."
      >
        <ExampleCard title="Метки">
          <div className="flex flex-wrap gap-2">
            <Badge>Нейтрально</Badge>
            <Badge tone="primary">Основное</Badge>
            <Badge tone="success">Онлайн</Badge>
            <Badge tone="warning">Внимание</Badge>
            <Badge tone="danger">Тревога</Badge>
          </div>
        </ExampleCard>
        <ExampleCard title="Карточка показателя">
          <p className="text-sm text-[var(--color-text-secondary)]">Автомобили на линии</p>
          <p className="mt-2 text-3xl font-bold">184</p>
          <Guidance
            use="для компактной сводки связанных значений."
            avoid="как замену структуре для больших наборов данных."
          />
        </ExampleCard>
        <ExampleCard title="Исполняемые контракты данных">
          <div className="grid gap-3">
            <div data-testid="showcase-stat-card">
              <StatCard label="На линии" value="184" />
            </div>
            <div data-testid="showcase-status-indicator">
              <StatusIndicator label="На связи" tone="success" />
            </div>
            <div data-testid="showcase-vehicle-plate">
              <VehiclePlate>А 123 МР 77</VehiclePlate>
            </div>
            <ul>
              <ListItem
                data-testid="showcase-list-item"
                leading={
                  <span data-testid="showcase-avatar">
                    <Avatar name="Павел Седов" />
                  </span>
                }
                title="Павел Седов"
                description="Администратор"
              />
            </ul>
            <div data-testid="showcase-table">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Автомобиль</TableHead>
                    <TableHead>Статус</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell>Haval Jolion</TableCell>
                    <TableCell>На связи</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>
        </ExampleCard>
      </KitSection>

      <KitSection
        id="navigation"
        title="Навигация"
        description="Навигация отражает положение пользователя и поддерживает предсказуемую клавиатурную модель."
      >
        <ExampleCard title="Путь и вкладки">
          <Breadcrumbs items={[{ label: 'Pilot+', href: '/' }, { label: 'Транспорт' }]} />
          <div className="mt-4">
            <Tabs
              aria-label="Разделы автомобиля"
              value={tab}
              onChange={setTab}
              items={[
                { value: 'overview', label: 'Обзор' },
                { value: 'events', label: 'События', badge: 3 },
                { value: 'service', label: 'ТО' },
              ]}
            />
          </div>
        </ExampleCard>
        <ExampleCard title="Фильтры и страницы">
          <FilterChip
            selected={filterSelected}
            onClick={() => setFilterSelected((value) => !value)}
          >
            Только активные
          </FilterChip>
          <div className="mt-4">
            <Pagination page={page} totalPages={4} onChange={setPage} />
          </div>
        </ExampleCard>
        <div className="lg:col-span-2">
          <Guidance
            use="для переходов, смены раздела и отражения текущего положения пользователя."
            avoid="навигационные элементы для запуска операций или сохранения данных."
          />
        </div>
      </KitSection>

      <KitSection
        id="feedback"
        title="Обратная связь"
        description="Обратная связь сообщает о результате, ожидании и невозможности показать данные."
      >
        <ExampleCard title="Сообщения">
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
            <div data-testid="showcase-progress">
              <Progress value={68} label="Загрузка маршрута" />
            </div>
            <div data-testid="showcase-toast">
              <Toast title="Маршрут сохранён" />
            </div>
          </div>
        </ExampleCard>
        <div className="lg:col-span-2">
          <Guidance
            use="для понятного результата операции, ожидания, пустого состояния или ошибки."
            avoid="цвет как единственный способ сообщить статус и сообщения без следующего шага."
          />
        </div>
      </KitSection>

      <KitSection
        id="overlays"
        title="Всплывающие слои"
        description="Временные слои удерживают фокус, блокируют фон и возвращают управление инициатору."
      >
        <ExampleCard title="Диалоги и панель">
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => setModalOpen(true)}>Открыть окно</Button>
            <Button
              variant="secondary"
              onClick={() => {
                setFirstDialogOpen(true);
                setSecondDialogOpen(true);
              }}
            >
              Открыть два окна
            </Button>
            <Button variant="outline" onClick={() => setSheetOpen(true)}>
              Открыть нижнюю панель
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
            <div data-testid="showcase-popover">
              <Popover label="Открыть сведения">
                <p className="p-3">Последний сигнал получен сейчас.</p>
              </Popover>
            </div>
            <span data-testid="showcase-confirmation-dialog">
              <Button variant="danger" onClick={() => setModalOpen(true)}>
                Подтвердить удаление
              </Button>
            </span>
            <span data-testid="showcase-drawer">
              <Button variant="outline" onClick={() => setFirstDialogOpen(true)}>
                Открыть боковую панель
              </Button>
            </span>
          </div>
        </ExampleCard>
        <div className="lg:col-span-2">
          <Guidance
            use="для короткой сфокусированной задачи или дополнительных действий поверх контекста."
            avoid="длинные сценарии, обязательную навигацию и контент, который должен оставаться на странице."
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
              <Button variant="secondary" onClick={() => setModalRevision((value) => value + 1)}>
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
      </KitSection>

      <KitSection
        id="fleet-components"
        title="Компоненты автопарка"
        description="Составные примеры показывают единый язык телематики без отдельной бизнес-логики."
      >
        <div className="grid gap-3" data-testid="showcase-vehicle-marker">
          <StatusIndicator label="Маркер: в движении" tone="success" />
          <span data-testid="showcase-speed-indicator">62 км/ч</span>
          <span data-testid="showcase-connection-status">Сигнал получен сейчас</span>
          <article data-testid="showcase-event-item">Въезд в геозону · 10:42</article>
        </div>
        <ExampleCard title="Автомобиль">
          <div className="flex items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-[var(--radius-md)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
              <FiTruck aria-hidden="true" className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <strong>А 123 МР 77</strong>
                <Badge tone="success">Онлайн</Badge>
              </div>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                62 км/ч · сигнал получен сейчас
              </p>
            </div>
            <IconButton label="Действия автомобиля" variant="ghost">
              <FiMoreHorizontal aria-hidden="true" />
            </IconButton>
          </div>
        </ExampleCard>
        <ExampleCard title="Положение и статус">
          <div className="flex items-start gap-3">
            <FiMapPin aria-hidden="true" className="mt-1 size-5 text-[var(--color-primary)]" />
            <div>
              <strong>Ленинградский проспект</strong>
              <p className="text-sm text-[var(--color-text-secondary)]">
                Москва · зажигание включено
              </p>
            </div>
          </div>
          <div className="mt-4">
            <Guidance
              use="для повторяемых транспортных сущностей и оперативных статусов."
              avoid="для данных без телематического контекста."
            />
          </div>
        </ExampleCard>
      </KitSection>
    </div>
  );
}
