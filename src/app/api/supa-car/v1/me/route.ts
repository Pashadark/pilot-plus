import { authenticateSupaCarOwner } from '@/modules/supa-car/auth/server';
import { OwnerAuthError } from '@/modules/supa-car/auth/service';

const HEADERS = { 'Cache-Control': 'private, no-store' };

export async function GET(request: Request): Promise<Response> {
  try {
    const owner = await authenticateSupaCarOwner(request);

    return Response.json(
      {
        id: owner.id,
        displayName: owner.displayName,
        phoneMasked: `${owner.phoneE164.slice(0, 2)} *** ***-**-${owner.phoneE164.slice(-2)}`,
      },
      { headers: HEADERS },
    );
  } catch (error) {
    if (error instanceof OwnerAuthError) {
      return Response.json(
        { error: { code: 'UNAUTHORIZED' } },
        { status: 401, headers: HEADERS },
      );
    }

    return Response.json(
      { error: { code: 'INTERNAL_ERROR' } },
      { status: 500, headers: HEADERS },
    );
  }
}
