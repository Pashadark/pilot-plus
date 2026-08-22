'use client';

import { useEffect, useState } from 'react';

const MINUTE_MS = 60_000;

export function useMinuteNow(): Date | null {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), MINUTE_MS);
    return () => window.clearInterval(timer);
  }, []);

  return now;
}
