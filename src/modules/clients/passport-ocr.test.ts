import { describe, expect, it } from 'vitest';

import { parseRussianPassportOcr } from './passport-ocr';

describe('parseRussianPassportOcr', () => {
  it('извлекает только уверенно распознанные паспортные поля', () => {
    expect(
      parseRussianPassportOcr(`
        ВЫДАН ОВД Тверского района г. Москвы
        12.03.2018 код подразделения 770-001
        45 18 123456
        ФАМИЛИЯ ИВАНОВ
        ИМЯ ИВАН
        ОТЧЕСТВО ИВАНОВИЧ
        20.04.1990
      `),
    ).toMatchObject({
      lastName: 'ИВАНОВ',
      firstName: 'ИВАН',
      middleName: 'ИВАНОВИЧ',
      passportSeries: '4518',
      passportNumber: '123456',
      passportIssuedAt: '2018-03-12',
      passportDivisionCode: '770-001',
      birthDate: '1990-04-20',
    });
  });

  it('оставляет отсутствующие поля пустыми', () => {
    expect(parseRussianPassportOcr('неразборчивое изображение')).toEqual({});
  });
});
