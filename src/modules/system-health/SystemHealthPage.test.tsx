import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { SystemHealthPage } from './SystemHealthPage';

describe('SystemHealthPage', () => {
  it('показывает общую сводку, инфраструктуру и фоновые процессы', () => {
    const markup = renderToStaticMarkup(
      <SystemHealthPage
        services={[
          {
            key: 'api',
            label: 'API СУПА ПРО',
            status: 'healthy',
            message: 'Сервис доступен.',
            latencyMs: 3,
            checkedAt: '2026-08-31T12:00:00.000Z',
          },
        ]}
        operations={[
          {
            key: 'glonasssoft',
            label: 'GLONASSSoft',
            description: 'Свежие координаты автомобилей.',
            status: 'unavailable',
            message: 'Обновления давно не поступали.',
            checkedAt: '2026-08-31T12:00:00.000Z',
            lastAttemptAt: '2026-08-27T18:04:55.000Z',
            lastSuccessAt: '2026-08-27T18:04:55.000Z',
            errorCode: null,
            metrics: [{ label: 'Автомобили', value: '10' }],
          },
        ]}
      />,
    );

    expect(markup).toContain('Требуется внимание');
    expect(markup).toContain('Основные сервисы');
    expect(markup).toContain('Фоновые процессы и очереди');
    expect(markup).toContain('Обновления давно не поступали.');
    expect(markup).toContain('Последний успех');
    expect(markup).toContain('1 из 2 компонентов работают штатно');
  });
});
