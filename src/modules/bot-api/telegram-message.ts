export type TelegramMessageSection = {
  icon: string;
  title: string;
  rows: readonly string[];
};

export function telegramSection(
  icon: string,
  title: string,
  rows: readonly (string | null | undefined)[],
): TelegramMessageSection | null {
  const visibleRows = rows.filter((row): row is string => Boolean(row));
  return visibleRows.length ? { icon, title, rows: visibleRows } : null;
}

function formatSection(section: TelegramMessageSection) {
  return [
    `${section.icon} <b>${section.title}</b>`,
    ...section.rows.map((row, index) => `${index === section.rows.length - 1 ? '└' : '├'} ${row}`),
  ].join('\n');
}

export function formatTelegramMessage(input: {
  title: string;
  sections?: readonly (TelegramMessageSection | null | undefined)[];
  action?: string | null;
}) {
  return [
    input.title,
    ...(input.sections ?? [])
      .filter((section): section is TelegramMessageSection => Boolean(section))
      .map(formatSection),
    input.action ? formatSection({ icon: '⚡', title: 'Действие', rows: [input.action] }) : null,
  ]
    .filter((block): block is string => Boolean(block))
    .join('\n\n');
}
