'use client';

import { useEffect, useState } from 'react';
import { FiArrowUp } from 'react-icons/fi';

import { IconButton } from '@/shared/ui/IconButton';

const visibilityThreshold = 400;

export function ScrollToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const updateVisibility = () => setVisible(window.scrollY > visibilityThreshold);
    updateVisibility();
    window.addEventListener('scroll', updateVisibility, { passive: true });

    return () => window.removeEventListener('scroll', updateVisibility);
  }, []);

  if (!visible) return null;

  return (
    <IconButton
      label="Наверх"
      variant="primary"
      onClick={() => {
        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
      }}
      className="fixed right-4 bottom-4 z-30 shadow-[var(--shadow-floating)] sm:right-6 sm:bottom-6"
    >
      <FiArrowUp aria-hidden="true" className="size-5" />
    </IconButton>
  );
}
