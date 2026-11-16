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

  it('собирает серию и номер, когда OCR разделил каждую цифру пробелами', () => {
    expect(parseRussianPassportOcr('45 18 6 2 1 4 3 1')).toMatchObject({
      passportSeries: '4518',
      passportNumber: '621431',
    });
  });

  it('различает дату выдачи и рождения в шумном OCR с пробелом внутри даты', () => {
    expect(
      parseRussianPassportOcr(`
        Паспорт выдан
        МЕЖРАЙОННЫМ ОТДЕЛОМ
        Дата выдачи 18.08. 2009 код подразделения 320-032
        Фамилия ЛОЙКО
        Имя АНТОН
        Отчество ВАСИЛЬЕВИЧ
        Дата 02.02.1989
        рождения
      `),
    ).toMatchObject({
      passportIssuedAt: '2009-08-18',
      birthDate: '1989-02-02',
    });
  });
});
