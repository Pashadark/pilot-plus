'use server';
import { prisma } from '@/database/prisma/client';
import { getAuthenticatedSession } from '@/services/auth/session';
import { readAvitoControl, setAvitoControl } from '@/modules/leads/avito/control';

async function ownerCompany() {
  const session = await getAuthenticatedSession();
  if (!session || session.user.role !== 'SUPER_ADMIN') return null;
  const binding = await prisma.telegramGroupBinding.findFirst({
    where: {
      boundByUserId: session.user.id,
      company: { members: { some: { userId: session.user.id } } },
    },
    select: { companyId: true },
  });
  if (!binding) return null;
  const connected = await prisma.avitoDialogue.findFirst({
    where: { companyId: binding.companyId },
    select: { id: true },
  });
  return connected ? { userId: session.user.id, companyId: binding.companyId } : null;
}
export async function getAvitoProfileControl() {
  const owner = await ownerCompany();
  return owner ? readAvitoControl(owner.companyId, prisma) : null;
}
export async function updateAvitoProfileControl(enabled: boolean) {
  try {
    const owner = await ownerCompany();
    if (!owner) return { ok: false as const, message: 'Управление доступно только владельцу.' };
    const state = await setAvitoControl(owner.userId, owner.companyId, enabled, prisma);
    return { ok: true as const, state };
  } catch {
    return { ok: false as const, message: 'Не удалось сохранить настройку. Повторите попытку.' };
  }
}
