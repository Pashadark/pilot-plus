'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { FiAlertTriangle, FiChevronLeft, FiChevronRight, FiPause, FiPlay } from 'react-icons/fi';
import { Modal } from '@/shared/ui';
import type { DashboardAttentionItemDto } from './overview-types';
import styles from './workday-attention.module.css';

export function WorkdayAttention({ items }: { items: DashboardAttentionItemDto[] }) {
  const [page, setPage] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [paused, setPaused] = useState(false);
  const [open, setOpen] = useState(false);
  const pages = Math.ceil(items.length / 3);
  const current = pages ? page % pages : 0;
  useEffect(() => {
    if (pages < 2 || hovered || focused || paused || open) return;
    const timer = setInterval(() => {
      if (!document.hidden) setPage((value) => (value + 1) % pages);
    }, 5000);
    return () => clearInterval(timer);
  }, [pages, hovered, focused, paused, open]);
  function entry(item: DashboardAttentionItemDto) {
    return (
      <Link key={item.id} href={item.href}>
        <FiAlertTriangle aria-hidden="true" data-tone={item.tone} />
        <span>
          {item.title}
          <small>{item.description}</small>
        </span>
        <FiChevronRight aria-hidden="true" />
      </Link>
    );
  }
  return (
    <section
      className="workday-attention"
      aria-label="Требуют внимания"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
      }}
    >
      <h2>
        Требуют внимания<span>{items.length}</span>
      </h2>
      <div key={current} className={`workday-attention-list ${styles.flip}`}>
        {items.slice(current * 3, current * 3 + 3).map(entry)}
        {!items.length && <p>Нет срочных предупреждений</p>}
      </div>
      {pages > 1 && (
        <div className={styles.controls}>
          <button type="button" onClick={() => setOpen(true)} aria-label="Все предупреждения">
            Все {items.length}
          </button>
          <span>
            {current + 1} / {pages}
          </span>
          <button
            type="button"
            aria-label="Предыдущие предупреждения"
            onClick={() => setPage((current + pages - 1) % pages)}
          >
            <FiChevronLeft />
          </button>
          <button
            type="button"
            aria-label={
              paused ? 'Продолжить смену предупреждений' : 'Остановить смену предупреждений'
            }
            onClick={() => setPaused(!paused)}
          >
            {paused ? <FiPlay /> : <FiPause />}
          </button>
          <button
            type="button"
            aria-label="Следующие предупреждения"
            onClick={() => setPage((current + 1) % pages)}
          >
            <FiChevronRight />
          </button>
        </div>
      )}
      <Modal open={open} onOpenChange={setOpen} title="Все предупреждения">
        <div className="workday-attention-list">{items.map(entry)}</div>
      </Modal>
    </section>
  );
}
