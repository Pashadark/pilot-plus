import { NextRequest } from 'next/server';

import { FineAccessDeniedError } from '@/modules/fines/access';
import { buildFineWorkbook } from '@/modules/fines/server/fine-export';
import { listFineExportRowsForCurrentUser } from '@/modules/fines/server/export-query';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  try {
    const rows = await listFineExportRowsForCurrentUser({
      status: params.get('status') ?? undefined,
      query: params.get('query') ?? undefined,
      companyId: params.get('companyId') ?? undefined,
      offenseFrom: params.get('offenseFrom') ?? undefined,
      offenseTo: params.get('offenseTo') ?? undefined,
      vehicleId: params.get('vehicleId') ?? undefined,
      clientId: params.get('clientId') ?? undefined,
      discountDay: params.get('discountDay') ?? undefined,
    });
    const workbook = await buildFineWorkbook(rows);
    const day = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Moscow',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    return new Response(new Uint8Array(workbook), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="fines-${day}.xlsx"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    if (error instanceof FineAccessDeniedError) {
      return Response.json({ error: 'Доступ запрещён.' }, { status: 403 });
    }
    throw error;
  }
}
