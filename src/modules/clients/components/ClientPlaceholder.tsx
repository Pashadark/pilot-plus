export function ClientPlaceholder({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  return (
    <svg
      viewBox="0 0 88 88"
      role="img"
      aria-label={`Фото клиента ${name} пока не добавлено`}
      className="h-full w-full rounded-[var(--radius-md)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]"
    >
      <title>{`Фото клиента ${name} пока не добавлено`}</title>
      <circle cx="44" cy="31" r="16" fill="currentColor" opacity="0.3" />
      <path d="M15 78c5-17 18-26 29-26s24 9 29 26" fill="currentColor" opacity="0.3" />
      <text x="44" y="84" textAnchor="middle" fill="currentColor" fontSize="12" fontWeight="700">
        {initials}
      </text>
    </svg>
  );
}
