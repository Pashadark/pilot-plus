'use client';

import { Button, Card, CardContent } from '@/shared/ui';

export default function FinesError({ unstable_retry }: { unstable_retry: () => void }) {
  return (
    <Card role="alert">
      <CardContent className="space-y-4 p-6">
        <div>
          <h1 className="text-xl font-bold">Не удалось загрузить штрафы</h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Проверьте подключение Driver Helper или повторите запрос.
          </p>
        </div>
        <Button onClick={() => unstable_retry()}>Повторить</Button>
      </CardContent>
    </Card>
  );
}
