import type { RentalActionResult } from '@/modules/rentals/server/actions';
import type { ToastInput } from '@/shared/providers/ToastProvider';

import type { RentalOperationDialogKind } from './RentalOperationDialog';

const successTitle: Record<RentalOperationDialogKind, string> = {
  HANDOVER: 'Автомобиль выдан',
  EXTENSION: 'Аренда продлена',
  RETURN: 'Аренда закрыта',
  WEEKLY_INSPECTION: 'Еженедельный осмотр сохранён',
};

const failureTitle: Record<RentalOperationDialogKind, string> = {
  HANDOVER: 'Выдача не сохранена',
  EXTENSION: 'Продление не сохранено',
  RETURN: 'Возврат не сохранён',
  WEEKLY_INSPECTION: 'Еженедельный осмотр не сохранён',
};

export function buildRentalOperationToast(
  kind: RentalOperationDialogKind,
  result: RentalActionResult,
): ToastInput {
  if (!result.ok) {
    return {
      tone: 'danger',
      title: failureTitle[kind],
      description: result.message,
      durationMs: 10_000,
    };
  }

  const details: string[] = [];
  if (result.mileageKm !== undefined) {
    const mileage = new Intl.NumberFormat('ru-RU')
      .format(result.mileageKm)
      .replaceAll('\u00a0', ' ');
    details.push(`Пробег ${mileage} км`);
  }
  if (result.savedMediaCount !== undefined) {
    details.push(`файлов сохранено: ${result.savedMediaCount}`);
  }

  return {
    tone: 'success',
    title: successTitle[kind],
    ...(details.length > 0 ? { description: `${details.join(' · ')}.` } : {}),
  };
}
