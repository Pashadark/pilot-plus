import { RentalAccessDeniedError } from '@/modules/rentals/server/access';
import { generateDraftRentalPreviewPdf } from '@/modules/rentals/constructor/server/generate-preview-pdf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const pdf = await generateDraftRentalPreviewPdf(id);
    return new Response(Buffer.from(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="supa-pro-rental-preview.pdf"',
        'Cache-Control': 'private, no-store, max-age=0',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    if (error instanceof RentalAccessDeniedError) {
      return new Response('Доступ к предпросмотру договора запрещён.', { status: 403 });
    }
    const message = error instanceof Error ? error.message : 'Предпросмотр договора недоступен.';
    return new Response(message, {
      status: message === 'Черновик договора не найден.' ? 404 : 422,
      headers: { 'Cache-Control': 'private, no-store, max-age=0' },
    });
  }
}
