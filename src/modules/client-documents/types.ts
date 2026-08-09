import type {
  ClientDocument as PrismaClientDocument,
  ClientDocumentCategory,
  ClientDocumentVersion as PrismaClientDocumentVersion,
  DocumentScanStatus,
} from '@/database/generated/prisma';

export type { ClientDocumentCategory, DocumentScanStatus };

export type ClientDocument = PrismaClientDocument;

export type ClientDocumentVersion = PrismaClientDocumentVersion;

export type ClientDocumentActionState =
  | { status: 'idle' }
  | { status: 'pending'; message: string; documentId?: string }
  | { status: 'success'; message: string; documentId?: string; clientId?: string }
  | { status: 'error'; message: string; documentId?: string };

export interface ClientDocumentListItem {
  id: string;
  category: ClientDocumentCategory;
  title: string;
  status: DocumentScanStatus;
  currentVersion: number;
  originalName: string | null;
  verifiedMime: string | null;
  bytes: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface DownloadableClientDocument {
  documentId: string;
  companyId: string;
  version: number;
  storageKey: string;
  originalName: string;
  verifiedMime: string;
  sha256: string;
}
