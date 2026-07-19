'use client';

import Image from 'next/image';
import { useState } from 'react';
import { FiTruck } from 'react-icons/fi';

import type { VehicleImageDto } from '../types';

interface VehiclePhotoProps {
  image: VehicleImageDto | null;
  model: string;
  city: string;
  sizes: string;
  testId?: string;
  className?: string;
}

export function VehiclePhoto({
  image,
  model,
  city,
  sizes,
  testId = 'vehicle-photo',
  className = '',
}: VehiclePhotoProps) {
  const [hasError, setHasError] = useState(false);
  const showImage = image && !hasError;

  return (
    <div
      className={`relative aspect-[16/9] overflow-hidden bg-[var(--color-elevated)] ${className}`}
      data-testid={showImage ? testId : 'vehicle-photo-placeholder'}
    >
      {showImage ? (
        <Image
          src={image.localPath}
          alt={image.alt}
          fill
          sizes={sizes}
          className="object-cover transition-transform duration-[var(--motion-slow)] group-hover:scale-[1.02]"
          onError={() => setHasError(true)}
        />
      ) : (
        <div
          className="flex size-full flex-col items-center justify-center gap-2 text-[var(--color-text-tertiary)]"
          role="img"
          aria-label={`Фотография ${model} в городе ${city} отсутствует`}
        >
          <span className="flex size-14 items-center justify-center rounded-full bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
            <FiTruck aria-hidden="true" className="size-7" />
          </span>
          <span className="text-xs font-semibold">Фото автомобиля недоступно</span>
        </div>
      )}
    </div>
  );
}
