import { readFile } from 'node:fs/promises';

import JSZip from 'jszip';

import { resolveRentalMileagePolicy } from '../../domain/mileage-policy';
import type { RentalSnapshot } from '../../domain/build-snapshot';

const TEMPLATE_PATH = new URL('../templates/rental-contract-v2.docx', import.meta.url);

const blank = '—';

function text(value: unknown) {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return blank;
}

function optionalText(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function number(value: unknown) {
  return typeof value === 'number' && Number.isSafeInteger(value) ? value : null;
}

function xml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function decodeXmlText(value: string) {
  return value
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&amp;', '&');
}

function replaceVisibleText(source: string, from: string, to: string, replaceEvery: boolean) {
  if (!from || from === to) return source;
  let result = source;
  do {
    const nodes = [...result.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/gu)].map((match) => ({
      start: match.index,
      end: (match.index ?? 0) + match[0].length,
      openEnd: (match.index ?? 0) + match[0].indexOf('>') + 1,
      closeStart: (match.index ?? 0) + match[0].lastIndexOf('</w:t>'),
      text: decodeXmlText(match[1] ?? ''),
    }));
    const visible = nodes.map((node) => node.text).join('');
    const exactStart = visible.indexOf(from);
    const compactIndexes: number[] = [];
    let compactVisible = '';
    for (let index = 0; index < visible.length; index += 1) {
      if (/\s/u.test(visible[index] ?? '')) continue;
      compactVisible += visible[index];
      compactIndexes.push(index);
    }
    const compactFrom = from.replaceAll(/\s/gu, '');
    const compactStart = exactStart < 0 ? compactVisible.indexOf(compactFrom) : -1;
    if (exactStart < 0 && compactStart < 0) break;
    const start =
      exactStart >= 0 ? exactStart : (compactIndexes[compactStart] ?? Number.POSITIVE_INFINITY);
    const end =
      exactStart >= 0
        ? exactStart + from.length
        : (compactIndexes[compactStart + compactFrom.length - 1] ?? start) + 1;
    let cursor = 0;
    const touched = nodes.filter((node) => {
      const nodeStart = cursor;
      cursor += node.text.length;
      return nodeStart < end && cursor > start;
    });
    if (touched.length === 0) break;

    cursor = 0;
    let firstVisibleStart = 0;
    for (const node of nodes) {
      if (node === touched[0]) {
        firstVisibleStart = cursor;
        break;
      }
      cursor += node.text.length;
    }
    const last = touched.at(-1)!;
    let lastVisibleStart = firstVisibleStart;
    for (const node of touched.slice(0, -1)) lastVisibleStart += node.text.length;
    const prefix = touched[0].text.slice(0, start - firstVisibleStart);
    const suffix = last.text.slice(end - lastVisibleStart);
    const edits = touched.map((node, index) => ({
      start: node.openEnd,
      end: node.closeStart,
      replacement: index === 0 ? xml(`${prefix}${to}${suffix}`) : '',
    }));
    for (const edit of edits.reverse()) {
      result = result.slice(0, edit.start) + edit.replacement + result.slice(edit.end);
    }
  } while (replaceEvery);
  return result;
}

function replaceAll(source: string, from: string, to: string) {
  return replaceVisibleText(source, from, to, !to.includes(from));
}

function replaceFirst(source: string, from: string, to: string) {
  return replaceVisibleText(source, from, to, false);
}

function cellText(source: string) {
  return [...source.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/gu)]
    .map((match) => decodeXmlText(match[1] ?? ''))
    .join('');
}

function setCellText(source: string, value: string) {
  let written = false;
  return source.replace(
    /(<w:t(?:\s[^>]*)?>)([\s\S]*?)(<\/w:t>)/gu,
    (_whole, open: string, _content: string, close: string) => {
      if (written) return `${open}${close}`;
      written = true;
      return `${open}${xml(value)}${close}`;
    },
  );
}

function replaceTableRow(
  source: string,
  expectedCells: readonly string[],
  values: readonly string[],
) {
  return source.replace(/<w:tr[\s\S]*?<\/w:tr>/gu, (row) => {
    const cells = [...row.matchAll(/<w:tc[\s\S]*?<\/w:tc>/gu)];
    if (
      cells.length !== expectedCells.length ||
      cells.some((cell, index) => cellText(cell[0]) !== expectedCells[index])
    ) {
      return row;
    }
    let result = row;
    for (let index = cells.length - 1; index >= 0; index -= 1) {
      const cell = cells[index]!;
      const start = cell.index ?? 0;
      result =
        result.slice(0, start) +
        setCellText(cell[0], values[index] ?? '') +
        result.slice(start + cell[0].length);
    }
    return result;
  });
}

