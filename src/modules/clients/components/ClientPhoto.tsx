import { ClientPlaceholder } from './ClientPlaceholder';

const APPROVED_LOCAL_PHOTO_PREFIX = '/uploads/clients/';

export function isApprovedClientPhotoPath(value: string | null | undefined): value is string {
  return Boolean(value?.startsWith(APPROVED_LOCAL_PHOTO_PREFIX) && !value.startsWith('//'));
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
  const source = src ? 'local' : 'placeholder';

  return (
    <div
      data-testid="client-photo"
      data-source={source}
      className="size-[5.5rem] shrink-0 overflow-hidden"
    >
      {src ? (
        <img
          src={src}
          alt={`Фото клиента ${name}`}
          className="h-full w-full rounded-[var(--radius-md)] object-cover"
        />
      ) : (
        <ClientPlaceholder name={name} />
      )}
    </div>
  );
}
