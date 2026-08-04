export const adminAccessRoles = [
  {
    label: 'Суперадминистратор',
    initials: 'СА',
    scope: 'Вся система',
    tone: 'primary',
  },
  {
    label: 'Администратор компании',
    initials: 'АК',
    scope: 'Свои компании',
    tone: 'success',
  },
  {
    label: 'Диспетчер',
    initials: 'Д',
    scope: 'Операции автопарка',
    tone: 'warning',
  },
  {
    label: 'Водитель',
    initials: 'В',
    scope: 'Нет базовых разрешений',
    tone: 'neutral',
  },
  {
    label: 'Наблюдатель',
    initials: 'Н',
    scope: 'Разрешённый просмотр',
    tone: 'neutral',
  },
] as const;
