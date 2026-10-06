'use client';
import { QRCodeSVG } from 'qrcode.react';
export function FinePaymentQr({ url }: { url: string }) {
  return (
    <div className="grid justify-items-center gap-3">
      <div className="max-w-full rounded-xl bg-white p-3">
        <QRCodeSVG
          value={url}
          size={224}
          marginSize={4}
          level="M"
          title="QR-код ссылки на страницу оплаты штрафа"
          className="h-auto max-w-full"
        />
      </div>
      <p className="text-center text-sm text-[var(--color-text-secondary)]">
        Сканируйте камерой телефона. QR открывает страницу оплаты, это не QR СБП.
      </p>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-primary)] px-4 font-semibold text-[var(--color-text-inverse)]"
      >
        Открыть страницу оплаты
      </a>
    </div>
  );
}
