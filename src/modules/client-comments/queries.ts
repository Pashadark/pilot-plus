import type { ClientCommentDto } from './types';
import { prisma } from '@/database/prisma/client';

type CommentAccess = {
  scope: 'SYSTEM' | 'COMPANY';
  companyIds: readonly string[];
  user: { id: string };
};
type CommentRepository = { findMany(args: unknown): Promise<unknown[]> };

type RawComment = {
  id: string;
  rentalId: string | null;
  authorUserId: string;
  category: ClientCommentDto['category'];
  severity: ClientCommentDto['severity'];
  text: string;
  isPinned: boolean;
  hiddenAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  author: { name: string };
  rental: { contractNumber: string | null } | null;
};

export async function listClientComments(
  access: CommentAccess,
  clientId: string,
  includeHidden = false,
  repository: CommentRepository = prisma.clientComment,
): Promise<ClientCommentDto[]> {
  const records = (await repository.findMany({
    where: {
      clientId,
      ...(access.scope === 'SYSTEM' ? {} : { companyId: { in: [...access.companyIds] } }),
      ...(includeHidden ? {} : { hiddenAt: null }),
    },
    select: {
      id: true,
      rentalId: true,
      authorUserId: true,
      category: true,
      severity: true,
      text: true,
      isPinned: true,
      hiddenAt: true,
      createdAt: true,
      updatedAt: true,
      author: { select: { name: true } },
      rental: { select: { contractNumber: true } },
    },
    orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
    take: 100,
  })) as RawComment[];
  return records.map((comment) => ({
    id: comment.id,
    rentalId: comment.rentalId,
    rentalLabel: comment.rental?.contractNumber ?? null,
    authorUserId: comment.authorUserId,
    authorName: comment.author.name,
    category: comment.category,
    severity: comment.severity,
    text: comment.text,
    isPinned: comment.isPinned,
    hiddenAt: comment.hiddenAt?.toISOString() ?? null,
    createdAt: comment.createdAt.toISOString(),
    updatedAt: comment.updatedAt.toISOString(),
  }));
}
