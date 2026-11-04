'use server';

import { vehicleName } from '@/shared/lib/vehicle-name';

import { randomUUID } from 'node:crypto';

import { revalidatePath } from 'next/cache';

import { prisma } from '@/database/prisma/client';
import { formatDepositReturnedMessage } from '@/modules/bot-api/deposit-notifications';
import { appendDepositEntry, getRentalDepositBalance } from '@/modules/deposits/server/ledger';
import { requireRentalAccess, RentalAccessDeniedError } from '@/modules/rentals/server/access';

import { paymentCommandSchema, signatureCommandSchema } from '../validation';
import { parseDepositReturnInput, planDepositReturnLedger } from './deposit-return';
import { createRentalSettlementService } from './service';

export type SettlementActionResult = { ok: true; message: string } | { ok: false; message: string };

const service = createRentalSettlementService(prisma as never);

function moneyToMinor(value: FormDataEntryValue | null) {
  const normalized = String(value ?? '')
    .trim()
    .replace(/\s/gu, '')
    .replace(',', '.');
  if (!/^\d+(?:\.\d{1,2})?$/u.test(normalized)) throw new Error('Укажите корректную сумму.');
  const [rubles, kopecks = ''] = normalized.split('.');
  return BigInt(rubles) * BigInt(100) + BigInt(kopecks.padEnd(2, '0'));
}

function message(error: unknown) {
  if (error instanceof RentalAccessDeniedError) return 'Недостаточно прав для изменения договора.';
  if (error instanceof Error && !error.message.includes('Invalid `prisma.')) return error.message;
  return 'Не удалось сохранить расчёт. Обновите страницу и повторите попытку.';
}

export async function recordRentalPaymentAction(
  _previous: SettlementActionResult | null,
  formData: FormData,
): Promise<SettlementActionResult> {
  try {
    const companyId = String(formData.get('companyId') ?? '').trim();
    const access = await requireRentalAccess(companyId);
    const command = paymentCommandSchema.parse({
      rentalId: formData.get('rentalId'),
      kind: formData.get('kind'),
      status: 'CONFIRMED',
      amountMinor: moneyToMinor(formData.get('amountRubles')),
      method: formData.get('method'),
      reference: formData.get('reference'),
      comment: formData.get('comment'),
      idempotencyKey: String(formData.get('idempotencyKey') ?? '').trim() || randomUUID(),
    });
    await service.recordPayment({
      companyId,
      actor: { id: access.user.id, email: access.user.email },
      command,
    });
    revalidatePath(`/rentals/${command.rentalId}`);
    return { ok: true, message: 'Оплата записана.' };
  } catch (error) {
    return { ok: false, message: message(error) };
  }
}

export async function setRentalSignatureAction(
  _previous: SettlementActionResult | null,
  formData: FormData,
): Promise<SettlementActionResult> {
  try {
    const companyId = String(formData.get('companyId') ?? '').trim();
    const access = await requireRentalAccess(companyId);
    const command = signatureCommandSchema.parse({
      rentalId: formData.get('rentalId'),
      party: formData.get('party'),
      status: formData.get('status'),
      signedByName: formData.get('signedByName'),
      comment: formData.get('comment'),
    });
    await service.setSignature({
      companyId,
      actor: { id: access.user.id, email: access.user.email },
      command,
    });
    revalidatePath(`/rentals/${command.rentalId}`);
    return { ok: true, message: 'Статус подписи сохранён.' };
  } catch (error) {
    return { ok: false, message: message(error) };
  }
}

function formatRubles(value: bigint) {
  return `${new Intl.NumberFormat('ru-RU').format(Number(value) / 100)} ₽`;
}

