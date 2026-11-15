import type { ReactNode } from 'react';

import type { ContractPreviewViewModel } from '../domain/preview';

const penalties = [
  ['Утеря ключа зажигания', '25 000'],
  ['Утеря СТС', '10 000'],
  ['Утеря набора автомобилиста', '—'],
  ['Утеря регистрационного знака', '3 000'],
  ['Утеря люка бензобака', '3 000'],
  ['Порча панели приборов и обшивки салона', '10 000'],
  ['Порча сидений', '10 000'],
  ['Утеря огнетушителя, домкрата или знака аварийной остановки', '3 000'],
  ['Утеря запасного колеса', '8 000'],
  ['Порча резины, не подлежащая восстановлению, за единицу', '25 000'],
  ['Порча диска (вмятины, трещины), за единицу', '50 000'],
  ['Порча детали кузова', '25 000'],
  ['Порча стёкол', '10 000'],
  ['Несогласованная замена узлов, агрегатов или ремонт автомобиля', '50 000'],
  ['Превышение установленной максимальной скорости', '5 000'],
  ['Курение в автомобиле', '10 000'],
  ['Выезд представителя для урегулирования ситуации по вине Арендатора', '20 000'],
  ['Неуплата штрафов ГИБДД в установленный срок', '100%'],
  ['Просрочка арендной платы более чем на 14 суток', '3 000'],
  ['Оплата штрафов ГИБДД и платных дорог Арендодателем', '25%'],
  ['Эвакуация и возврат немытого автомобиля', '2 500'],
  ['Уклонение от совместного осмотра', '5 000'],
  ['Задержка возврата начиная со второго часа', '500 ₽ / час'],
  ['Задержка возврата свыше 3 часов', '1 сутки аренды'],
  ['Выезд для замены ТС в пределах МКАД', '3 000 ₽'],
  ['Выезд или замена за пределами МКАД', 'от 5 000 ₽'],
  ['Передача управления третьему лицу без согласования', '100 000 ₽'],
  ['Возврат автомобиля третьим лицом без согласования', '50 000 ₽'],
] as const;

function money(value: number | null) {
  if (value === null) return 'Не заполнено';
  return `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(value / 100)} ₽`;
}

function Variable({ children }: { children: ReactNode }) {
  return <span className="font-semibold text-[#ee0000]">{children}</span>;
}

function Page({ number, children }: { number: number; children: ReactNode }) {
  return (
    <section
      data-contract-page={number}
      aria-label={`Страница договора ${number} из 13`}
      className="relative mx-auto min-h-[48rem] w-full max-w-[46rem] overflow-hidden bg-white px-6 py-8 font-[Bahnschrift,Arial,sans-serif] text-[11px] leading-[1.42] text-black shadow-[0_18px_60px_rgba(0,0,0,0.24)] sm:px-10 sm:py-10"
    >
      {number > 1 && (
        <p className="mb-5 border-b border-neutral-400 pb-2 text-center text-[11px] font-bold text-[#ee0000] uppercase">
          Договор проката транспортного средства (без экипажа)
        </p>
      )}
      {children}
      <footer className="absolute right-8 bottom-5 left-8 grid grid-cols-[1fr_auto_1fr] items-end gap-4 border-t border-neutral-300 pt-2 text-[8px] text-neutral-600">
        <span>Арендодатель ____________</span>
        <b>{number}</b>
        <span className="text-right">Арендатор ____________</span>
      </footer>
    </section>
  );
}

function Heading({ children }: { children: ReactNode }) {
  return <h3 className="my-4 text-center text-[12px] font-bold uppercase">{children}</h3>;
}

function Clause({ number, children }: { number: string; children: ReactNode }) {
  return (
    <p className="mt-2 text-justify">
      <b>{number}</b> {children}
    </p>
  );
}

