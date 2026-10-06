export type GlobalErrorKind = 'deployment-skew' | 'network' | 'internal' | 'unknown';

export interface UserFacingGlobalError {
  kind: GlobalErrorKind;
  title: string;
  description: string;
}

function errorMessage(reason: unknown) {
  if (reason instanceof Error) return reason.message;
  if (typeof reason === 'string') return reason;
  if (reason && typeof reason === 'object' && 'message' in reason) {
    return String(reason.message);
  }
  return '';
}

export function toUserFacingGlobalError(reason: unknown): UserFacingGlobalError {
  const message = errorMessage(reason);

  if (/Failed to find Server Action|older or newer deployment/i.test(message)) {
    return {
      kind: 'deployment-skew',
      title: 'Страница устарела после обновления',
      description: 'Обновите страницу и повторите действие. Введённые данные не были сохранены.',
    };
  }

  if (/Failed to fetch|NetworkError|Load failed|ERR_NETWORK/i.test(message)) {
    return {
      kind: 'network',
      title: 'Нет связи с сервером',
      description: 'Проверьте интернет и повторите действие. Данные могли не сохраниться.',
    };
  }

  if (/prisma\.|ConnectorError|PostgresError|Unknown argument|\bP\d{4}\b/i.test(message)) {
    return {
      kind: 'internal',
      title: 'Не удалось сохранить данные',
      description: 'Сервер отклонил операцию. Повторите попытку или сообщите администратору.',
    };
  }

  return {
    kind: 'unknown',
    title: 'Произошла ошибка',
    description: message || 'Повторите действие. Если ошибка останется, сообщите администратору.',
  };
}
