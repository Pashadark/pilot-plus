import 'server-only';

import type { Prisma } from '@/database/generated/prisma';
import { prisma } from '@/database/prisma/client';
import { requireAdmin } from '@/modules/auth/dal';

import {
  normalizeDeviceCommand,
  normalizeFuelRecord,
  normalizeMaintenanceRecord,
  normalizeManualVehicleEvent,
  normalizeTrip,
  normalizeVehicleEvent,
  normalizeVehiclePosition,
  normalizeWashRecord,
  type TimelineVehicle,
} from '../normalizers';
import type { TimelineCategory, TimelineEventDto, TimelineSeverity } from '../types';

const SOURCE_BATCH_SIZE = 50;
const DEFAULT_PAGE_SIZE = 30;
const MAX_PAGE_SIZE = 100;
const DEFAULT_PERIOD_DAYS = 30;
const MAX_PERIOD_DAYS = 90;
const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

export interface TimelineFilters {
  search?: string;
  vehicleId?: string;
  categories?: TimelineCategory[];
  severities?: TimelineSeverity[];
  read?: 'all' | 'read' | 'unread';
  from?: string;
  to?: string;
  before?: string;
  beforeKey?: string;
  limit?: number;
}

type AuthenticatedTimelineContext = {
  userId: string;
  companyId: string;
  companyRole: 'ADMIN';
};

interface SourceRepository {
  findMany(args: unknown): Promise<unknown[]>;
  count(args: unknown): Promise<number>;
}

export interface EventTimelineRepository {
  vehiclePosition: SourceRepository;
  trip: SourceRepository;
  vehicleEvent: SourceRepository;
  fuelRecord: SourceRepository;
  maintenanceRecord: SourceRepository;
  washRecord: SourceRepository;
  deviceCommand: SourceRepository;
  manualVehicleEvent: SourceRepository;
  eventReadReceipt: {
    findMany(args: unknown): Promise<unknown[]>;
  };
  vehicle: {
    findMany(args: unknown): Promise<unknown[]>;
  };
}

type TimelineResult = {
  events: TimelineEventDto[];
  nextCursor: { before: string; beforeKey: string } | null;
  stats: { total: number; danger: number; unread: number; vehicles: number };
  vehicles: Array<{ id: string; label: string }>;
};

type NormalizedFilters = {
  search: string | null;
  vehicleId: string | null;
  categories: Set<TimelineCategory> | null;
  severities: Set<TimelineSeverity> | null;
  read: 'all' | 'read' | 'unread';
  from: Date;
  to: Date;
  cursor: { before: Date; beforeKey: string } | null;
  limit: number;
};

type QueryWhere = Record<string, unknown>;

type SourceSpec = {
  name: string;
  repository: SourceRepository;
  where: QueryWhere;
  select: Record<string, unknown>;
  orderBy: Array<Record<string, 'asc' | 'desc'>>;
  distinct?: string[];
  fixedCategory?: TimelineCategory;
  fixedSeverity?: TimelineSeverity;
  countable: boolean;
  normalize(record: unknown): TimelineEventDto;
};

type SourceState = {
  spec: SourceSpec;
  buffer: TimelineEventDto[];
  exhausted: boolean;
  cursorId: string | null;
};

const vehicleSelect = {
  id: true,
  internalNumber: true,
  model: true,
  registrationNumber: true,
  images: {
    where: { isPrimary: true },
    select: { localPath: true },
    orderBy: { position: 'asc' as const },
    take: 1,
  },
};

const positionSelect = {
  id: true,
  latitude: true,
  longitude: true,
  speedKph: true,
  heading: true,
  odometerKm: true,
  fuelLevelPercent: true,
  recordedAt: true,
  vehicle: { select: vehicleSelect },
};

const tripSelect = {
  id: true,
  startedAt: true,
  endedAt: true,
  distanceKm: true,
  averageSpeedKph: true,
  vehicle: { select: vehicleSelect },
};

const vehicleEventSelect = {
  id: true,
  title: true,
  description: true,
  location: true,
  severity: true,
  recordedAt: true,
  vehicle: { select: vehicleSelect },
};

const fuelRecordSelect = {
  id: true,
  type: true,
  volumeLiters: true,
  levelPercent: true,
  recordedAt: true,
  vehicle: { select: vehicleSelect },
};

