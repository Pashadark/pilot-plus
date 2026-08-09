import type {
  ClientDocument as PrismaClientDocument,
  ClientDocumentCategory,
  ClientDocumentVersion as PrismaClientDocumentVersion,
  DocumentScanStatus,
} from '@/database/generated/prisma';

export type { ClientDocumentCategory, DocumentScanStatus };

export type ClientDocument = PrismaClientDocument;

export type ClientDocumentVersion = PrismaClientDocumentVersion;
