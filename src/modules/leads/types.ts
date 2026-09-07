import type { LeadStatus } from '@/database/generated/prisma';

export type LeadActionState = {
  status: 'idle' | 'success' | 'error';
  message?: string;
  fieldErrors?: Record<string, string>;
};

export type LeadInput = {
  companyId: string;
  name: string;
  lastName: string;
  phone: string;
  source: string;
  comment: string;
  nextContactAt: Date | null;
};

export type LeadItem = {
  id: string;
  companyName: string;
  name: string;
  lastName: string | null;
  phone: string;
  source: string | null;
  comment: string | null;
  status: LeadStatus;
  assignedToName: string | null;
  nextContactAt: string | null;
  createdAt: string;
};

export const leadStatuses = ['NEW', 'CONTACTED', 'QUALIFIED', 'BOOKED', 'LOST'] as const;

export const leadStatusLabels: Record<LeadStatus, string> = {
  NEW: 'Новая',
  CONTACTED: 'Связались',
  QUALIFIED: 'Подтверждена',
  BOOKED: 'Перешла в аренду',
  LOST: 'Неактуальна',
};
