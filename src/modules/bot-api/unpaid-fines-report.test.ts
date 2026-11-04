import { describe, expect, it } from 'vitest';

import { formatUnpaidFinesReport } from './unpaid-fines-report';

describe('formatUnpaidFinesReport', () => {
  it('formats unpaid fines with client, violation, amounts and discount deadline', () => {
    const message = formatUnpaidFinesReport('2026-09-16', [
      {
        decreeNumber: '18810550260831038048',
        clientLastName: 'Иванов <script>',
        vehicle: 'Kia Cerato',
        registrationNumber: 'С886АУ997',
        violation: 'Превышение скорости > 20 км/ч',
        originalAmountMinor: '500000',
        currentAmountMinor: '250000',
        offenseAt: new Date('2026-09-14T09:30:00.000Z'),
        discountExpiresAt: new Date('2026-09-25T20:59:59.000Z'),
        status: 'UNPAID',
      },
    ]);

    expect(message).toContain('Неоплаченные штрафы');
    expect(message).toContain('📊 <b>Сводка</b>\n├ Дата: 16 сентября 2026 г.\n└ Всего: <b>1</b>');
    expect(message).toContain('🚨 <b>Штраф 1</b>');
    expect(message).toContain('├ Клиент: <b>Иванов &lt;script&gt;</b>');
    expect(message).toContain('Иванов &lt;script&gt;');
    expect(message).not.toContain('<script>');
    expect(message).toContain('Превышение скорости &gt; 20 км/ч');
    expect(message).toContain('Постановление № <code>18810550260831038048</code>');
    expect(message).toContain('Полная сумма: <b>5 000 ₽</b>');
    expect(message).toContain('К оплате: <b>2 500 ₽</b>');
    expect(message).toContain('Скидка до: <b>25.09.2026</b>');
  });

  it('uses explicit fallbacks for missing client and discount deadline', () => {
    const message = formatUnpaidFinesReport('2026-09-16', [
      {
        decreeNumber: '18810550260831038049',
        clientLastName: null,
        vehicle: 'Автомобиль не определён',
        registrationNumber: null,
        violation: 'Нарушение не указано',
        originalAmountMinor: '100000',
        currentAmountMinor: '100000',
        offenseAt: new Date('2026-09-15T09:30:00.000Z'),
        discountExpiresAt: null,
        status: 'OVERDUE',
      },
    ]);

    expect(message).toContain('Клиент: <b>Клиент не назначен</b>');
    expect(message).toContain('Срок скидки: <b>не указан</b>');
    expect(message).toContain('Статус: <b>Просрочен</b>');
  });

  it('sends a useful separate message when there are no unpaid fines', () => {
    expect(formatUnpaidFinesReport('2026-09-16', [])).toContain('Неоплаченных штрафов нет');
  });
});