const maintenanceRecordSelect = {
  id: true,
  title: true,
  description: true,
  status: true,
  scheduledAt: true,
  completedAt: true,
  odometerKm: true,
  vehicle: { select: vehicleSelect },
};

const washRecordSelect = {
  id: true,
  status: true,
  scheduledAt: true,
  completedAt: true,
  vehicle: { select: vehicleSelect },
};

const deviceCommandSelect = {
  id: true,
  deviceId: true,
  type: true,
  status: true,
  createdAt: true,
  sentAt: true,
  completedAt: true,
  device: {
    select: {
      vehicle: { select: vehicleSelect },
    },
  },
};

const manualVehicleEventSelect = {
  id: true,
  kind: true,
  severity: true,
  title: true,
  description: true,
  location: true,
  latitude: true,
  longitude: true,
  recordedAt: true,
  vehicle: { select: vehicleSelect },
};

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object') {
    throw new TypeError('Timeline source returned an invalid record.');
  }

  return value as Record<string, unknown>;
}

function mapVehicle(value: unknown): TimelineVehicle {
  const raw = asRecord(value);
  const images = Array.isArray(raw.images) ? raw.images : [];
  const firstImage = images[0] ? asRecord(images[0]) : null;

  return {
    id: String(raw.id),
    internalNumber: String(raw.internalNumber),
    model: String(raw.model),
    imagePath: firstImage ? String(firstImage.localPath) : null,
  };
}

function withMappedVehicle(record: unknown): Record<string, unknown> {
  const raw = asRecord(record);
  return { ...raw, vehicle: mapVehicle(raw.vehicle) };
}

function withMappedDeviceVehicle(record: unknown): Record<string, unknown> {
  const raw = asRecord(record);
  const device = asRecord(raw.device);
  return { ...raw, vehicle: mapVehicle(device.vehicle) };
}

function parseDate(value: string, field: string): Date {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    throw new TypeError(`Некорректное значение ${field}.`);
  }
  return date;
}

function normalizeFilters(filters: TimelineFilters, now: Date): NormalizedFilters {
  const to = filters.to ? parseDate(filters.to, 'to') : now;
  const from = filters.from
    ? parseDate(filters.from, 'from')
    : new Date(to.getTime() - DEFAULT_PERIOD_DAYS * DAY_IN_MILLISECONDS);

  if (from > to) {
    throw new RangeError('Начало периода должно быть раньше его окончания.');
  }
  if (to.getTime() - from.getTime() > MAX_PERIOD_DAYS * DAY_IN_MILLISECONDS) {
    throw new RangeError('Период истории не может превышать 90 дней.');
  }

  const hasBefore = filters.before !== undefined;
  const hasBeforeKey = filters.beforeKey !== undefined;
  if (hasBefore !== hasBeforeKey) {
    throw new TypeError('Курсор истории требует before и beforeKey.');
  }

  const limit = filters.limit ?? DEFAULT_PAGE_SIZE;
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE_SIZE) {
    throw new RangeError(`limit должен быть целым числом от 1 до ${MAX_PAGE_SIZE}.`);
  }

  const beforeKey = filters.beforeKey?.trim();
  if (hasBeforeKey && !beforeKey) {
    throw new TypeError('beforeKey не может быть пустым.');
  }

  return {
    search: filters.search?.trim().toLocaleLowerCase('ru-RU') || null,
    vehicleId: filters.vehicleId?.trim() || null,
    categories: filters.categories?.length ? new Set(filters.categories) : null,
    severities: filters.severities?.length ? new Set(filters.severities) : null,
    read: filters.read ?? 'all',
    from,
    to,
    cursor:
      filters.before && beforeKey
        ? { before: parseDate(filters.before, 'before'), beforeKey }
        : null,
    limit,
  };
}

function sourceTimeRange(
  filters: NormalizedFilters,
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  const upperBound =
    filters.cursor && filters.cursor.before < filters.to ? filters.cursor.before : filters.to;
  return { ...extra, gte: filters.from, lte: upperBound };
}

function sourceEnabled(
  filters: NormalizedFilters,
  category?: TimelineCategory,
  severity?: TimelineSeverity,
) {
  return (
    (!category || !filters.categories || filters.categories.has(category)) &&
    (!severity || !filters.severities || filters.severities.has(severity))
  );
}

