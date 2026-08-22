import type {
  ClientCommentCategory,
  ClientCommentProblemStatus,
  ClientCommentSeverity,
} from '@/database/generated/prisma';

export type ClientCommentDto = {
  id: string;
  rentalId: string | null;
  rentalLabel: string | null;
  authorUserId: string;
  authorName: string;
  category: ClientCommentCategory;
  severity: ClientCommentSeverity;
  text: string;
  isPinned: boolean;
  problemStatus: ClientCommentProblemStatus | null;
  affectsRating: boolean;
  ratingDelta: number | null;
  resolvedAt: string | null;
  hiddenAt: string | null;
  createdAt: string;
  updatedAt: string;
};
