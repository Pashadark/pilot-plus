type LifecycleNotificationTransaction = {
  telegramGroupBinding?: {
    findUnique(args: unknown): Promise<{
      telegramChatId: string;
      boundByUserId: string;
    } | null>;
  };
  telegramIdentity?: {
    findFirst(args: unknown): Promise<{ id: string } | null>;
  };
  botNotificationJob?: {
    createMany(args: unknown): Promise<{ count: number }>;
  };
};

export async function enqueueRentalLifecycleNotifications(
  transaction: LifecycleNotificationTransaction,
  input: {
    companyId: string;
    rentalId: string;
    operationId: string;
    kind: 'HANDOVER' | 'RETURN' | 'EXTENSION';
    occurredAt: Date;
  },
) {
  if (
    !transaction.telegramGroupBinding ||
    !transaction.telegramIdentity ||
    !transaction.botNotificationJob
  )
    return 0;

  const binding = await transaction.telegramGroupBinding.findUnique({
    where: { companyId: input.companyId },
    select: { telegramChatId: true, boundByUserId: true },
  });
  const customer = await transaction.telegramIdentity.findFirst({
    where: {
      companyId: input.companyId,
      kind: 'CLIENT',
      isActive: true,
      client: {
        archivedAt: null,
        status: { notIn: ['BLOCKED', 'ARCHIVED'] },
        rentals: { some: { id: input.rentalId, companyId: input.companyId } },
      },
    },
    select: { id: true },
  });
  const identity = binding
    ? await transaction.telegramIdentity.findFirst({
        where: {
          companyId: input.companyId,
          userId: binding.boundByUserId,
          kind: 'STAFF',
          isActive: true,
        },
        select: { id: true },
      })
    : null;
  const common = {
    companyId: input.companyId,
    template: 'RENTAL_LIFECYCLE',
    payload: {
      kind: input.kind,
      rentalId: input.rentalId,
      operationId: input.operationId,
    },
    availableAt: input.occurredAt,
  };
  const rows = [
    ...(binding
      ? [
          {
            ...common,
            chatId: binding.telegramChatId,
            eventKey: `rental-lifecycle:${input.operationId}:group:${binding.telegramChatId}`,
          },
        ]
      : []),
    ...(customer
      ? [
          {
            ...common,
            template: 'CLIENT_RENTAL_LIFECYCLE',
            identityId: customer.id,
            eventKey: `rental-lifecycle:${input.operationId}:client:${customer.id}`,
          },
        ]
      : []),
    ...(identity
      ? [
          {
            ...common,
            identityId: identity.id,
            eventKey: `rental-lifecycle:${input.operationId}:staff:${identity.id}`,
          },
        ]
      : []),
  ];
  if (!rows.length) return 0;
  const result = await transaction.botNotificationJob.createMany({
    data: rows.filter(
      (row) => row.template === 'CLIENT_RENTAL_LIFECYCLE' || !('identityId' in row),
    ),
    skipDuplicates: true,
  });
  return result.count;
}
