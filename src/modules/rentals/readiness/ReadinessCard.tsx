import Link from 'next/link';
import { FiAlertTriangle, FiCheckCircle } from 'react-icons/fi';

import { Badge, Card, CardContent, CardHeader } from '@/shared/ui';

import type { ReadinessResult } from './types';

export function ReadinessCard({
  title,
  result,
  completed,
  total,
}: {
  title: string;
  result: ReadinessResult;
  completed: number;
  total: number;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-bold">{title}</h2>
          <Badge tone={result.ready ? 'success' : 'warning'}>
            {result.ready ? 'Готово' : `${completed} из ${total}`}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3">
        {result.ready ? (
          <p className="flex items-center gap-2 text-sm text-[var(--color-success)]">
            <FiCheckCircle aria-hidden="true" /> Все обязательные условия выполнены.
          </p>
        ) : (
          <div className="grid gap-2" role="alert">
            <p className="flex items-center gap-2 text-sm font-semibold text-[var(--color-danger)]">
              <FiAlertTriangle aria-hidden="true" /> Что нужно исправить
            </p>
            <ul className="grid gap-2 text-sm">
              {result.blockers.map((issue) => (
                <li key={issue.code}>
                  <Link className="text-[var(--color-primary)] hover:underline" href={issue.href}>
                    {issue.message}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
        {result.warnings.length ? (
          <div className="grid gap-1 text-sm text-[var(--color-warning)]">
            {result.warnings.map((issue) => (
              <p key={issue.code}>{issue.message}</p>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