function date(value: string) {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Moscow',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value));
}

function dateTime(value: string) {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Moscow',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(value));
}

function time(value: string) {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Moscow',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(value));
}

function money(value: unknown) {
  const minor = number(value);
  if (minor === null) return blank;
  return `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 })
    .format(minor / 100)
    .replaceAll('\u00a0', ' ')} рублей`;
}

function dayLabel(value: number) {
  const lastTwo = value % 100;
  const last = value % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return 'суток';
  if (last === 1) return 'сутки';
  if (last >= 2 && last <= 4) return 'суток';
  return 'суток';
}

function initials(fullName: string) {
  const parts = fullName.split(/\s+/u).filter(Boolean);
  if (parts.length === 0) return blank;
  return `${parts[0]} ${parts
    .slice(1, 3)
    .map((part) => `${part[0] ?? ''}.`)
    .join('')}`;
}

function rentalDays(snapshot: RentalSnapshot) {
  const stored = number(snapshot.rental.days);
  if (stored && stored > 0) return stored;
  const difference =
    new Date(snapshot.rental.endsAt).getTime() - new Date(snapshot.rental.startsAt).getTime();
  return Math.max(1, Math.ceil(difference / 86_400_000));
}

function vehicleName(snapshot: RentalSnapshot) {
  return (
    [optionalText(snapshot.vehicle.make), optionalText(snapshot.vehicle.model)]
      .filter(Boolean)
      .join(' ') || blank
  );
}

function insurance(snapshot: RentalSnapshot) {
  return (
    [optionalText(snapshot.vehicle.osagoInsurer), optionalText(snapshot.vehicle.osagoPolicyNumber)]
      .filter(Boolean)
      .join(' ') || blank
  );
}

function companyRequisites(snapshot: RentalSnapshot) {
  return [
    text(snapshot.company.legalName),
    `ИНН ${text(snapshot.company.inn)}`,
    optionalText(snapshot.company.kpp) ? `КПП ${snapshot.company.kpp}` : null,
    optionalText(snapshot.company.ogrn) ? `ОГРН ${snapshot.company.ogrn}` : null,
    optionalText(snapshot.company.address) ? `адрес: ${snapshot.company.address}` : null,
    optionalText(snapshot.company.bankName) ? `банк: ${snapshot.company.bankName}` : null,
    optionalText(snapshot.company.settlementAccount)
      ? `р/с ${snapshot.company.settlementAccount}`
      : null,
    optionalText(snapshot.company.correspondentAccount)
      ? `к/с ${snapshot.company.correspondentAccount}`
      : null,
    optionalText(snapshot.company.bik) ? `БИК ${snapshot.company.bik}` : null,
  ]
    .filter(Boolean)
    .join(', ');
}