function vehicleScope(context: AuthenticatedTimelineContext, filters: NormalizedFilters) {
  return {
    vehicle: { companyId: context.companyId },
    ...(filters.vehicleId ? { vehicleId: filters.vehicleId } : {}),
  };
}

function directCompanyScope(context: AuthenticatedTimelineContext, filters: NormalizedFilters) {
  return {
    companyId: context.companyId,
    ...(filters.vehicleId ? { vehicleId: filters.vehicleId } : {}),
  };
}

function deviceScope(context: AuthenticatedTimelineContext, filters: NormalizedFilters) {
  return {
    device: {
      companyId: context.companyId,
      vehicleId: filters.vehicleId ?? { not: null },
    },
  };
}

function sourceSearch(search: string | null, fields: string[]) {
  if (!search) return {};

  const vehicleFields = ['internalNumber', 'model', 'registrationNumber'].map((field) => ({
    vehicle: { [field]: { contains: search, mode: 'insensitive' } },
  }));
  const sourceFields = fields.map((field) => ({
    [field]: { contains: search, mode: 'insensitive' },
  }));
  return { OR: [...vehicleFields, ...sourceFields] };
}

function deviceSearch(search: string | null) {
  if (!search) return {};
  return {
    OR: ['internalNumber', 'model', 'registrationNumber'].map((field) => ({
      device: {
        vehicle: { [field]: { contains: search, mode: 'insensitive' } },
      },
    })),
  };
}