export async function returnRentalDepositAction(
  _previous: SettlementActionResult | null,
  formData: FormData,
): Promise<SettlementActionResult> {
  try {
    const companyId = String(formData.get('companyId') ?? '').trim();
    const rentalId = String(formData.get('rentalId') ?? '').trim();
    const access = await requireRentalAccess(companyId);
    const occurredAt = new Date();
    await prisma.$transaction(async (transaction) => {
      const rental = await transaction.rental.findFirst({
        where: { id: rentalId, companyId, status: { in: ['ACTIVE', 'COMPLETED'] } },
        select: {
          id: true,
          clientId: true,
          vehicleId: true,
          contractNumber: true,
          payments: {
            where: { kind: 'DEPOSIT', status: 'CONFIRMED' },
            select: { amountMinor: true },
          },
          client: { select: { firstName: true, middleName: true, lastName: true } },
          vehicle: { select: { make: true, modelName: true, registrationNumber: true } },
          operations: {
            where: { status: 'COMMITTED', depositStatus: { not: null } },
            select: { depositStatus: true },
            orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
            take: 1,
          },
        },
      });
      if (!rental) throw new Error('Действующий или завершённый договор не найден.');
      if (
        ['RETURNED', 'PARTIALLY_WITHHELD', 'WITHHELD'].includes(
          rental.operations[0]?.depositStatus ?? '',
        )
      ) {
        throw new Error('Возврат залога по этому договору уже оформлен.');
      }
      const collectedMinor = rental.payments.reduce(
        (sum, payment) => sum + payment.amountMinor,
        BigInt(0),
      );
      if (collectedMinor <= BigInt(0)) throw new Error('Внесённый залог по договору не найден.');
      const resolution = parseDepositReturnInput({
        collectedMinor,
        returnedRubles: String(formData.get('returnedRubles') ?? ''),
        reason: String(formData.get('reason') ?? ''),
      });
      const depositBalance = await getRentalDepositBalance(transaction, companyId, rental.id);
      const ledgerPlan = planDepositReturnLedger({
        cashMinor: depositBalance.cashMinor,
        reservedMinor: depositBalance.reservedMinor,
        withheldMinor: depositBalance.withheldMinor,
        returnedMinor: resolution.returnedMinor,
      });
      const operation = await transaction.rentalOperation.create({
        data: {
          companyId,
          rentalId: rental.id,
          clientId: rental.clientId,
          vehicleId: rental.vehicleId,
          actorUserId: access.user.id,
          type: 'DEPOSIT_RETURN',
          status: 'COMMITTED',
          idempotencyKey: `deposit-return:${rental.id}:${randomUUID()}`,
          occurredAt,
          committedAt: occurredAt,
          evidenceStatus: 'MISSING',
          evidenceMissingReason: 'Для возврата залога фото- и видеофиксация не требуется.',
          depositAmountMinor: collectedMinor,
          depositWithheldMinor: resolution.withheldMinor,
          depositStatus: resolution.status,
          depositResolutionReason: resolution.reason || null,
        },
        select: { id: true },
      });
      if (ledgerPlan.reservationDebtMinor > 0n) {
        const fineEntries = await transaction.depositLedgerEntry.findMany({
          where: { companyId, rentalId: rental.id, fineId: { not: null } },
          select: { fineId: true, reservedDeltaMinor: true, occurredAt: true },
          orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
        });
        const reservations = new Map<string, bigint>();
        for (const entry of fineEntries) {
          if (!entry.fineId) continue;
          reservations.set(
            entry.fineId,
            (reservations.get(entry.fineId) ?? 0n) + entry.reservedDeltaMinor,
          );
        }
        let remainingToDebt = ledgerPlan.reservationDebtMinor;
        for (const [fineId, reservedMinor] of reservations) {
          if (remainingToDebt === 0n) break;
          if (reservedMinor <= 0n) continue;
          const movedMinor = reservedMinor < remainingToDebt ? reservedMinor : remainingToDebt;
          await appendDepositEntry(transaction, {
            companyId,
            clientId: rental.clientId,
            rentalId: rental.id,
            fineId,
            operationId: operation.id,
            kind: 'FINE_RESERVATION_ADJUSTMENT',
            source: 'STAFF',
            cashDeltaMinor: 0n,
            reservedDeltaMinor: -movedMinor,
            withheldDeltaMinor: 0n,
            debtDeltaMinor: movedMinor,
            reason: 'Залог возвращён клиенту: резерв штрафа переведён в задолженность',
            metadata: { depositReturnOperationId: operation.id },
            idempotencyKey: `deposit-return-reservation-debt:${operation.id}:${fineId}`,
            actorUserId: access.user.id,
            occurredAt,
          });
          remainingToDebt -= movedMinor;
        }
        if (remainingToDebt > 0n) throw new Error('INVALID_DEPOSIT_LEDGER');
      }
      await appendDepositEntry(transaction, {
        companyId,
        clientId: rental.clientId,
        rentalId: rental.id,
        operationId: operation.id,
        kind: 'DEPOSIT_RETURN',
        source: 'STAFF',
        cashDeltaMinor: -resolution.returnedMinor,
        reservedDeltaMinor: 0n,
        withheldDeltaMinor: ledgerPlan.additionalWithheldMinor,
        debtDeltaMinor: 0n,
        reason: resolution.reason || 'Возврат залога сотрудником',
        idempotencyKey: `deposit-return:${operation.id}`,
        actorUserId: access.user.id,
        occurredAt,
      });
      await transaction.auditLog.create({
        data: {
          companyId,
          actorUserId: access.user.id,
          actorEmailSnapshot: access.user.email,
          action: 'UPDATE',
          entityType: 'RENTAL',
          entityId: rental.id,
          entityLabel: rental.contractNumber ?? 'Договор аренды',
          changes: {
            settlement: 'DEPOSIT_RETURNED',
            occurredAt: occurredAt.toISOString(),
            operationId: operation.id,
            returnedMinor: resolution.returnedMinor.toString(),
            withheldMinor: resolution.withheldMinor.toString(),
            reason: resolution.reason || null,
          },
        },
      });
      const binding = await transaction.telegramGroupBinding.findUnique({
        where: { companyId },
        select: { telegramChatId: true, boundByUserId: true },
      });
      if (!binding) return;
      const clientName = [rental.client.lastName, rental.client.firstName, rental.client.middleName]
        .filter(Boolean)
        .join(' ');
      const vehicleLabel = [
        vehicleName(rental.vehicle.make, rental.vehicle.modelName),
        rental.vehicle.registrationNumber,
      ]
        .filter(Boolean)
        .join(' · ');
      const messageText = formatDepositReturnedMessage({
        contract: rental.contractNumber ?? 'Без номера',
        client: clientName,
        vehicle: vehicleLabel,
        collected: formatRubles(collectedMinor),
        returned: formatRubles(resolution.returnedMinor),
        withheld: formatRubles(resolution.withheldMinor),
        reason: resolution.reason,
        at: occurredAt.toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' }),
        actor: access.user.name,
        rentalId,
      });
      await transaction.botNotificationJob.createMany({
        data: [
          {
            companyId,
            chatId: binding.telegramChatId,
            eventKey: `deposit-return:${operation.id}:group`,
            template: 'DEPOSIT_RETURNED',
            payload: {
              message: messageText,
              parseMode: 'HTML',
              actions: [
                {
                  type: 'contract_url',
                  label: '📄 Договор',
                  url: `https://supapro.ru/rentals/${encodeURIComponent(rentalId)}`,
                },
              ],
            },
            availableAt: occurredAt,
          },
        ],
        skipDuplicates: true,
      });
    });
    revalidatePath(`/rentals/${rentalId}`);
    revalidatePath('/rentals');
    return { ok: true, message: 'Возврат залога сохранён в истории договора.' };
  } catch (error) {
    return { ok: false, message: message(error) };
  }
}
