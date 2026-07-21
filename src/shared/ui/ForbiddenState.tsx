import Link from 'next/link';
import { FiShield } from 'react-icons/fi';

import { SystemState } from './SystemState';

const homeLinkClass =
  'inline-flex min-h-11 min-w-11 items-center justify-center rounded-[var(--radius-md)] border border-transparent bg-[var(--color-primary)] px-4 text-sm font-semibold text-[var(--color-text-inverse)] transition-colors duration-[var(--motion-fast)] hover:bg-[var(--color-primary-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]';

export function ForbiddenState() {
  return (
    <SystemState
      code="403"
      tone="warning"
      icon={<FiShield aria-hidden="true" data-testid="forbidden-shield-icon" />}
      title="Доступ ограничен"
      description="У вас нет прав для просмотра этого раздела."
      primaryAction={
        <Link href="/" className={homeLinkClass}>
          На главную
        </Link>
      }
    />
  );
}
