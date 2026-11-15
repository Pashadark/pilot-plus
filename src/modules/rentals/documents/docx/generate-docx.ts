import { resolveLegalTemplate, type LegalTemplateVersion } from '../legal-content-v1';
import type { RentalSnapshot } from '../../domain/build-snapshot';
import { generateApprovedRentalDocx } from './approved-template';

export type RentalDocxOptions = {
  contractNumber: string;
  templateVersion?: LegalTemplateVersion;
};

/** Builds the legal DOCX from the approved Supa Pro contract template. */
export async function generateRentalDocx(
  snapshot: RentalSnapshot,
  { contractNumber, templateVersion = 'legal-content-v1' }: RentalDocxOptions,
): Promise<Uint8Array> {
  resolveLegalTemplate(templateVersion);
  return generateApprovedRentalDocx(snapshot, contractNumber);
}
