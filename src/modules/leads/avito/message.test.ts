import { describe, expect, it } from 'vitest';
import { incomingMessage, parseCallback, summarizeRequest, avitoId } from './message';

const enabledAt = new Date('2026-09-23T00:00:00Z');
const message = {
  id: 'm1',
  author_id: 22,
  created: enabledAt.getTime() / 1000 + 1,
  direction: 'in',
  type: 'text',
  content: { text: 'Нужна Camry на 5 дней. Телефон +7 (999) 123-45-67' },
};
describe('new Avito messages', () => {
  it('keeps explicit dates, pickup and budget as unconfirmed customer text', () => {
    const result = summarizeRequest(
      'Нужна Polo с 25.09 по 30.09. Бюджет до 3500 руб в сутки. Подача: Москва, улица Ленина 10',
    );
    expect(result.lines.join('\n')).toContain('25.09 по 30.09');
    expect(result.lines.join('\n')).toContain('3500 руб');
    expect(result.lines.join('\n')).toContain('Москва, улица Ленина 10');
  });
  it('accepts only authoritative incoming messages after activation', () => {
    expect(incomingMessage(message, '11', enabledAt)?.text).toContain('Camry');
    for (const change of [
      { created: 1 },
      { direction: 'out' },
      { author_id: 11 },
      { type: 'system' },
    ]) {
      expect(incomingMessage({ ...message, ...change }, '11', enabledAt)).toBeNull();
    }
  });
  it('does not trust webhook message text and rejects another account', () => {
    const callback = {
      payload: {
        type: 'message',
        value: { id: 'm1', chat_id: 'u2i-123', user_id: 11, content: { text: 'spoofed' } },
      },
    };
    expect(parseCallback(callback, '11')).toEqual({ messageId: 'm1', chatId: 'u2i-123' });
    expect(parseCallback(callback, '12')).toBeNull();
    expect(
      parseCallback({ payload: { value: { id: '../x', chat_id: 'x', user_id: 11 } } }, '11'),
    ).toBeNull();
  });
  it('extracts explicit data without inventing dates or phone', () => {
    const result = summarizeRequest(message.content.text);
    expect(result.phone).toBe('79991234567');
    expect(result.lines).toContain('Длительность: 5 дней');
    expect(result.lines).toContain('Модель в сообщении: Camry');
    expect(summarizeRequest('Здравствуйте, нужна машина').phone).toBe('');
    expect(summarizeRequest('на 5 дней или на 10 дней').lines).toContain(
      'Длительность: нужно уточнить',
    );
  });
  it('uses tenant/account/chat scoped IDs', () => {
    expect(avitoId('c', 'a', 'chat')).toBe(avitoId('c', 'a', 'chat'));
    expect(avitoId('c2', 'a', 'chat')).not.toBe(avitoId('c', 'a', 'chat'));
    expect(avitoId('c', 'a', 'chat', 'm')).not.toBe(avitoId('c', 'a', 'chat'));
  });
});
it.each(['8.916.717.65.56', '+79167176556', '8 (916) 717-65-56', '7/916/717/65/56'])(
  'normalizes a supplied phone %s',
  (phone) => {
    expect(summarizeRequest(phone).phone).toBe('79167176556');
  },
);
it.each(['891671765560', '8916717655', '123456789167176556'])(
  'rejects the wrong digit count %s',
  (phone) => {
    expect(summarizeRequest(phone).phone).toBe('');
  },
);
