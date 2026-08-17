import 'server-only';

interface AuthorizedFine {
  externalId: string;
  companyId: string;
}

interface FinePhotoDependencies {
  loadAuthorizedFine(id: string): Promise<AuthorizedFine | null>;
  fetchPhoto(fine: AuthorizedFine): Promise<{ mime: string; bytes: Uint8Array } | null>;
}

const allowedMime = new Set(['image/jpeg', 'image/png', 'image/webp']);

export async function getFinePhotoResponse(id: string, dependencies: FinePhotoDependencies) {
  const fine = await dependencies.loadAuthorizedFine(id);
  if (!fine) return new Response(null, { status: 404 });
  const photo = await dependencies.fetchPhoto(fine);
  if (!photo || !allowedMime.has(photo.mime) || photo.bytes.byteLength > 8 * 1024 * 1024) {
    return new Response(null, { status: 404 });
  }
  return new Response(photo.bytes as BodyInit, {
    headers: {
      'Content-Type': photo.mime,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Disposition': 'inline; filename="fine-photo"',
    },
  });
}
