const safePhotoRevision = /^[a-z0-9]{1,16}$/u;

export function clientPhotoRevision(updatedAt: Date) {
  return updatedAt.getTime().toString(36);
}

export function isClientPhotoRevision(value: string | null): value is string {
  return Boolean(value && safePhotoRevision.test(value));
}
