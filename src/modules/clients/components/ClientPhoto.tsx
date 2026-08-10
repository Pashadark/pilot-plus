'use client';

import { useState } from 'react';

import { ClientPlaceholder } from './ClientPlaceholder';

const APPROVED_LOCAL_PHOTO_PREFIX = '/uploads/clients/';
const PROTECTED_CLIENT_PHOTO = /^\/clients\/[a-zA-Z0-9_-]{1,128}\/photo\?v=[a-z0-9]{1,16}$/u;

export function isApprovedClientPhotoPath(value: string | null | undefined): value is string {
  return Boolean(
    value &&
    ((value.startsWith(APPROVED_LOCAL_PHOTO_PREFIX) && !value.startsWith('//')) ||
      PROTECTED_CLIENT_PHOTO.test(value)),
  );
}

export function ClientPhoto({
  name,
  localPhotoUrl,
}: {
  name: string;
  localPhotoUrl?: string | null;
  confirmedMessengerAvatarUrl?: string | null;
}) {
  const src = isApprovedClientPhotoPath(localPhotoUrl) ? localPhotoUrl : null;
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const visibleSrc = src && src !== failedSrc ? src : null;
  const source = visibleSrc ? 'local' : 'placeholder';

  return (
    <div
      data-testid="client-photo"
      data-source={source}
      className="size-[5.5rem] shrink-0 overflow-hidden"
    >
      {visibleSrc ? (
        // Защищённый photo route требует session cookie текущего браузера.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={visibleSrc}
          alt={`Фото клиента ${name}`}
          className="h-full w-full rounded-[var(--radius-md)] object-cover"
          onError={() => setFailedSrc(visibleSrc)}
        />
      ) : (
        <ClientPlaceholder name={name} />
      )}
    </div>
  );
}
