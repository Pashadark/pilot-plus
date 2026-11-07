function argumentValue(args: readonly string[], name: string) {
  const inline = args.find((argument) => argument.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

export function parseArchiveConfirmedFineArgs(args: readonly string[]): {
  externalId: string;
  companyId?: string;
} {
  if (argumentValue(args, '--confirm') !== 'ARCHIVE_CONFIRMED') {
    throw new Error('Для выполнения укажите --confirm ARCHIVE_CONFIRMED.');
  }
  const externalId = argumentValue(args, '--external-id');
  if (!externalId || !/^\d+$/u.test(externalId)) {
    throw new Error('Укажите числовой внешний ID через --external-id.');
  }
  const companyId = argumentValue(args, '--company-id')?.trim();
  return { externalId, ...(companyId ? { companyId } : {}) };
}