function createSourceSpecs(
  repository: EventTimelineRepository,
  context: AuthenticatedTimelineContext,
  filters: NormalizedFilters,
  includeSearch: boolean,
): SourceSpec[] {
  const search = includeSearch ? filters.search : null;
  const specs: SourceSpec[] = [];

  if (sourceEnabled(filters, 'MOVEMENT', 'INFO')) {
    specs.push({
      name: 'vehicle-position',
      repository: repository.vehiclePosition,
      where: {
        ...vehicleScope(context, filters),
        speedKph: { gt: 0 },
        recordedAt: sourceTimeRange(filters),
        ...sourceSearch(search, []),
      },
      select: positionSelect,
      orderBy: [{ recordedAt: 'desc' }, { id: 'asc' }],
      distinct: ['vehicleId'],
      fixedCategory: 'MOVEMENT',
      fixedSeverity: 'INFO',
      countable: false,
      normalize: (record) =>
        normalizeVehiclePosition({
          ...withMappedVehicle(record),
          isMoving: true,
        } as never),
    });
  }

  if (sourceEnabled(filters, 'TRIP', 'INFO')) {
    specs.push({
      name: 'trip-completed',
      repository: repository.trip,
      where: {
        ...vehicleScope(context, filters),
        endedAt: sourceTimeRange(filters, { not: null }),
        ...sourceSearch(search, []),
      },
      select: tripSelect,
      orderBy: [{ endedAt: 'desc' }, { id: 'asc' }],
      fixedCategory: 'TRIP',
      fixedSeverity: 'INFO',
      countable: true,
      normalize: (record) => normalizeTrip(withMappedVehicle(record) as never),
    });
  }

  if (sourceEnabled(filters, 'MOVEMENT', 'INFO')) {
    specs.push({
      name: 'trip-active',
      repository: repository.trip,
      where: {
        ...vehicleScope(context, filters),
        endedAt: null,
        startedAt: sourceTimeRange(filters),
        ...sourceSearch(search, []),
      },
      select: tripSelect,
      orderBy: [{ startedAt: 'desc' }, { id: 'asc' }],
      fixedCategory: 'MOVEMENT',
      fixedSeverity: 'INFO',
      countable: true,
      normalize: (record) => normalizeTrip(withMappedVehicle(record) as never),
    });
  }

  if (sourceEnabled(filters, 'ALERT')) {
    specs.push({
      name: 'vehicle-event',
      repository: repository.vehicleEvent,
      where: {
        ...vehicleScope(context, filters),
        recordedAt: sourceTimeRange(filters),
        ...sourceSearch(search, ['title', 'description', 'location']),
      },
      select: vehicleEventSelect,
      orderBy: [{ recordedAt: 'desc' }, { id: 'asc' }],
      fixedCategory: 'ALERT',
      countable: true,
      normalize: (record) => normalizeVehicleEvent(withMappedVehicle(record) as never),
    });
  }

  if (sourceEnabled(filters, 'FUEL')) {
    specs.push({
      name: 'fuel-record',
      repository: repository.fuelRecord,
      where: {
        ...vehicleScope(context, filters),
        recordedAt: sourceTimeRange(filters),
        ...sourceSearch(search, []),
      },
      select: fuelRecordSelect,
      orderBy: [{ recordedAt: 'desc' }, { id: 'asc' }],
      fixedCategory: 'FUEL',
      countable: true,
      normalize: (record) => normalizeFuelRecord(withMappedVehicle(record) as never),
    });
  }

  if (sourceEnabled(filters, 'MAINTENANCE')) {
    specs.push(
      {
        name: 'maintenance-completed',
        repository: repository.maintenanceRecord,
        where: {
          ...vehicleScope(context, filters),
          completedAt: sourceTimeRange(filters, { not: null }),
          ...sourceSearch(search, ['title', 'description', 'provider', 'notes']),
        },
        select: maintenanceRecordSelect,
        orderBy: [{ completedAt: 'desc' }, { id: 'asc' }],
        fixedCategory: 'MAINTENANCE',
        countable: true,
        normalize: (record) => normalizeMaintenanceRecord(withMappedVehicle(record) as never),
      },
      {
        name: 'maintenance-scheduled',
        repository: repository.maintenanceRecord,
        where: {
          ...vehicleScope(context, filters),
          completedAt: null,
          scheduledAt: sourceTimeRange(filters, { not: null }),
          ...sourceSearch(search, ['title', 'description', 'provider', 'notes']),
        },
        select: maintenanceRecordSelect,
        orderBy: [{ scheduledAt: 'desc' }, { id: 'asc' }],
        fixedCategory: 'MAINTENANCE',
        countable: true,
        normalize: (record) => normalizeMaintenanceRecord(withMappedVehicle(record) as never),
      },
    );
  }

  if (sourceEnabled(filters, 'WASH')) {
    specs.push(
      {
        name: 'wash-completed',
        repository: repository.washRecord,
        where: {
          ...vehicleScope(context, filters),
          completedAt: sourceTimeRange(filters, { not: null }),
          ...sourceSearch(search, ['provider', 'notes']),
        },
        select: washRecordSelect,
        orderBy: [{ completedAt: 'desc' }, { id: 'asc' }],
        fixedCategory: 'WASH',
        fixedSeverity: 'INFO',
        countable: true,
        normalize: (record) => normalizeWashRecord(withMappedVehicle(record) as never),
      },
      {
        name: 'wash-scheduled',
        repository: repository.washRecord,
        where: {
          ...vehicleScope(context, filters),
          completedAt: null,
          scheduledAt: sourceTimeRange(filters),
          ...sourceSearch(search, ['provider', 'notes']),
        },
        select: washRecordSelect,
        orderBy: [{ scheduledAt: 'desc' }, { id: 'asc' }],
        fixedCategory: 'WASH',
        fixedSeverity: 'INFO',
        countable: true,
        normalize: (record) => normalizeWashRecord(withMappedVehicle(record) as never),
      },
    );
  }

  if (
    (!filters.categories ||
      filters.categories.has('DEVICE') ||
      filters.categories.has('FIRMWARE')) &&
    (!filters.severities ||
      filters.severities.has('INFO') ||
      filters.severities.has('WARNING'))
  ) {
    const common = {
      ...deviceScope(context, filters),
      ...deviceSearch(search),
    };
    specs.push(
      {
        name: 'device-command-completed',
        repository: repository.deviceCommand,
        where: {
          ...common,
          completedAt: sourceTimeRange(filters, { not: null }),
        },
        select: deviceCommandSelect,
        orderBy: [{ completedAt: 'desc' }, { id: 'asc' }],
        countable: true,
        normalize: (record) => normalizeDeviceCommand(withMappedDeviceVehicle(record) as never),
      },
      {
        name: 'device-command-sent',
        repository: repository.deviceCommand,
        where: {
          ...common,
          completedAt: null,
          sentAt: sourceTimeRange(filters, { not: null }),
        },
        select: deviceCommandSelect,
        orderBy: [{ sentAt: 'desc' }, { id: 'asc' }],
        countable: true,
        normalize: (record) => normalizeDeviceCommand(withMappedDeviceVehicle(record) as never),
      },
      {
        name: 'device-command-created',
        repository: repository.deviceCommand,
        where: {
          ...common,
          completedAt: null,
          sentAt: null,
          createdAt: sourceTimeRange(filters),
        },
        select: deviceCommandSelect,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        countable: true,
        normalize: (record) => normalizeDeviceCommand(withMappedDeviceVehicle(record) as never),
      },
    );
  }

  if (sourceEnabled(filters, 'MANUAL')) {
    specs.push({
      name: 'manual-vehicle-event',
      repository: repository.manualVehicleEvent,
      where: {
        ...directCompanyScope(context, filters),
        recordedAt: sourceTimeRange(filters),
        ...sourceSearch(search, ['title', 'description', 'location']),
      },
      select: manualVehicleEventSelect,
      orderBy: [{ recordedAt: 'desc' }, { id: 'asc' }],
      fixedCategory: 'MANUAL',
      countable: true,
      normalize: (record) => normalizeManualVehicleEvent(withMappedVehicle(record) as never),
    });
  }

  return specs;
}

