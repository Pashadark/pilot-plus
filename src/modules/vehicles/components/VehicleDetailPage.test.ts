// @vitest-environment jsdom

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { cleanup, fireEvent, render as renderClient, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/modules/maintenance/service-plan-actions', () => ({ readServicePlan: vi.fn().mockResolvedValue({ canEdit: false, current: null, record: null }), saveServicePlan: vi.fn() }));

import type { VehicleDetailDto } from '../types';
import { VehicleDetailPage } from './VehicleDetailPage';
import { ToastProvider } from '@/shared/providers/ToastProvider';

afterEach(cleanup);

function renderPage(props: Parameters<typeof VehicleDetailPage>[0]) {
  return renderToStaticMarkup(
    createElement(ToastProvider, null, createElement(VehicleDetailPage, props)),
  );
}

const vehicle: VehicleDetailDto = {
  id: 'vehicle-1',
  internalNumber: 'PLT-001',
  model: 'GWM WEY',
  city: 'Красноярск',
  office: null,
  registrationNumber: null,
  transmission: 'АКПП',
  engineLiters: 1.5,
  fuelType: 'PETROL',
  seats: 7,
  dailyPriceMinor: 880000,
  currency: 'RUB',
  originalPrice: '8 800 ₽',
  features: [],
  status: 'UNKNOWN',
  gpsStatus: { key: 'NO_DATA', label: 'Нет связи', tone: 'danger', isConnected: false },
  primaryImage: null,
  telemetry: {
    odometerKm: null,
    fuelLevelPercent: null,
    lastSeenAt: null,
    lastTripAt: null,
    hasPosition: false,
    address: null,
  },
  vin: null,
  createdAt: '2026-07-19T12:00:00.000Z',
  trips: [],
  events: [],
  fuelRecords: [],
  maintenanceRecords: [
    {
      id: 'maintenance-1',
      title: 'Замена масла',
      kind: 'OIL',
      status: 'COMPLETED',
      scheduledAt: '2026-07-20T10:00:00.000Z',
      completedAt: '2026-07-20T12:00:00.000Z',
      targetOdometerKm: 15000.5,
      provider: 'Сервис Pilot',
      costMinor: 420000,
    },
  ],
  washRecords: [
    {
      id: 'wash-1',
      kind: 'COMPLEX',
      status: 'IN_PROGRESS',
      scheduledAt: '2026-07-21T10:00:00.000Z',
      startedAt: '2026-07-21T10:05:00.000Z',
      completedAt: null,
      provider: 'Мойка Pilot',
      costMinor: 190000,
    },
  ],
  documents: [],
};

describe('VehicleDetailPage', () => {
  it('показывает ремонт, повреждения и фотографии в истории автомобиля', () => {
    const markup = renderPage({
      vehicle: {
        ...vehicle,
        maintenanceRecords: [
          {
            ...vehicle.maintenanceRecords[0],
            id: 'repair-1',
            title: 'Повреждение заднего бампера',
            recordType: 'REPAIR',
            description: 'Повреждён подкрылок',
            status: 'IN_PROGRESS',
            damageReportedAt: '2026-09-12T09:00:00.000Z',
            startedAt: '2026-09-12T10:00:00.000Z',
            scheduledAt: null,
            rental: { id: 'rental-1', contractNumber: 'ME-2026-0030-GA' },
            client: { id: 'client-1', fullName: 'Горбунов Артём Денисович' },
            workItems: [{ id: 'work-1', title: 'Дефектовка', description: null, costMinor: null }],
            attachments: [
              {
                id: 'photo-1',
                kind: 'DAMAGE_BEFORE',
                originalName: 'damage.jpg',
                url: '/maintenance/repair-1/attachments/photo-1',
                isImage: true,
              },
            ],
          },
        ],
      },
      activeTab: 'maintenance',
    });

    expect(markup).toContain('Ремонты и техническое обслуживание');
    expect(markup).toContain('Повреждение заднего бампера');
    expect(markup).toContain('Горбунов Артём Денисович');
    expect(markup).toContain('ME-2026-0030-GA');
    expect(markup).toContain('/maintenance/repair-1/attachments/photo-1');
    expect(markup).toContain('/maintenance?view=list&amp;create=repair&amp;vehicleId=vehicle-1');
  });

  it('показывает рабочее состояние автомобиля и текущего арендатора в компактном обзоре', () => {
    const markup = renderPage({
      vehicle: {
        ...vehicle,
        registrationNumber: 'А429АУ997',
        status: 'IDLE',
        currentRentalId: 'rental-active',
        telemetry: {
          odometerKm: 234100,
          fuelLevelPercent: 34,
          speedKph: 0,
          lastSeenAt: '2026-08-27T08:00:00.000Z',
          lastTripAt: null,
          hasPosition: true,
          address: 'Зелёный проспект, 22',
        },
        rentals: [
          {
            id: 'rental-active',
            contractNumber: 'ME-2026-0020-KS',
            status: 'ACTIVE',
            startsAt: '2026-08-24T17:30:00.000Z',
            endsAt: '2026-08-28T17:30:00.000Z',
            client: { id: 'client-1', fullName: 'Клементьев Семен Юрьевич' },
            documents: [],
            operations: [],
          },
        ],
      },
      activeTab: 'overview',
    });

    expect(markup).toContain('Клементьев Семен Юрьевич');
    expect(markup).toContain('234 100 км');
    expect(markup).toContain('34%');
    expect(markup).toContain('Зелёный проспект, 22');
    expect(markup).toContain('В аренде');
    expect(markup).not.toContain('>В парке</span>');
  });

  it('собирает обзор по утверждённому макету с фото, техническим состоянием, действиями и вкладками', () => {
    const overview = renderPage({ vehicle, activeTab: 'overview' });
    const documents = renderPage({ vehicle, activeTab: 'documents' });

    expect(overview).toContain('К списку автомобилей');
    expect(overview).toContain('Последний сигнал');
    expect(overview).toContain('Выдать в аренду');
    expect(overview).toContain('Забронировать');
    expect(overview).toContain('На карте');
    expect(overview).toContain('Редактировать');
    expect(overview).toContain('Техническое состояние');
    expect(overview).toContain('Готовность к работе');
    expect(overview).toContain('История');
    expect(overview).toContain('Документы');
    expect(overview).not.toContain('Перетащите документ');
    expect(documents).toContain('Перетащите документ');
    expect(documents).toContain('СТС');
    expect(documents).toContain('ПТС');
    expect(documents).toContain('ТО / ремонт');
  });

  it('показывает компактное основное фото и три места галереи под ним', () => {
    const markup = renderPage({
      vehicle: {
        ...vehicle,
        primaryImage: { localPath: '/uploads/vehicles/main.jpg', alt: 'Главное фото' },
      },
      activeTab: 'overview',
    });

    expect(markup).toContain('data-testid="vehicle-hero-grid"');
    expect(markup).toContain(
      'xl:grid-cols-[minmax(380px,1.08fr)_minmax(340px,0.96fr)_minmax(230px,0.68fr)]',
    );
    expect(markup).toContain('xl:aspect-[1.38/1]');
    expect(markup).toContain('aria-label="Фотографии автомобиля"');
    expect(markup.match(/data-testid="vehicle-gallery-slot"/g)).toHaveLength(3);
  });

  it('показывает место популярности поверх основного фото автомобиля', () => {
    const markup = renderPage({
      vehicle: { ...vehicle, popularityRank: 1 },
      activeTab: 'overview',
    });

    expect(markup).toContain('aria-label="1 место по количеству заказов"');
    expect(markup).toContain('data-testid="vehicle-detail-popularity-medal"');
  });

  it('открывает нажатую миниатюру в большом окне без стрелок', () => {
    renderClient(
      createElement(
        ToastProvider,
        null,
        createElement(VehicleDetailPage, {
          vehicle: {
            ...vehicle,
            primaryImage: { localPath: '/uploads/vehicles/main.jpg', alt: 'Главное фото' },
            galleryImages: [
              { localPath: '/uploads/vehicles/main.jpg', alt: 'Главное фото' },
              { localPath: '/uploads/vehicles/rear.jpg', alt: 'Фото сзади' },
            ],
          },
          activeTab: 'overview',
        }),
      ),
    );

    expect(
      screen.getByTestId('vehicle-detail-photo').querySelector('img')?.getAttribute('alt'),
    ).toBe('Главное фото');

    fireEvent.click(screen.getByRole('button', { name: 'Открыть фото 2: Фото сзади' }));

    expect(
      screen.getByTestId('vehicle-detail-photo').querySelector('img')?.getAttribute('alt'),
    ).toBe('Фото сзади');
    expect(screen.queryByRole('button', { name: /следующее фото/i })).toBeNull();
  });

  it('показывает всех водителей активной аренды и не дублирует местоположение в техническом блоке', () => {
    const markup = renderPage({
      vehicle: {
        ...vehicle,
        currentRentalId: 'rental-active',
        telemetry: { ...vehicle.telemetry, address: 'Москва, Зелёный проспект, 22' },
        rentals: [
          {
            id: 'rental-active',
            contractNumber: 'ME-1',
            status: 'ACTIVE',
            startsAt: '2026-08-27T10:00:00.000Z',
            endsAt: '2026-08-29T10:00:00.000Z',
            client: { id: 'client-1', fullName: 'Клементьев Семен Юрьевич' },
            drivers: [
              { id: 'driver-1', fullName: 'Клементьев Семен Юрьевич' },
              { id: 'driver-2', fullName: 'Иванов Алексей Петрович' },
            ],
            documents: [],
            operations: [],
          },
        ],
      },
      activeTab: 'overview',
    });
    expect(markup).toContain('2 водителя');
    expect(markup).toContain('Иванов Алексей Петрович');
    const technical = markup
      .split('data-testid="vehicle-technical-state"')[1]
      ?.split('</section>')[0];
    expect(technical).not.toContain('Местоположение');
  });

  it('не подменяет отсутствующие данные автомобиля демонстрационными значениями', () => {
    const markup = renderPage({ vehicle, activeTab: 'overview' });

    expect(markup).toContain('Нет данных');
    expect(markup).not.toContain('45 680 км');
    expect(markup).not.toContain('Ленинградский пр-т, 32, Москва');
    expect(markup).not.toContain('XTA1234567890ABC');
    expect(markup).not.toContain('А 123 МР 77');
  });

  it('не выдумывает интервал ТО до загрузки сохранённого плана', () => {
    const markup = renderPage({
      vehicle: {
        ...vehicle,
        telemetry: { ...vehicle.telemetry, odometerKm: 85_699 },
        maintenanceRecords: [],
      },
      activeTab: 'overview',
    });

    expect(markup).not.toContain('5 301 км');
    expect(markup).toContain('Загрузка ТО');
    expect(markup).not.toContain('Следующее ТО</p><p class="text-sm font-medium ">Нет данных');
  });

  it('не создаёт вымышленные поездки при пустой истории', () => {
    const markup = renderToStaticMarkup(
      createElement(VehicleDetailPage, { vehicle, activeTab: 'trips' }),
    );

    expect(markup).toContain('Поездки ещё не поступали');
    expect(markup).not.toContain('45.6 км');
  });

  it('показывает историю обслуживания без моек', () => {
    const markup = renderPage({ vehicle, activeTab: 'maintenance' });
    expect(markup).toContain('История обслуживания');
    expect(markup).toContain('Замена масла');
    expect(markup).toContain('Завершено');
    expect(markup).not.toContain('История моек');
    expect(markup).not.toContain('Комплексная');
  });

  it('показывает дату завершения в московском часовом поясе', () => {
    const markup = renderPage({ vehicle, activeTab: 'maintenance' });
    expect(markup).toContain('20 июля 2026');
    expect(markup).not.toContain('21 июля 2026');
  });

  it('не показывает мойки даже при пустой истории обслуживания', () => {
    const markup = renderPage({ vehicle: { ...vehicle, maintenanceRecords: [] }, activeTab: 'maintenance' });
    expect(markup).toContain('Обслуживание ещё не запланировано');
    expect(markup).not.toContain('История моек');
    expect(markup).not.toContain('Комплексная');
  });
});
