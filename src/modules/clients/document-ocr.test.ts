import { describe, expect, it } from 'vitest';

import {
  mergeClientOcrSupplementalTexts,
  parseClientDocumentOcr,
  recognizeBestClientOcrCandidate,
  selectBestClientOcrCandidate,
} from './document-ocr';

describe('parseClientDocumentOcr', () => {
  it('добавляет номер прав из отдельного увеличенного фрагмента', () => {
    expect(
      mergeClientOcrSupplementalTexts(
        'DRIVER_LICENSE',
        '4a 14.04.2021 4b 14.04.2031 5. 99 18',
        ['99 18', '99 18 956464'],
      ),
    ).toMatchObject({
      driverLicense: '99 18 956464',
      driverLicenseIssuedAt: '2021-04-14',
      driverLicenseExpiresAt: '2031-04-14',
    });
  });

  it('не заменяет уже распознанные даты шумом из фрагмента с номером', () => {
    expect(
      mergeClientOcrSupplementalTexts(
        'DRIVER_LICENSE',
        '02.02.1989 14.04.2021 14.04.2031',
        ['14.04.2023 14.04.2034 99 18 956464'],
      ),
    ).toEqual({
      driverLicense: '99 18 956464',
      driverLicenseIssuedAt: '2021-04-14',
      driverLicenseExpiresAt: '2031-04-14',
    });
  });

  it('выбирает поворот, в котором распознаны ключевые поля документа', () => {
    expect(
      selectBestClientOcrCandidate('DRIVER_LICENSE', [
        { rotation: 0, text: '14.04.2031' },
        { rotation: 270, text: '4a 14.04.2021 4b 14.04.2031 5. 99 18 956464' },
        { rotation: 90, text: 'неразборчиво' },
      ]),
    ).toEqual({
      rotation: 270,
      fields: {
        driverLicense: '99 18 956464',
        driverLicenseIssuedAt: '2021-04-14',
        driverLicenseExpiresAt: '2031-04-14',
      },
      text: '4a 14.04.2021 4b 14.04.2031 5. 99 18 956464',
    });
  });

  it('проверяет следующий поворот и останавливается после достаточного результата', async () => {
    const recognizedRotations: number[] = [];
    const result = await recognizeBestClientOcrCandidate(
      'DRIVER_LICENSE',
      [
        { rotation: 0, bytes: new Uint8Array([0]) },
        { rotation: 270, bytes: new Uint8Array([1]) },
        { rotation: 90, bytes: new Uint8Array([2]) },
      ],
      async (candidate) => {
        recognizedRotations.push(candidate.rotation);
        return candidate.rotation === 270
          ? '4a 14.04.2021 4b 14.04.2031 5. 99 18 956464'
          : '14.04.2031';
      },
    );

    expect(recognizedRotations).toEqual([0, 270]);
    expect(result.rotation).toBe(270);
    expect(result.fields.driverLicense).toBe('99 18 956464');
  });

  it('распознаёт основной разворот российского паспорта', () => {
    expect(
      parseClientDocumentOcr(
        'PASSPORT_MAIN',
        `
          ВЫДАН ОВД Тверского района г. Москвы
          12.03.2018 код подразделения 770-001
          45 18 123456
          ФАМИЛИЯ ИВАНОВ
          ИМЯ ИВАН
          ОТЧЕСТВО ИВАНОВИЧ
          20.04.1990
        `,
      ),
    ).toMatchObject({
      lastName: 'ИВАНОВ',
      firstName: 'ИВАН',
      middleName: 'ИВАНОВИЧ',
      birthDate: '1990-04-20',
      passportSeries: '4518',
      passportNumber: '123456',
      passportIssuedAt: '2018-03-12',
      passportDivisionCode: '770-001',
    });
  });

  it('извлекает адрес со страницы регистрации паспорта', () => {
    expect(
      parseClientDocumentOcr(
        'PASSPORT_REGISTRATION',
        `
          ЗАРЕГИСТРИРОВАН ПО МЕСТУ ЖИТЕЛЬСТВА
          Г. МОСКВА, УЛ. РУДНЁВКА, Д. 3,
          КВ. 139
          11.12.2012
        `,
      ),
    ).toEqual({ registrationAddress: 'Г. МОСКВА, УЛ. РУДНЁВКА, Д. 3, КВ. 139' });
  });

  it('извлекает номер и сроки водительского удостоверения', () => {
    expect(
      parseClientDocumentOcr(
        'DRIVER_LICENSE',
        `
          ВОДИТЕЛЬСКОЕ УДОСТОВЕРЕНИЕ
          4a. 03.09.2021
          4b. 03.09.2031
          5. 99 24 267195
          категории B, B1, C, C1, M
        `,
      ),
    ).toEqual({
      driverLicense: '99 24 267195',
      driverLicenseIssuedAt: '2021-09-03',
      driverLicenseExpiresAt: '2031-09-03',
    });
  });

  it('извлекает номер и даты прав из реального OCR без цифровых меток полей', () => {
    expect(
      parseClientDocumentOcr(
        'DRIVER_LICENSE',
        `
          ВОДИТЕЛЬСКОЕ УДОСТОВЕРЕНИЕ
          ИВАНОВ ИВАН ИВАНОВИЧ
          09.09.1996
          04.10.2014 04.10.2024
          ГИБДД 6415
          64 16 676795
        `,
      ),
    ).toEqual({
      driverLicense: '64 16 676795',
      driverLicenseIssuedAt: '2014-10-04',
      driverLicenseExpiresAt: '2024-10-04',
    });
  });

  it('не придумывает значения из неразборчивого текста', () => {
    expect(parseClientDocumentOcr('PASSPORT_REGISTRATION', 'неразборчиво')).toEqual({});
    expect(parseClientDocumentOcr('DRIVER_LICENSE', 'неразборчиво')).toEqual({});
  });
});