function compareTimelineEvents(left: TimelineEventDto, right: TimelineEventDto) {
  const timeDifference = Date.parse(right.recordedAt) - Date.parse(left.recordedAt);
  return timeDifference || left.key.localeCompare(right.key, 'en');
}

function isInsideCursor(event: TimelineEventDto, cursor: NormalizedFilters['cursor']) {
  if (!cursor) return true;
  const eventTime = Date.parse(event.recordedAt);
  const cursorTime = cursor.before.getTime();
  return eventTime < cursorTime || (eventTime === cursorTime && event.key > cursor.beforeKey);
}

function matchesScope(event: TimelineEventDto, filters: NormalizedFilters, includeSearch: boolean) {
  if (filters.categories && !filters.categories.has(event.category)) return false;
  if (filters.severities && !filters.severities.has(event.severity)) return false;
  if (!includeSearch || !filters.search) return true;

  return [
    event.title,
    event.description,
    event.location,
    event.vehicle.internalNumber,
    event.vehicle.model,
  ].some((value) => value?.toLocaleLowerCase('ru-RU').includes(filters.search ?? ''));
}

async function fillSource(
  state: SourceState,
  filters: NormalizedFilters,
  includeSearch: boolean,
) {
  while (state.buffer.length === 0 && !state.exhausted) {
    const args = {
      where: state.spec.where,
      select: state.spec.select,
      orderBy: state.spec.orderBy,
      take: SOURCE_BATCH_SIZE,
      ...(state.spec.distinct ? { distinct: state.spec.distinct } : {}),
      ...(state.cursorId ? { cursor: { id: state.cursorId }, skip: 1 } : {}),
    };
    const rows = await state.spec.repository.findMany(args);
    if (rows.length === 0) {
      state.exhausted = true;
      return;
    }

    state.cursorId = String(asRecord(rows.at(-1)).id);
    state.exhausted = rows.length < SOURCE_BATCH_SIZE;
    state.buffer = rows
      .map(state.spec.normalize)
      .filter(
        (event) =>
          isInsideCursor(event, filters.cursor) && matchesScope(event, filters, includeSearch),
      )
      .sort(compareTimelineEvents);
  }
}

function createMergedSource(
  specs: SourceSpec[],
  filters: NormalizedFilters,
  includeSearch: boolean,
) {
  const states: SourceState[] = specs.map((spec) => ({
    spec,
    buffer: [],
    exhausted: false,
    cursorId: null,
  }));

  return {
    async take(limit: number): Promise<TimelineEventDto[]> {
      const result: TimelineEventDto[] = [];
      while (result.length < limit) {
        await Promise.all(states.map((state) => fillSource(state, filters, includeSearch)));
        const available = states.filter((state) => state.buffer.length > 0);
        if (available.length === 0) break;

        let selected = available[0];
        for (const state of available.slice(1)) {
          if (compareTimelineEvents(state.buffer[0], selected.buffer[0]) < 0) {
            selected = state;
          }
        }
        result.push(selected.buffer.shift() as TimelineEventDto);
      }
      return result;
    },
  };
}

