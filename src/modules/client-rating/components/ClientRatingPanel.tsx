import { Card, CardContent, CardHeader } from '@/shared/ui';

import type { ClientRatingDto } from '../queries';

import { ClientRatingStars } from './ClientRatingStars';

const reasonLabels: Record<ClientRatingDto['events'][number]['reason'], string> = {
  CLEAN_RENTAL_COMPLETED: 'Аренда завершена без замечаний',
  ON_TIME_RETURN_COMPLETED: 'Автомобиль возвращён вовремя',
  CLEAN_RENTAL_STREAK_COMPLETED: 'Серия успешных аренд',
  LATE_RETURN_CONFIRMED: 'Подтверждённая просрочка возврата',
  UNPAID_CONFIRMED_FINE: 'Подтверждённый неоплаченный штраф',
  DAMAGE_CONFIRMED: 'Подтверждённое повреждение',
  CONTRACT_VIOLATION_CONFIRMED: 'Подтверждённое нарушение договора',
  MANUAL_COMMENT: 'Ручная оценка сотрудника',
};

function countLabel(count: number, one: string, few: string, many: string) {
  const remainder = count % 100;
  if (remainder >= 11 && remainder <= 14) return `${count} ${many}`;
  if (count % 10 === 1) return `${count} ${one}`;
  if (count % 10 >= 2 && count % 10 <= 4) return `${count} ${few}`;
  return `${count} ${many}`;
}

export function ClientRatingPanel({ rating }: { rating: ClientRatingDto }) {
  return (
    <Card data-testid="client-rating-panel">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-bold">Рейтинг и заметки</h2>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              Оценка рассчитывается из подтверждённых событий и ручных решений сотрудников.
            </p>
          </div>
          <ClientRatingStars rating={rating} />
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-2 text-sm sm:grid-cols-3">
          <span>
            <strong>{rating.score}</strong> из 100 баллов
          </span>
          <span>
            {countLabel(
              rating.completedRentals,
              'завершённая аренда',
              'завершённые аренды',
              'завершённых аренд',
            )}
          </span>
          <span className={rating.openProblemCount ? 'text-[var(--color-danger)]' : ''}>
            {countLabel(
              rating.openProblemCount,
              'открытое замечание',
              'открытых замечания',
              'открытых замечаний',
            )}
          </span>
        </div>
        <div className="grid gap-2 border-t border-[var(--color-border)] pt-4">
          <h3 className="text-sm font-semibold">Последние учтённые события</h3>
          {rating.events.length ? (
            <ol className="grid gap-2">
              {rating.events.slice(0, 8).map((event) => (
                <li
                  key={event.id}
                  className="flex flex-wrap items-center justify-between gap-2 text-sm"
                >
                  <span>{reasonLabels[event.reason]}</span>
                  <span
                    className={
                      event.delta < 0
                        ? 'font-semibold text-[var(--color-danger)]'
                        : 'font-semibold text-[var(--color-success)]'
                    }
                  >
                    {event.delta > 0 ? '+' : '−'}
                    {Math.abs(event.delta)} баллов
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-[var(--color-text-secondary)]">
              Событий пока нет: рейтинг формируется.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
