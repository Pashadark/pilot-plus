import type { SafeUser } from '@/modules/auth/types';

export type CompanyProfileRole = 'COMPANY_ADMIN' | 'DISPATCHER' | 'DRIVER' | 'VIEWER';

export type ProfileRoleView = {
  label: string;
  position: string;
  permissions: string[];
};

export type ProfileViewModel = {
  user: SafeUser;
  bannerUrl: string | null;
  company: {
    name: string;
    office: string;
    legalRole: string;
    members: Array<{
      id: string;
      name: string;
      role: string;
      position: string;
      status: string;
      avatarUrl: string | null;
      lastActivityAt: string;
    }>;
  };
  role: ProfileRoleView;
  account: {
    status: string;
    registeredAt: string;
    lastLoginAt: string;
    sessionExpiresAt: string;
    activeSessions: number;
    sessions: Array<{
      id: string;
      createdAt: string;
      expiresAt: string;
      current: boolean;
    }>;
  };
};

export function buildProfileRole(
  systemRole: SafeUser['role'],
  companyRole: CompanyProfileRole | null,
): ProfileRoleView {
  if (systemRole === 'SUPER_ADMIN') {
    return {
      label: 'Суперадминистратор',
      position: 'Основатель и владелец',
      permissions: [
        'Полный доступ',
        'Управление сотрудниками',
        'Финансы и отчёты',
        'Настройки системы',
      ],
    };
  }

  const roles: Record<CompanyProfileRole, ProfileRoleView> = {
    COMPANY_ADMIN: {
      label: 'Администратор компании',
      position: 'Руководитель автопарка',
      permissions: [
        'Управление автопарком',
        'Управление сотрудниками',
        'Отчёты',
        'Настройки компании',
      ],
    },
    DISPATCHER: {
      label: 'Оператор',
      position: 'Оператор автопарка',
      permissions: ['Аренда и возвраты', 'Клиенты', 'Автомобили', 'Оперативные события'],
    },
    DRIVER: {
      label: 'Водитель',
      position: 'Водитель',
      permissions: ['Мои заявки', 'Мой автомобиль', 'Осмотр и возврат', 'Маршруты'],
    },
    VIEWER: {
      label: 'Наблюдатель',
      position: 'Сотрудник',
      permissions: ['Просмотр автопарка', 'Просмотр событий', 'Просмотр отчётов', 'Личный профиль'],
    },
  };

  return roles[companyRole ?? 'VIEWER'];
}
