type ContractPreviewProps = {
  rentalId: string | undefined;
  version: string | undefined;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
};

export function ContractPreview({ rentalId, version, saveStatus }: ContractPreviewProps) {
  if (!rentalId || !version || saveStatus === 'saving') {
    return (
      <div className="grid min-h-64 place-items-center rounded-[var(--radius-md)] border border-dashed border-[var(--color-border-strong)] bg-[var(--color-surface)] p-6 text-center text-sm text-[var(--color-text-secondary)]">
        <p>Сначала сохраните данные договора.</p>
      </div>
    );
  }

  const source = `/rentals/${encodeURIComponent(rentalId)}/preview?version=${encodeURIComponent(version)}`;

  return (
    <article aria-label="Документ договора" className="grid gap-3">
      <p className="text-xs text-[var(--color-text-secondary)]">
        Точный документ из утверждённого шаблона. Содержимое, шрифт и разбивка страниц совпадают с
        договором для печати.
      </p>
      <iframe
        key={source}
        title="Точный предпросмотр договора"
        src={source}
        className="h-[72dvh] min-h-[42rem] w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white"
      />
      <a
        href={source}
        target="_blank"
        rel="noreferrer"
        className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--color-border)] px-4 text-sm font-semibold text-[var(--color-text)] hover:bg-[var(--color-surface)]"
      >
        Открыть точный предпросмотр отдельно
      </a>
    </article>
  );
}
