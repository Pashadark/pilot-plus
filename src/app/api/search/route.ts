import { globalSearch } from '@/modules/search/server';
export async function GET(request: Request) {
  const headers = { 'Cache-Control': 'private, no-store' };
  try {
    return Response.json(await globalSearch(new URL(request.url).searchParams.get('q') ?? ''), {
      headers,
    });
  } catch (error) {
    const unauthorized = error instanceof Error && error.message === 'UNAUTHORIZED';
    return Response.json(
      {
        results: [],
        error: unauthorized
          ? 'Войдите в систему'
          : 'Не удалось выполнить поиск. Попробуйте ещё раз.',
      },
      { status: unauthorized ? 401 : 500, headers },
    );
  }
}