async function findReadKeys(
  repository: EventTimelineRepository,
  context: AuthenticatedTimelineContext,
  eventKeys: string[],
) {
  if (eventKeys.length === 0) return new Set<string>();
  const receipts = await repository.eventReadReceipt.findMany({
    where: {
      companyId: context.companyId,
      userId: context.userId,
      eventKey: { in: eventKeys },
    },
    select: { eventKey: true },
    take: eventKeys.length,
  });
  return new Set(receipts.map((receipt) => String(asRecord(receipt).eventKey)));
}

async function loadPage(
  repository: EventTimelineRepository,
  context: AuthenticatedTimelineContext,
  filters: NormalizedFilters,
  specs: SourceSpec[],
) {
  const merged = createMergedSource(specs, filters, true);
  const events: TimelineEventDto[] = [];

  while (events.length < filters.limit) {
    const candidateLimit = filters.read === 'all' ? filters.limit - events.length : SOURCE_BATCH_SIZE;
    const candidates = await merged.take(candidateLimit);
    if (candidates.length === 0) break;

    const readKeys = await findReadKeys(
      repository,
      context,
      candidates.map((event) => event.key),
    );
    for (const candidate of candidates) {
      const isRead = readKeys.has(candidate.key);
      if (
        filters.read === 'all' ||
        (filters.read === 'read' && isRead) ||
        (filters.read === 'unread' && !isRead)
      ) {
        events.push({ ...candidate, isRead });
        if (events.length === filters.limit) break;
      }
    }

    if (candidates.length < candidateLimit) break;
  }

  return events;
}

async function loadStats(
  repository: EventTimelineRepository,
  context: AuthenticatedTimelineContext,
  filters: NormalizedFilters,
) {
  const statsFilters: NormalizedFilters = {
    ...filters,
    search: null,
    read: 'all',
    cursor: null,
  };
  const specs = createSourceSpecs(repository, context, statsFilters, false);
  const databaseCount = (
    await Promise.all(
      specs
        .filter((spec) => spec.countable)
        .map((spec) => spec.repository.count({ where: spec.where })),
    )
  ).reduce((sum, count) => sum + count, 0);
  const merged = createMergedSource(specs, statsFilters, false);
  const vehicles = new Set<string>();
  let scannedTotal = 0;
  let uncountableTotal = 0;
  let danger = 0;
  let unread = 0;

  while (true) {
    const candidates = await merged.take(SOURCE_BATCH_SIZE);
    if (candidates.length === 0) break;
    const readKeys = await findReadKeys(
      repository,
      context,
      candidates.map((event) => event.key),
    );

    for (const event of candidates) {
      scannedTotal += 1;
      if (event.source.type === 'vehicle-position') uncountableTotal += 1;
      if (event.severity === 'DANGER') danger += 1;
      if (!readKeys.has(event.key)) unread += 1;
      vehicles.add(event.vehicle.id);
    }
  }

  const hasProjectionFilters = Boolean(filters.categories || filters.severities);
  return {
    total: hasProjectionFilters ? scannedTotal : databaseCount + uncountableTotal,
    danger,
    unread,
    vehicles: vehicles.size,
  };
}

async function listVehicles(
  repository: EventTimelineRepository,
  context: AuthenticatedTimelineContext,
) {
  const result: Array<{ id: string; label: string }> = [];
  let cursorId: string | null = null;

  while (true) {
    const vehicles = await repository.vehicle.findMany({
      where: { companyId: context.companyId },
      select: vehicleSelect,
      orderBy: [{ internalNumber: 'asc' }, { id: 'asc' }],
      take: SOURCE_BATCH_SIZE,
      ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
    });
    if (vehicles.length === 0) break;

    for (const item of vehicles) {
      const raw = asRecord(item);
      result.push({
        id: String(raw.id),
        label: [raw.internalNumber, raw.model, raw.registrationNumber]
          .filter(Boolean)
          .map(String)
          .join(' · '),
      });
    }
    if (vehicles.length < SOURCE_BATCH_SIZE) break;
    cursorId = String(asRecord(vehicles.at(-1)).id);
  }

  return result;
}

