'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { FiTruck } from 'react-icons/fi';

type VehicleImage = { localPath: string; alt: string };

export function RentalVehicleThumbnail({
  image,
  model,
  city,
  href,
  compact = false,
}: {
  image: VehicleImage | null;
  model: string;
  city: string;
  href: string;
  compact?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const showImage = image !== null && !failed;
  return (
    <Link
      href={href}
      aria-label={`Открыть автомобиль ${model}`}
      className={`relative block shrink-0 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-elevated)] shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)] ${compact ? 'h-[54px] w-20' : 'h-16 w-24'}`}
    >
      {showImage ? (
        <Image
          src={image.localPath}
          alt={image.alt || model}
          fill
          unoptimized
          sizes={compact ? '80px' : '96px'}
          className="object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <span
          role="img"
          aria-label={`Фотография ${model} в городе ${city} отсутствует`}
          data-testid="vehicle-photo-placeholder"
          className="grid size-full place-items-center text-[var(--color-primary)]"
        >
          <FiTruck aria-hidden="true" className="size-6" />
        </span>
      )}
    </Link>
  );
}
