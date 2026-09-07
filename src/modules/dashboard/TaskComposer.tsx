import { FiPlus } from 'react-icons/fi';

import { createOperationsTaskAction } from './task-actions';
import { Card, CardContent, CardHeader } from '@/shared/ui';

export function TaskComposer() {
  return (
    <Card>
      <CardHeader>
        <h2 className="text-lg font-semibold">Добавить задачу</h2>
        <p className="text-xs text-[var(--color-text-secondary)]">
          Звонок, поручение или действие, которое нельзя забыть
        </p>
      </CardHeader>
      <CardContent>
        <form action={createOperationsTaskAction} className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 sm:col-span-2">
            <span className="text-sm font-medium">Что сделать</span>
            <input
              name="title"
              required
              minLength={2}
              maxLength={160}
              placeholder="Например, позвонить клиенту"
              className="min-h-11 rounded-[var(--radius-md)] border bg-[var(--color-surface)] px-3"
            />
          </label>
          <label className="grid gap-1">
            <span className="text-sm font-medium">Срок</span>
            <input
              name="dueAt"
              type="datetime-local"
              required
              className="min-h-11 rounded-[var(--radius-md)] border bg-[var(--color-surface)] px-3"
            />
          </label>
          <label className="grid gap-1">
            <span className="text-sm font-medium">Приоритет</span>
            <select
              name="priority"
              defaultValue="NORMAL"
              className="min-h-11 rounded-[var(--radius-md)] border bg-[var(--color-surface)] px-3"
            >
              <option value="LOW">Низкий</option>
              <option value="NORMAL">Обычный</option>
              <option value="HIGH">Высокий</option>
              <option value="CRITICAL">Критический</option>
            </select>
          </label>
          <label className="grid gap-1 sm:col-span-2">
            <span className="text-sm font-medium">Комментарий</span>
            <textarea
              name="description"
              maxLength={500}
              rows={2}
              placeholder="Телефон, детали или ожидаемый результат"
              className="rounded-[var(--radius-md)] border bg-[var(--color-surface)] px-3 py-2"
            />
          </label>
          <button
            type="submit"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-primary)] px-4 text-sm font-semibold text-white sm:col-span-2"
          >
            <FiPlus aria-hidden="true" /> Добавить в рабочий день
          </button>
        </form>
      </CardContent>
    </Card>
  );
}
