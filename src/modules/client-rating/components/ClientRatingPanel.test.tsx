// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ClientRatingPanel } from './ClientRatingPanel';

describe('ClientRatingPanel', () => {
  it('explains the current score and newest safe events to staff', () => {
    render(
      <ClientRatingPanel
        rating={{
          score: 84,
          stars: 4,
          display: '4,2',
          label: 'Надёжный клиент',
          completedRentals: 5,
          eventCount: 2,
          openProblemCount: 1,
          events: [
            {
              id: 'event-1',
              delta: -15,
              type: 'MANUAL_NEGATIVE',
              reason: 'MANUAL_COMMENT',
              createdAt: '2026-08-22T10:00:00.000Z',
            },
          ],
        }}
      />,
    );

    expect(screen.getByText('Рейтинг и заметки')).toBeTruthy();
    expect(screen.getByText('1 открытое замечание')).toBeTruthy();
    expect(screen.getByText('−15 баллов')).toBeTruthy();
  });
});
