'use client';

import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { FiCheck } from 'react-icons/fi';

const particles = Array.from({ length: 16 }, (_, index) => ({
  x: Math.cos((index / 16) * Math.PI * 2) * (58 + (index % 3) * 12),
  y: Math.sin((index / 16) * Math.PI * 2) * (48 + (index % 4) * 8),
  color:
    index % 3 === 0
      ? 'var(--color-success)'
      : index % 3 === 1
        ? 'var(--color-primary)'
        : 'var(--color-warning)',
}));

export function BookingSuccess({
  rentalId,
  contractNumber,
  vehicle,
  period,
  onClose,
}: {
  rentalId: string;
  contractNumber: string;
  vehicle: string;
  period: string;
  onClose(): void;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.section
      initial={reduceMotion ? false : { opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="grid min-h-[70dvh] place-content-center gap-5 text-center"
    >
      <div className="relative mx-auto grid size-24 place-items-center">
        {!reduceMotion ? (
          <div data-testid="booking-confetti" aria-hidden className="absolute inset-1/2">
            {particles.map((particle, index) => (
              <motion.span
                key={index}
                className="absolute block size-2 rounded-sm"
                style={{ background: particle.color }}
                initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
                animate={{ x: particle.x, y: particle.y, opacity: 0, rotate: 180 }}
                transition={{ duration: 0.65, ease: 'easeOut' }}
              />
            ))}
          </div>
        ) : null}
        <motion.span
          initial={reduceMotion ? false : { scale: 0.55 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 19 }}
          className="grid size-20 place-items-center rounded-full bg-[var(--color-primary)] text-4xl text-white shadow-[var(--shadow-floating)]"
        >
          <FiCheck aria-hidden />
        </motion.span>
      </div>
      <div>
        <h3 className="text-2xl font-bold">Бронирование создано</h3>
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
          {contractNumber}
          <br />
          {vehicle}
          <br />
          {period}
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={onClose}
          className="min-h-11 rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 text-sm font-semibold"
        >
          Закрыть
        </button>
        <Link
          href={`/rentals/${rentalId}`}
          className="min-h-11 content-center rounded-[var(--radius-md)] bg-[var(--color-primary)] px-4 text-sm font-semibold text-white"
        >
          Открыть бронирование
        </Link>
      </div>
    </motion.section>
  );
}
