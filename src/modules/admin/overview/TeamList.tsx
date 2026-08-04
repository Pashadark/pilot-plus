import { Avatar, Badge, Card, CardContent, CardHeader } from '@/shared/ui';

import type { AdminTeamMember } from './types';

const companyRoleLabel = {
  COMPANY_ADMIN: 'Администратор компании',
  DISPATCHER: 'Диспетчер',
  DRIVER: 'Водитель',
  VIEWER: 'Наблюдатель',
} as const;

export function TeamList({ team }: { team: readonly AdminTeamMember[] }) {
  return (
    <Card className="min-w-0" data-testid="admin-team-list">
      <CardHeader>
        <h3 className="text-base font-bold">Команда</h3>
      </CardHeader>
      <CardContent>
        {team.length === 0 ? (
          <p className="text-sm leading-6 text-[var(--color-text-secondary)]">
            Пользователи пока не добавлены
          </p>
        ) : (
          <ul className="grid min-w-0 divide-y divide-[var(--color-border)]">
            {team.map((member) => (
              <li
                key={member.id}
                className="flex min-w-0 items-start gap-3 py-3 first:pt-0 last:pb-0"
              >
                <Avatar name={member.name} size="sm" className="shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold break-words">{member.name}</p>
                  <p className="text-xs leading-5 break-words text-[var(--color-text-secondary)]">
                    {member.email}
                  </p>
                  <div className="mt-2 flex min-w-0 flex-wrap gap-2">
                    <Badge tone="primary">{companyRoleLabel[member.role]}</Badge>
                    <Badge tone={member.isActive ? 'success' : 'neutral'}>
                      {member.isActive ? 'Активен' : 'Неактивен'}
                    </Badge>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