function PenaltyTable({ start, end }: { start: number; end: number }) {
  return (
    <table className="mt-3 w-full table-fixed border-collapse text-[9px] leading-[1.25]">
      <thead>
        <tr>
          <th className="w-8 border border-black p-1">п/н</th>
          <th className="border border-black p-1">Нарушение</th>
          <th className="w-24 border border-black p-1">Сумма штрафа</th>
        </tr>
      </thead>
      <tbody>
        {penalties.slice(start - 1, end).map(([label, amount], offset) => (
          <tr key={label}>
            <td className="border border-black p-1 text-center">{start + offset}.</td>
            <td className="border border-black p-1">{label}</td>
            <td className="border border-black p-1 text-center">{amount}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function ContractPreview({ preview }: { preview: ContractPreviewViewModel }) {
  return (
    <article aria-label="Документ договора" className="grid gap-5 pb-4">
      <div className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs text-[var(--color-text-secondary)]">
        Полный утверждённый шаблон · 13 страниц. Красным показаны поля, которые заполняет СУПА ПРО.
      </div>

      <Page number={1}>
        <p className="text-[#ee0000]">Договор № будет присвоен после подтверждения</p>
        <div className="mt-1 flex justify-between text-[#ee0000]">
          <span>
            г. <Variable>{preview.city}</Variable>
          </span>
          <span>{preview.date}</span>
        </div>
        <h2 className="mt-5 text-center text-[17px] font-bold text-[#ee0000] uppercase">
          Договор проката транспортного средства (без экипажа)
        </h2>
        <p className="mt-5 text-justify">
          <Variable>{preview.companyName}</Variable>, именуемый далее «Арендодатель», с одной
          стороны, и <Variable>{preview.client.fullName}</Variable>, телефон{' '}
          <Variable>{preview.client.phone}</Variable>, именуемый далее «Арендатор», с другой
          стороны, заключили настоящий договор о нижеследующем.
        </p>
        <Heading>1. Предмет договора</Heading>
        <Clause number="1.1.">
          Арендодатель предоставляет во временное пользование Арендатору автомобиль:
        </Clause>
        <table className="mt-2 w-full border-collapse">
          <tbody>
            {[
              ['Марка, модель', preview.vehicle.label],
              ['Регистрационный знак', preview.vehicle.registrationNumber],
              ['VIN', preview.vehicle.vin],
              ['Категория', 'B/M1'],
              ['Топливо', 'указывается по карточке автомобиля'],
            ].map(([label, value]) => (
              <tr key={label}>
                <td className="w-1/2 border border-black p-1.5 uppercase">{label}</td>
                <td className="border border-black p-1.5">
                  <Variable>{value}</Variable>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Clause number="1.2.">
          ТС предоставляется для личных нужд. Оценочная стоимость и комплектность фиксируются до
          подписания договора.
        </Clause>
        <Clause number="1.3.">
          Стоимость аренды составляет <Variable>{money(preview.rental.totalMinor)}</Variable>.
        </Clause>
        <Clause number="1.4.">
          Обеспечительный платёж — <Variable>{money(preview.rental.depositMinor)}</Variable>.
        </Clause>
        <Clause number="1.5.">
          Срок аренды: с <Variable>{preview.rental.startsAt}</Variable> по{' '}
          <Variable>{preview.rental.endsAt}</Variable>.
        </Clause>
        <Clause number="1.8.">
          Территория эксплуатации: <Variable>{preview.rental.territory}</Variable>.
        </Clause>
      </Page>

      <Page number={2}>
        <Heading>2. Действие договора</Heading>
        <Clause number="2.1.">
          Договор вступает в силу с момента его подписания обеими Сторонами и действует до полного
          исполнения обязательств.
        </Clause>
        <Heading>3. Срок проката</Heading>
        <Clause number="3.1.">Договор заключён с даты подписания Сторонами.</Clause>
        <Clause number="3.2.">
          Начало проката — <Variable>{preview.rental.startsAt}</Variable>. Окончание —{' '}
          <Variable>{preview.rental.endsAt}</Variable>.
        </Clause>
        <Clause number="3.3.">
          Место выдачи: <Variable>{preview.rental.pickupAddress}</Variable>. Место возврата:{' '}
          <Variable>{preview.rental.returnAddress}</Variable>.
        </Clause>
        <Heading>4. Стоимость услуг и порядок расчётов</Heading>
        <Clause number="4.1.">
          Общая арендная плата — <Variable>{money(preview.rental.totalMinor)}</Variable>.
          Обеспечительный платёж — <Variable>{money(preview.rental.depositMinor)}</Variable>.
        </Clause>
        <Clause number="4.2.">
          Оплата производится наличным или безналичным способом по согласованию Сторон.
        </Clause>
        <Clause number="4.4.">
          Включённый пробег и доплата за превышение определяются условиями действующей аренды.
        </Clause>
        <Clause number="4.5.">
          Дополнительные услуги и недостающее топливо оплачиваются отдельно.
        </Clause>
      </Page>

      <Page number={3}>
        <Heading>5. Порядок возврата и удержания залога</Heading>
        <Clause number="5.1.">
          Залог обеспечивает исполнение обязательств Арендатора и не является арендной платой.
        </Clause>
        <Clause number="5.2.">
          Возврат залога производится после осмотра автомобиля и проверки задолженности.
        </Clause>
        <Clause number="5.3.">
          Из залога могут быть удержаны документально подтверждённые суммы ущерба, штрафов, платных
          дорог, топлива и иных обязательств.
        </Clause>
        <Heading>6. Возврат автомобиля</Heading>
        <Clause number="6.1.">
          Автомобиль возвращается чистым, исправным, в полной комплектности и с согласованным
          уровнем топлива.
        </Clause>
        <Clause number="6.2.">
          При возврате Арендодатель проводит внешний и внутренний осмотр автомобиля.
        </Clause>
        <Clause number="6.3.">
          Состояние кузова, салона, шин, пробега, топлива и комплектности фиксируется на фото и
          видео.
        </Clause>
        <Clause number="6.4.">
          При задержке возврата Арендатор заранее уведомляет Арендодателя. Начиная со второго часа
          начисляется плата за каждый начавшийся час.
        </Clause>
        <Clause number="6.5.">
          При невозврате в срок Арендодатель вправе инициировать розыск и возврат ТС.
        </Clause>
      </Page>

      <Page number={4}>
        <Heading>7. Права и обязанности сторон</Heading>
        <h4 className="font-bold underline">7.1. Арендатор обязан:</h4>
        {[
          'осмотреть автомобиль и проверить его состояние и комплектность;',
          'бережно относиться к ТС и использовать его по назначению;',
          'контролировать масло, охлаждающую жидкость, давление в шинах и топливо;',
          'предоставить паспорт и водительское удостоверение;',
          'незамедлительно сообщать о неисправностях, повреждениях, ДТП и эвакуации;',
          'соблюдать Правила дорожного движения и согласованную территорию эксплуатации;',
          'не передавать управление лицам, не указанным в договоре.',
        ].map((item, index) => (
          <Clause key={item} number={`7.1.${index + 1}.`}>
            {item}
          </Clause>
        ))}
      </Page>

      <Page number={5}>
        <Heading>7. Права и обязанности сторон</Heading>
        <h4 className="font-bold underline">7.2. Арендатор обязан:</h4>
        {[
          'своевременно вносить арендную плату и иные предусмотренные договором платежи;',
          'обеспечивать сохранность автомобиля, ключей и документов;',
          'не использовать автомобиль в гонках, обучении вождению и буксировке без согласия;',
          'не выезжать за пределы разрешённой территории без письменного согласования;',
          'возместить расходы, возникшие по его вине;',
          'явиться на совместный осмотр и подписать документы возврата.',
        ].map((item, index) => (
          <Clause key={item} number={`7.2.${index + 1}.`}>
            {item}
          </Clause>
        ))}
        <p className="mt-5 rounded border border-[#ee0000] p-3">
          Особые условия: <Variable>{preview.rental.conditions}</Variable>
        </p>
      </Page>

      <Page number={6}>
        <Heading>7. Права и обязанности сторон</Heading>
        <h4 className="font-bold underline">7.3. Арендодатель обязан:</h4>
        <Clause number="7.3.1.">Передать исправный и укомплектованный автомобиль.</Clause>
        <Clause number="7.3.2.">
          Предоставить документы и сведения, необходимые для эксплуатации ТС.
        </Clause>
        <Clause number="7.3.3.">
          Принять автомобиль при возврате и провести осмотр в разумный срок.
        </Clause>
        <h4 className="mt-6 font-bold underline">7.4. Арендодатель вправе:</h4>
        <Clause number="7.4.1.">Контролировать местонахождение и состояние автомобиля.</Clause>
        <Clause number="7.4.2.">
          Потребовать досрочного возврата при существенном нарушении условий договора.
        </Clause>
        <Clause number="7.4.3.">
          Удержать из залога подтверждённые суммы задолженности и ущерба.
        </Clause>
      </Page>

      <Page number={7}>
        <Heading>8. Ответственность сторон</Heading>
        <Clause number="8.1.">
          За неисполнение обязательств Стороны несут ответственность по договору и законодательству
          Российской Федерации.
        </Clause>
        <Clause number="8.2.">
          Арендатор отвечает за сохранность автомобиля с момента передачи до возврата.
        </Clause>
        <Clause number="8.3.">
          Штрафы ГИБДД, платные дороги, парковки и эвакуация в период аренды оплачиваются
          Арендатором.
        </Clause>
        <Clause number="8.4.">
          Ущерб определяется по документам, осмотру, фото- и видеофиксации и заключению специалиста.
        </Clause>
        <Clause number="8.5.">
          Уплата штрафа не освобождает от исполнения основного обязательства.
        </Clause>
      </Page>

      <Page number={8}>
        <Heading>8. Ответственность сторон</Heading>
        <Clause number="8.6.">
          Арендатор возмещает документально подтверждённые расходы на восстановление,
          транспортировку и хранение ТС, возникшие по его вине.
        </Clause>
        <Clause number="8.7.">
          При ДТП Арендатор обязан вызвать уполномоченные службы и действовать по инструкции
          Арендодателя.
        </Clause>
        <Clause number="8.8.">
          Самовольный ремонт, разборка и изменение конструкции автомобиля запрещены.
        </Clause>
        <Clause number="8.9.">
          Ответственность за оставленные в автомобиле личные вещи несёт Арендатор.
        </Clause>
      </Page>

      <Page number={9}>
        <Heading>9. Страхование и обстоятельства непреодолимой силы</Heading>
        <Clause number="9.1.">
          Автомобиль эксплуатируется при наличии действующего полиса обязательного страхования.
        </Clause>
        <Clause number="9.2.">
          Арендатор соблюдает правила страхования и сообщает о страховом событии без задержки.
        </Clause>
        <Clause number="9.3.">
          Стороны освобождаются от ответственности при обстоятельствах непреодолимой силы при
          своевременном уведомлении другой стороны.
        </Clause>
        <Clause number="9.4.">
          Наличие обстоятельств непреодолимой силы подтверждается компетентным органом.
        </Clause>
      </Page>

      <Page number={10}>
        <Heading>10. Заключительные положения</Heading>
        <Clause number="10.1.">
          Изменения и дополнения действительны при их оформлении в письменной форме.
        </Clause>
        <Clause number="10.2.">
          Юридически значимые сообщения направляются по указанным Сторонами контактам.
        </Clause>
        <Clause number="10.3.">
          Споры разрешаются путём переговоров, а при недостижении соглашения — в установленном
          законом порядке.
        </Clause>
        <Clause number="10.4.">
          Договор составлен в двух экземплярах равной юридической силы.
        </Clause>
        <Clause number="10.5.">
          Подписанием договора Арендатор подтверждает ознакомление со всеми условиями и
          приложениями.
        </Clause>
      </Page>

      <Page number={11}>
        <Heading>11. Реквизиты и подписи сторон</Heading>
        <div className="mt-5 grid grid-cols-2 gap-5">
          <div className="border border-black p-3">
            <b>Арендодатель</b>
            <p className="mt-3">
              <Variable>{preview.companyName}</Variable>
            </p>
            <p className="mt-12 border-b border-black pb-1">Подпись</p>
          </div>
          <div className="border border-black p-3">
            <b>Арендатор</b>
            <p className="mt-3">
              <Variable>{preview.client.fullName}</Variable>
            </p>
            <p>
              <Variable>{preview.client.phone}</Variable>
            </p>
            <p className="mt-12 border-b border-black pb-1">Подпись</p>
          </div>
        </div>
        <div className="mt-16 text-center">
          <p className="font-bold text-[#ee0000]">Приложение № 1</p>
          <h3 className="mt-2 text-[15px] font-bold uppercase">Штрафы</h3>
          <p className="mt-3 text-neutral-700">
            Приложение является неотъемлемой частью договора проката транспортного средства.
          </p>
        </div>
      </Page>

      <Page number={12}>
        <Heading>Штрафы</Heading>
        <PenaltyTable start={1} end={14} />
      </Page>

      <Page number={13}>
        <Heading>Штрафы</Heading>
        <PenaltyTable start={15} end={28} />
        <p className="mt-5 text-justify">
          Размер фактического ущерба и расходов подтверждается документами. Подписи Сторон
          подтверждают ознакомление с приложением.
        </p>
      </Page>
    </article>
  );
}