function dynamicDocumentXml(source: string, snapshot: RentalSnapshot, contractNumber: string) {
  const start = date(snapshot.rental.startsAt);
  const end = date(snapshot.rental.endsAt);
  const startAt = dateTime(snapshot.rental.startsAt);
  const endAt = dateTime(snapshot.rental.endsAt);
  const days = rentalDays(snapshot);
  const clientName = text(snapshot.client.fullName);
  const clientBirthDate = text(snapshot.client.birthDate);
  const clientPassport = text(snapshot.client.passport);
  const clientRegistration = text(snapshot.client.registrationAddress);
  const clientPhone = text(snapshot.client.phone);
  const clientLicence =
    [
      optionalText(snapshot.client.licenseNumber),
      optionalText(snapshot.client.licenseIssuedAt)
        ? `выдано ${date(String(snapshot.client.licenseIssuedAt))}`
        : null,
      optionalText(snapshot.client.licenseExpiresAt)
        ? `действительно до ${date(String(snapshot.client.licenseExpiresAt))}`
        : null,
    ]
      .filter(Boolean)
      .join(', ') || blank;
  const allowedDrivers = text(snapshot.issuance?.allowedDrivers ?? clientName);
  const car = vehicleName(snapshot);
  const pickup = text(snapshot.issuance?.pickupAddress ?? snapshot.rental.pickupAddress);
  const returns = text(snapshot.issuance?.returnAddress ?? snapshot.rental.returnAddress);
  const territory = text(snapshot.issuance?.territory);
  const companyPhone = text(snapshot.company.phone);
  const landlord = text(snapshot.company.legalName);
  const signatory = text(snapshot.company.signatoryName);
  const signatoryAuthority = text(snapshot.company.signatoryAuthority);
  const dailyRate = money(snapshot.vehicle.dailyMinor);
  const total = money(snapshot.rental.agreedTotalMinor);
  const deposit = money(snapshot.rental.depositMinor);
  const mileagePolicy = resolveRentalMileagePolicy({
    agreementType:
      (snapshot as RentalSnapshot & { agreementType?: string }).agreementType === 'LEASE_TO_OWN'
        ? 'LEASE_TO_OWN'
        : 'STANDARD',
    billableDays: days,
    includedMileageKm: number(snapshot.vehicle.includedMileageKm),
  });
  const mileageClause =
    mileagePolicy.totalLimitKm === null
      ? 'Лимит пробега не установлен.'
      : `включённый пробег ${mileagePolicy.dailyLimitKm} км/сутки, всего ${mileagePolicy.totalLimitKm} км.`;
  const returnState = [
    snapshot.issuance?.returnMileageKm !== null && snapshot.issuance?.returnMileageKm !== undefined
      ? `пробег ${text(snapshot.issuance.returnMileageKm)} км`
      : null,
    snapshot.issuance?.returnFuelPercent !== null &&
    snapshot.issuance?.returnFuelPercent !== undefined
      ? `топливо ${text(snapshot.issuance.returnFuelPercent)}%`
      : null,
  ].filter(Boolean);
  const paymentTerms = optionalText(snapshot.issuance?.paymentTerms);

  let result = source;
  result = replaceAll(
    result,
    'ИП Медведев Сергей Викторович, 27.04.1973 г.р., паспорт 45 18 № 621431, выдан ГУ МВД России по г. Москве 14.05.2018 г., ОГРНИП 326774600538979, ИНН 772500473517, именуемый далее «Арендодатель», с одной стороны, и ',
    `${landlord}, ИНН ${text(snapshot.company.inn)}, в лице ${signatory}, действующего на основании ${signatoryAuthority}, именуемый далее «Арендодатель», с одной стороны, и `,
  );
  result = replaceAll(
    result,
    '1.7. К управлению ТС допущен только Кульпинёв Александр Витальевич, 17.08.1998 г.р., водительское удостоверение 99 28 № 614351, выдано 30.07.2024, действительно до 18.04.2028, категории B, B1, M.',
    `1.7. К управлению ТС допущены: ${allowedDrivers}. Данные основного водителя: ${clientName}, ${clientBirthDate} г.р., водительское удостоверение ${clientLicence}.`,
  );
  result = replaceAll(
    result,
    '1.5. Договор заключён на период с 18.10.2026 ____ ч. ____ мин. по 18.11.2026 ____ ч. ____ мин. (один календарный месяц, 31 сутки). Время выдачи и возврата проставляется Сторонами при подписании. Продление — по соглашению Сторон.',
    `1.5. Договор заключён на период с ${startAt} по ${endAt} (${days} ${dayLabel(days)}). Продление — по соглашению Сторон.`,
  );
  result = replaceAll(
    result,
    '3.2. Начало проката — 18.10.2026, ____:____. Окончание — 18.11.2026, ____:____. Срок — один календарный месяц (31 сутки). Место выдачи и возврата: г. Москва, Зелёный проспект, д. 22, либо иное согласованное место.',
    `3.2. Начало проката — ${startAt}. Окончание — ${endAt}. Срок — ${days} ${dayLabel(days)}. Место выдачи: ${pickup}. Место возврата: ${returns}.`,
  );
  result = replaceTableRow(
    result,
    ['Начало проката', '18.11.2026, ____ ч. ____ мин.'],
    ['Начало проката', startAt],
  );
  result = replaceTableRow(
    result,
    ['18.11.2026, ____ ч. ____ мин.', '18.11.2026, ____ ч. ____ мин.'],
    ['Окончание проката', endAt],
  );
  result = replaceTableRow(
    result,
    ['31 сутки', '31 сутки'],
    ['Общее количество суток', `${days} ${dayLabel(days)}`],
  );
  result = replaceAll(result, '18.10.2026', start);
  result = replaceAll(result, '18.11.2026', end);
  result = replaceAll(result, '19.10.2026', start);
  for (const [from, to] of [
    ['ME-2026-1018-BMW', contractNumber],
    ['Кульпинёв Александр Витальевич', clientName],
    ['Кульпинёва Александра Витальевича', clientName],
    ['17.08.1998', clientBirthDate],
    ['24.09.2002', clientBirthDate],
    [
      '23 24 № 211104, выдан МВД по Донецкой Народной Республике 08.12.2025, код подразделения 800-027',
      clientPassport,
    ],
    [
      '23 24 № 211104, выдан МВД по Донецкой Народной Республике 08.12.2025, код 800-027',
      clientPassport,
    ],
    ['45 23 № 172261, выдан ГУ МВД России по г. Москве 04.10.2022, код 770-091', clientPassport],
    ['99 28 № 614351, выдано 30.07.2024, действительно до 18.04.2028, B, B1, M', clientLicence],
    ['BMW 520D XDRIVE', car.toUpperCase()],
    ['BMW 520d xDrive', car],
    ['В415ЕВ250', text(snapshot.vehicle.registrationNumber)],
    ['VIN: уточнить по оригиналу СТС', text(snapshot.vehicle.vin)],
    ['B/M1', text(snapshot.vehicle.bodyType ?? 'B/M1')],
    ['Чёрный', text(snapshot.vehicle.color)],
    ['Дизельное топливо', text(snapshot.vehicle.fuelType)],
    ['СТС: номер уточнить', text(snapshot.vehicle.registrationCertificateNumber)],
    ['Уточнить по действующему полису BMW', insurance(snapshot)],
    ['2019', text(snapshot.vehicle.year)],
    ['Кульпинёв А.В.', initials(clientName)],
    ['8 (977) 768-90-44', clientPhone],
    ['8 (917) 576-11-77', companyPhone],
  ] as const) {
    result = replaceAll(result, from, to);
  }
  result = replaceAll(
    result,
    'время: ____ ч. ____ мин.',
    `время: ${time(snapshot.rental.startsAt)}.`,
  );
  result = replaceAll(
    result,
    'Топливо: дизельное топливо.',
    `Топливо: ${text(snapshot.vehicle.fuelType)}.`,
  );

  result = replaceAll(
    result,
    'зарегистрированный по адресу: ________________________, тел.: ____________________',
    `зарегистрированный по адресу: ${clientRegistration}, тел.: ${clientPhone}`,
  );
  result = replaceAll(
    result,
    'Регистрация: ____________________. Тел.: ____________________.',
    `Регистрация: ${clientRegistration}. Тел.: ${clientPhone}.`,
  );
  result = replaceAll(
    result,
    'Регистрация: г. Москва, ул. Дубравная, д. 43, кв. 19. Тел.: ' + clientPhone + '.',
    `Регистрация: ${clientRegistration}. Тел.: ${clientPhone}.`,
  );
  result = replaceAll(
    result,
    '1.3. Размер арендной платы составляет 7 000 (Семь тысяч) рублей за сутки. Срок аренды — один календарный месяц с ' +
      `${start} по ${end} (31 сутки). Общая стоимость аренды — 217 000 (Двести семнадцать тысяч) рублей. Залог составляет 25 000 (Двадцать пять тысяч) рублей и оплачивается отдельно.`,
    `1.3. Размер арендной платы составляет ${dailyRate} за сутки. Срок аренды — ${days} ${dayLabel(days)} с ${start} по ${end}. Общая стоимость аренды — ${total}. Залог составляет ${deposit} и оплачивается отдельно.`,
  );
  result = replaceAll(
    result,
    '1.4. Арендатор уплачивает залог 25 000 (Двадцать пять тысяч) рублей. Порядок возврата залога определяется разделом 5 настоящего Договора.',
    `1.4. Арендатор уплачивает залог ${deposit}. Порядок возврата залога определяется разделом 5 настоящего Договора.`,
  );
  result = replaceAll(
    result,
    `1.5. Договор заключён на период с ${start} ____ ч. ____ мин. по ${end} ____ ч. ____ мин. (один календарный месяц, 31 сутки). Время выдачи и возврата проставляется Сторонами при подписании. Продление — по соглашению Сторон.`,
    `1.5. Договор заключён на период с ${startAt} по ${endAt} (${days} ${dayLabel(days)}). Продление — по соглашению Сторон.`,
  );
  result = replaceAll(
    result,
    '1.6. Пробег при передаче: 84 544 км. Уровень топлива при передаче: 75%. Топливо: дизельное.',
    `1.6. Пробег при передаче: ${text(snapshot.issuance?.startMileageKm)} км. Уровень топлива при передаче: ${text(snapshot.issuance?.startFuelPercent)}%. Топливо: ${text(snapshot.vehicle.fuelType)}.`,
  );
  result = replaceAll(
    result,
    '1.8. Территория эксплуатации: Москва и Московская область.',
    `1.8. Территория эксплуатации: ${territory}.`,
  );
  result = replaceAll(
    result,
    `3.2. Начало проката — ${start}, ____:____. Окончание — ${end}, ____:____. Срок — один календарный месяц (31 сутки). Место выдачи и возврата: г. Москва, Зелёный проспект, д. 22, либо иное согласованное место.`,
    `3.2. Начало проката — ${startAt}. Окончание — ${endAt}. Срок — ${days} ${dayLabel(days)}. Место выдачи: ${pickup}. Место возврата: ${returns}.`,
  );
  result = replaceFirst(result, 'г. Москва, Зеленый проспект, д. 22', pickup);
  result = replaceFirst(result, 'г. Москва, Зеленый проспект, д. 22', returns);
  result = replaceAll(
    result,
    '4.1. Общая арендная плата за один календарный месяц (31 сутки) составляет 217 000 (Двести семнадцать тысяч) рублей и вносится одним платежом ' +
      `${start}, в понедельник, не позднее 23:59 по московскому времени. Залог 25 000 (Двадцать пять тысяч) рублей вносится при передаче автомобиля отдельно от арендной платы. Итого за аренду и залог — 242 000 (Двести сорок две тысячи) рублей. Арендатор принимает ТС до наступления согласованного срока внесения месячной платы.`,
    `4.1. Общая арендная плата за ${days} ${dayLabel(days)} составляет ${total}. Залог ${deposit} вносится отдельно при передаче автомобиля.`,
  );
  result = replaceAll(result, '31 сутки', `${days} ${dayLabel(days)}`);
  result = replaceAll(
    result,
    '4.4. Включённый суточный пробег составляет 200 км. За каждый километр превышения установленного лимита Арендатор оплачивает 10 рублей. Общий лимит определяется количеством фактически оплаченных суток.',
    `4.4. ${mileageClause} За каждый километр превышения Арендатор оплачивает ${money(snapshot.vehicle.overageMileagePriceMinor)}.`,
  );
  result = replaceAll(
    result,
    '150 рублей за каждый недостающий литр',
    `${money(snapshot.vehicle.missingFuelPriceMinor)} за каждый недостающий литр`,
  );
  if (paymentTerms) {
    result = replaceAll(
      result,
      '4.2. Оплата по настоящему Договору осуществляется следующим способом: путем наличного внесения денежных средств в кассу Арендодателя/ безналичного перечисления денежных средств на расчетный счет Арендодателя/иное..',
      `4.2. Условия оплаты: ${paymentTerms}.`,
    );
  }
  if (returnState.length > 0) {
    result = replaceAll(
      result,
      'Возврат осуществляется в согласованном сторонами месте сдачи автомобиля.',
      `Возврат осуществляется в согласованном сторонами месте сдачи автомобиля. Зафиксировано при возврате: ${returnState.join(', ')}.`,
    );
  }
  result = replaceAll(
    result,
    'ИП Медведев Сергей Викторович, ИНН 772500473517, Расчётный счёт 40802810338720099452, ОГРНИП 326774600538979, Банк получателя ПАО Сбербанк, Корсчёт 30101810400000000225, БИК 044525225, ИНН Банка 7707083893, КПП 773643001',
    companyRequisites(snapshot),
  );
  result = replaceAll(result, '/Медведев С.В./', `/${initials(signatory)}/`);

  for (const forbidden of ['Кульпинёв', 'BMW 520D XDRIVE', 'В415ЕВ250']) {
    if (result.includes(forbidden)) {
      throw new Error(`Шаблон договора содержит незаменённое значение: ${forbidden}`);
    }
  }
  return result;
}

export async function generateApprovedRentalDocx(
  snapshot: RentalSnapshot,
  contractNumber: string,
): Promise<Uint8Array> {
  const bytes = await readFile(TEMPLATE_PATH);
  const archive = await JSZip.loadAsync(bytes);
  for (const partName of ['word/document.xml', 'word/header1.xml']) {
    const part = archive.file(partName);
    if (!part) throw new Error(`В шаблоне договора отсутствует ${partName}.`);
    const source = await part.async('string');
    archive.file(partName, dynamicDocumentXml(source, snapshot, contractNumber));
  }
  return archive.generateAsync({
    type: 'uint8array',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
  });
}
