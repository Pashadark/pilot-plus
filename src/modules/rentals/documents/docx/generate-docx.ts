import {
  AlignmentType,
  Document,
  Footer,
  Header,
  PageNumber,
  Packer,
  Paragraph,
  TextRun,
} from 'docx';
import { resolveLegalTemplate, type LegalTemplateVersion } from '../legal-content-v1';
import type { RentalSnapshot } from '../../domain/build-snapshot';
import { closing } from './sections/closing';
import { parties } from './sections/parties';
import { terms } from './sections/terms';
import { vehicle } from './sections/vehicle';

export type RentalDocxOptions = {
  contractNumber: string;
  templateVersion?: LegalTemplateVersion;
};

/** Builds a byte-stable legal DOCX from the immutable confirmation snapshot. */
export async function generateRentalDocx(
  snapshot: RentalSnapshot,
  { contractNumber, templateVersion = 'legal-content-v1' }: RentalDocxOptions,
): Promise<Uint8Array> {
  const template = resolveLegalTemplate(templateVersion);
  const document = new Document({
    styles: {
      default: {
        document: {
          run: { font: 'Arial', size: 20 },
          paragraph: { spacing: { line: 276, after: 120 } },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: 'Договор проката транспортного средства', size: 16 }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun('Pilot+ · страница '),
                  new TextRun({ children: [PageNumber.CURRENT] }),
                ],
              }),
            ],
          }),
        },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: `ДОГОВОР № ${contractNumber}`, bold: true, size: 28 })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            text: `${snapshot.company.contractCity ?? 'Москва'}, ${new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(snapshot.rental.createdAt ?? snapshot.rental.startsAt))}`,
          }),
          ...parties(snapshot),
          ...vehicle(snapshot),
          ...terms(snapshot),
          ...closing(snapshot, template.clauses, template.penalties),
        ],
      },
    ],
  });
  return Packer.toBuffer(document);
}
