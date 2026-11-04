import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { StatisticsPage } from './StatisticsPage';
import { aggregateStatistics, statisticsWindow } from './domain/aggregate';
const window = statisticsWindow('7', new Date('2026-10-09T12:00:00Z'));
const vehicle = {
  id: 'v1',
  companyId: 'company-a',
  name: 'Kia Rio',
  make: 'Kia',
  model: 'Rio',
  registrationNumber: 'А001АА',
  images: [],
  image: null,
};
describe('statistics page', () => {
  it('shows accessible selectors, chart headings and honest missing source states', () => {
    const html = renderToStaticMarkup(
      <StatisticsPage
        workspace={{
          accessDenied: false,
          window,
          vehicles: [vehicle],
          selected: vehicle,
          partial: false,
          unknownCosts: 0,
          allTime: false,
          stats: aggregateStatistics({
            ...window,
            payments: [],
            rentals: [],
            costs: [],
            visits: [],
          }),
        }}
      />,
    );
    expect(html).toContain('for="statistics-vehicle"');
    expect(html).toContain('for="statistics-period"');
    expect(html).toContain('Доходы и расходы');
    expect(html).toContain('Частота выдачи по дням недели');
    expect(html).toContain('Нет истории зажигания');
    expect(html).toContain('Нет подтверждённых посещений');
    expect(html).toContain('Залоги не включены');
    expect(html).not.toContain('NaN');
  });
  it('does not render protected finance selectors or charts on access denial', () => {
    const html = renderToStaticMarkup(
      <StatisticsPage
        workspace={{
          accessDenied: true,
          selected: null,
          vehicles: [],
          window,
          stats: null,
          partial: false,
        }}
      />,
    );
    expect(html).toContain('Доступ к статистике ограничен');
    expect(html).not.toContain('statistics-vehicle');
  });
});