const emptyResult = (): TimelineResult => ({
  events: [],
  nextCursor: null,
  stats: { total: 0, danger: 0, unread: 0, vehicles: 0 },
  vehicles: [],
});

export function createEventTimelineQueries(
  repository: EventTimelineRepository,
  getContext: () => Promise<AuthenticatedTimelineContext | null>,
  getNow: () => Date = () => new Date(),
) {
  return {
    async getEventTimeline(filters: TimelineFilters): Promise<TimelineResult> {
      const normalizedFilters = normalizeFilters(filters, getNow());
      const context = await getContext();
      if (!context) return emptyResult();

      const specs = createSourceSpecs(repository, context, normalizedFilters, true);
      const events = await loadPage(repository, context, normalizedFilters, specs);
      const stats = await loadStats(repository, context, normalizedFilters);
      const vehicles = await listVehicles(repository, context);
      const lastEvent = events.at(-1);

      return {
        events,
        nextCursor:
          events.length === normalizedFilters.limit && lastEvent
            ? { before: lastEvent.recordedAt, beforeKey: lastEvent.key }
            : null,
        stats,
        vehicles,
      };
    },
  };
}

async function getAuthenticatedTimelineContext(): Promise<AuthenticatedTimelineContext | null> {
  const user = await requireAdmin();
  const membership = await prisma.companyMember.findFirst({
    where: { userId: user.id, role: 'ADMIN' },
    select: { companyId: true, role: true },
    orderBy: { createdAt: 'asc' },
  });

  if (!membership) return null;
  return {
    userId: user.id,
    companyId: membership.companyId,
    companyRole: membership.role,
  };
}

const queries = createEventTimelineQueries(
  {
    vehiclePosition: {
      findMany: (args) => prisma.vehiclePosition.findMany(args as Prisma.VehiclePositionFindManyArgs),
      count: (args) => prisma.vehiclePosition.count(args as Prisma.VehiclePositionCountArgs),
    },
    trip: {
      findMany: (args) => prisma.trip.findMany(args as Prisma.TripFindManyArgs),
      count: (args) => prisma.trip.count(args as Prisma.TripCountArgs),
    },
    vehicleEvent: {
      findMany: (args) => prisma.vehicleEvent.findMany(args as Prisma.VehicleEventFindManyArgs),
      count: (args) => prisma.vehicleEvent.count(args as Prisma.VehicleEventCountArgs),
    },
    fuelRecord: {
      findMany: (args) => prisma.fuelRecord.findMany(args as Prisma.FuelRecordFindManyArgs),
      count: (args) => prisma.fuelRecord.count(args as Prisma.FuelRecordCountArgs),
    },
    maintenanceRecord: {
      findMany: (args) =>
        prisma.maintenanceRecord.findMany(args as Prisma.MaintenanceRecordFindManyArgs),
      count: (args) =>
        prisma.maintenanceRecord.count(args as Prisma.MaintenanceRecordCountArgs),
    },
    washRecord: {
      findMany: (args) => prisma.washRecord.findMany(args as Prisma.WashRecordFindManyArgs),
      count: (args) => prisma.washRecord.count(args as Prisma.WashRecordCountArgs),
    },
    deviceCommand: {
      findMany: (args) => prisma.deviceCommand.findMany(args as Prisma.DeviceCommandFindManyArgs),
      count: (args) => prisma.deviceCommand.count(args as Prisma.DeviceCommandCountArgs),
    },
    manualVehicleEvent: {
      findMany: (args) =>
        prisma.manualVehicleEvent.findMany(args as Prisma.ManualVehicleEventFindManyArgs),
      count: (args) =>
        prisma.manualVehicleEvent.count(args as Prisma.ManualVehicleEventCountArgs),
    },
    eventReadReceipt: {
      findMany: (args) =>
        prisma.eventReadReceipt.findMany(args as Prisma.EventReadReceiptFindManyArgs),
    },
    vehicle: {
      findMany: (args) => prisma.vehicle.findMany(args as Prisma.VehicleFindManyArgs),
    },
  },
  getAuthenticatedTimelineContext,
);

export const getEventTimeline = queries.getEventTimeline;
