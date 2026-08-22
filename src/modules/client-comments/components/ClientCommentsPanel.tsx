'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { FiCheck, FiEdit2, FiEyeOff, FiMapPin } from 'react-icons/fi';

import { useToast } from '@/shared/providers/ToastProvider';
import { Badge, Button, Card, CardContent, Select } from '@/shared/ui';

import {
  createClientCommentAction,
  hideClientCommentAction,
  resolveClientCommentAction,
  toggleClientCommentPinAction,
  updateClientCommentAction,
} from '../actions';
import type { ClientCommentDto } from '../types';

const categories = {
  GENERAL: 'Общее',
  POSITIVE: 'Положительное',
  PROBLEM: 'Проблема',
  DAMAGE: 'Повреждение',
  PAYMENT: 'Оплата',
  VIOLATION: 'Нарушение',
  HANDOVER_RETURN: 'Выдача / возврат',
  DOCUMENTS: 'Документы',
};

export function ClientCommentsPanel({
  clientId,
  comments,
  rentals,
  canManage,
  canManageRating = false,
  currentUserId,
  canHideAny,
}: {
  clientId: string;
  comments: ClientCommentDto[];
  rentals: Array<{ id: string; label: string }>;
  canManage: boolean;
  canManageRating?: boolean;
  currentUserId: string;
  canHideAny: boolean;
}) {
  const [editing, setEditing] = useState<ClientCommentDto | null>(null);
  const [pending, startTransition] = useTransition();
  const { showToast } = useToast();
  const canSetRatingOnCreate = canManageRating && editing === null;
  function run(
    action: (data: FormData) => Promise<{ ok: boolean; message: string }>,
    data: FormData,
  ) {
    startTransition(async () => {
      const result = await action(data);
      showToast({ tone: result.ok ? 'success' : 'danger', title: result.message });
      if (result.ok) setEditing(null);
    });
  }
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(18rem,0.8fr)_minmax(0,1.2fr)]">
      {canManage ? (
        <Card>
          <CardContent>
            <form
              key={editing?.id ?? 'new'}
              className="grid gap-3"
              action={(data) =>
                run(editing ? updateClientCommentAction : createClientCommentAction, data)
              }
            >
              <input type="hidden" name="clientId" value={clientId} />
              {editing ? <input type="hidden" name="commentId" value={editing.id} /> : null}
              <h3 className="font-bold">
                {editing ? 'Редактировать комментарий' : 'Новый комментарий'}
              </h3>
              <textarea
                aria-label="Комментарий"
                name="text"
                required
                maxLength={2000}
                defaultValue={editing?.text}
                className="min-h-32 resize-y rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3"
                placeholder="Что произошло, что понравилось или вызвало проблему"
              />
              <Select
                name="category"
                label="Категория"
                defaultValue={editing?.category ?? 'GENERAL'}
              >
                {Object.entries(categories).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
              {canSetRatingOnCreate ? (
                <fieldset className="grid gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] p-3">
                  <label className="flex min-h-11 items-center gap-2 text-sm font-medium">
                    <input type="checkbox" name="affectsRating" defaultChecked={false} />
                    Учитывать в рейтинге
                  </label>
                  <label className="grid gap-1 text-sm font-medium">
                    Влияние на рейтинг
                    <input
                      aria-label="Влияние на рейтинг"
                      name="ratingDelta"
                      type="number"
                      min={-30}
                      max={10}
                      step={1}
                      defaultValue=""
                      className="min-h-11 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3"
                    />
                  </label>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    От −30 до +10, кроме нуля.
                  </p>
                </fieldset>
              ) : null}
              {editing?.affectsRating && editing.ratingDelta !== null ? (
                <p className="rounded-[var(--radius-md)] bg-[var(--color-elevated)] px-3 py-2 text-sm text-[var(--color-text-secondary)]">
                  Влияние на рейтинг: {editing.ratingDelta > 0 ? '+' : '−'}
                  {Math.abs(editing.ratingDelta)} баллов
                </p>
              ) : null}
              <Select name="severity" label="Важность" defaultValue={editing?.severity ?? 'INFO'}>
                <option value="INFO">Обычная</option>
                <option value="WARNING">Важная</option>
                <option value="DANGER">Критическая</option>
              </Select>
              <Select
                name="rentalId"
                label="Связать с арендой"
                defaultValue={editing?.rentalId ?? ''}
              >
                <option value="">Общий комментарий</option>
                {rentals.map((rental) => (
                  <option key={rental.id} value={rental.id}>
                    {rental.label}
                  </option>
                ))}
              </Select>
              <div className="flex flex-wrap gap-2">
                <Button type="submit" loading={pending}>
                  {editing ? 'Сохранить' : 'Добавить комментарий'}
                </Button>
                {editing ? (
                  <Button variant="secondary" onClick={() => setEditing(null)}>
                    Отмена
                  </Button>
                ) : null}
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}
      <div className="grid content-start gap-3">
        {comments.length ? (
          comments.map((comment) => (
            <Card key={comment.id}>
              <CardContent>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex flex-wrap gap-2">
                    <Badge
                      tone={
                        comment.severity === 'DANGER'
                          ? 'danger'
                          : comment.severity === 'WARNING'
                            ? 'warning'
                            : 'neutral'
                      }
                    >
                      {categories[comment.category]}
                    </Badge>
                    {comment.isPinned ? <Badge tone="info">Закреплён</Badge> : null}
                    {comment.problemStatus ? (
                      <Badge tone={comment.problemStatus === 'OPEN' ? 'warning' : 'success'}>
                        {comment.problemStatus === 'OPEN' ? 'Открыта' : 'Решена'}
                      </Badge>
                    ) : null}
                  </div>
                  <time className="text-xs text-[var(--color-text-secondary)]">
                    {new Intl.DateTimeFormat('ru-RU', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                      timeZone: 'Europe/Moscow',
                    }).format(new Date(comment.createdAt))}
                  </time>
                </div>
                <p className="mt-3 break-words whitespace-pre-wrap">{comment.text}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[var(--color-text-secondary)]">
                  <span>{comment.authorName}</span>
                  {comment.rentalId ? (
                    <Link
                      href={`/rentals/${comment.rentalId}`}
                      className="text-[var(--color-primary)]"
                    >
                      {comment.rentalLabel ?? 'Открыть аренду'}
                    </Link>
                  ) : null}
                </div>
                {canManage ? (
                  <div className="mt-3 flex flex-wrap justify-end gap-2">
                    <Button size="xs" variant="ghost" onClick={() => setEditing(comment)}>
                      <FiEdit2 /> Редактировать
                    </Button>
                    <form action={(data) => run(toggleClientCommentPinAction, data)}>
                      <input type="hidden" name="clientId" value={clientId} />
                      <input type="hidden" name="commentId" value={comment.id} />
                      <Button type="submit" size="xs" variant="ghost">
                        <FiMapPin /> {comment.isPinned ? 'Открепить' : 'Закрепить'}
                      </Button>
                    </form>
                    {comment.problemStatus === 'OPEN' ? (
                      <form action={(data) => run(resolveClientCommentAction, data)}>
                        <input type="hidden" name="clientId" value={clientId} />
                        <input type="hidden" name="commentId" value={comment.id} />
                        <Button
                          type="submit"
                          size="xs"
                          variant="ghost"
                          aria-label="Решить проблему"
                        >
                          <FiCheck /> Решить
                        </Button>
                      </form>
                    ) : null}
                    {canHideAny || comment.authorUserId === currentUserId ? (
                      <form action={(data) => run(hideClientCommentAction, data)}>
                        <input type="hidden" name="clientId" value={clientId} />
                        <input type="hidden" name="commentId" value={comment.id} />
                        <Button
                          type="submit"
                          size="xs"
                          variant="ghost"
                          aria-label="Скрыть комментарий"
                        >
                          <FiEyeOff /> Скрыть
                        </Button>
                      </form>
                    ) : null}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent>
              <p className="py-8 text-center text-sm text-[var(--color-text-secondary)]">
                Комментариев пока нет.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
