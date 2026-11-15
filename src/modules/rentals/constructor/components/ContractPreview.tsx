import type { ContractPreviewViewModel } from '../domain/preview';

function money(value: number | null) {
  if (value === null) return 'Не заполнено';
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(value / 100);
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-0.5 border-b border-neutral-200 pb-2">
      <dt className="text-[10px] font-semibold tracking-[0.08em] text-neutral-500 uppercase">
        {label}
      </dt>
      <dd className="text-[13px] font-medium text-neutral-950">{value}</dd>
    </div>
  );
}

export function ContractPreview({ preview }: { preview: ContractPreviewViewModel }) {
  return (
    <article
      aria-label="Документ договора"
      className="mx-auto min-h-[52rem] w-full max-w-[46rem] overflow-hidden rounded-sm bg-white px-5 py-7 text-neutral-950 shadow-[0_18px_60px_rgba(0,0,0,0.24)] sm:px-8 sm:py-10"
    >
      <header className="grid grid-cols-[1fr_auto] items-start gap-6 border-b-2 border-neutral-950 pb-5">
        <div>
          <p className="text-[11px] font-bold tracking-[0.14em] text-neutral-500 uppercase">
            {preview.companyName}
          </p>
          <h2 className="mt-2 max-w-xl font-serif text-xl leading-tight font-bold uppercase sm:text-2xl">
            Договор проката транспортного средства
          </h2>
        </div>
        <div className="text-right text-xs leading-5 text-neutral-600">
          <p>{preview.city}</p>
          <p>{preview.date}</p>
        </div>
      </header>

      <section className="mt-7 grid gap-3">
        <h3 className="font-serif text-sm font-bold uppercase">1. Стороны договора</h3>
        <dl className="grid gap-3 sm:grid-cols-2">
          <Field label="Арендатор" value={preview.client.fullName} />
          <Field label="Телефон" value={preview.client.phone} />
        </dl>
      </section>

      <section className="mt-7 grid gap-3">
        <h3 className="font-serif text-sm font-bold uppercase">2. Автомобиль</h3>
        <dl className="grid gap-3 sm:grid-cols-2">
          <Field label="Марка и модель" value={preview.vehicle.label} />
          <Field label="Государственный номер" value={preview.vehicle.registrationNumber} />
          <div className="sm:col-span-2">
            <Field label="VIN" value={preview.vehicle.vin} />
          </div>
        </dl>
      </section>

      <section className="mt-7 grid gap-3">
        <h3 className="font-serif text-sm font-bold uppercase">3. Условия аренды</h3>
        <dl className="grid gap-3 sm:grid-cols-2">
          <Field label="Начало аренды" value={preview.rental.startsAt} />
          <Field label="Возврат" value={preview.rental.endsAt} />
          <Field label="Стоимость" value={money(preview.rental.totalMinor)} />
          <Field label="Обеспечительный платёж" value={money(preview.rental.depositMinor)} />
          <Field label="Место выдачи" value={preview.rental.pickupAddress} />
          <Field label="Место возврата" value={preview.rental.returnAddress} />
          <div className="sm:col-span-2">
            <Field label="Разрешённая территория" value={preview.rental.territory} />
          </div>
        </dl>
      </section>

      <section className="mt-7 rounded-sm border border-neutral-300 bg-neutral-50 p-4">
        <h3 className="font-serif text-sm font-bold uppercase">Особые условия</h3>
        <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-neutral-700">
          {preview.rental.conditions}
        </p>
      </section>

      <footer className="mt-12 grid gap-8 border-t border-neutral-300 pt-7 text-xs sm:grid-cols-2">
        <div>
          <p className="font-bold">Арендодатель</p>
          <p className="mt-8 border-b border-neutral-700 pb-1 text-neutral-500">Подпись</p>
        </div>
        <div>
          <p className="font-bold">Арендатор</p>
          <p className="mt-8 border-b border-neutral-700 pb-1 text-neutral-500">Подпись</p>
        </div>
      </footer>
    </article>
  );
}
