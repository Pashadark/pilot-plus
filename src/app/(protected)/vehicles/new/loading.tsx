export default function Loading() {
  return (
    <main
      className="mx-auto grid w-full max-w-4xl gap-5 p-4 sm:p-6"
      aria-label="Загрузка формы автомобиля"
    >
      <div className="h-7 w-48 animate-pulse rounded bg-[var(--color-elevated)]" />
      <div className="grid gap-4 rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:grid-cols-2 sm:p-6">
        {Array.from({ length: 10 }, (_, index) => (
          <div
            key={index}
            className="h-20 animate-pulse rounded-[var(--radius-md)] bg-[var(--color-elevated)]"
          />
        ))}
      </div>
    </main>
  );
}
