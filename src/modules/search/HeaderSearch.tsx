'use client';
import { useEffect, useLayoutEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import {
  FiSearch,
  FiX,
  FiArrowUpRight,
  FiTruck,
  FiCalendar,
  FiFileText,
  FiUser,
} from 'react-icons/fi';
import { Modal } from '@/shared/ui/Overlays';
import type { SearchResponse } from './query';

const shortcuts = [
  { label: 'Автомобиль', hint: 'Госномер, марка или модель', icon: FiTruck },
  { label: 'Клиент', hint: 'Имя, фамилия или телефон', icon: FiUser },
  { label: 'Договор', hint: 'Номер договора аренды', icon: FiFileText },
  { label: 'Штраф', hint: 'Номер постановления целиком или его часть', icon: FiFileText },
  { label: 'Дата или период', hint: '22.09.2026 или 22.09–25.09.2026', icon: FiCalendar },
];

export function HeaderSearch() {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [anchor, setAnchor] = useState({ left: 8, top: 64, width: 600 });
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(-1);
  const [data, setData] = useState<SearchResponse>({ results: [] });
  const version = useRef(0);
  const id = useId();
  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width =
        window.innerWidth < 640
          ? window.innerWidth - 16
          : Math.min(rect.width, window.innerWidth - 16);
      setAnchor({
        left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
        top: rect.bottom + 8,
        width,
      });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    if (triggerRef.current) observer?.observe(triggerRef.current);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
      observer?.disconnect();
    };
  }, [open]);
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, []);
  useEffect(() => {
    const current = ++version.current;
    const controller = new AbortController();
    if (query.trim().length < 2) return;
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
          cache: 'no-store',
        });
        const result: SearchResponse = await response.json();
        if (current === version.current && !controller.signal.aborted) {
          setData(
            response.ok ? result : { results: [], error: result.error ?? 'Поиск недоступен' },
          );
          setLoading(false);
        }
      } catch {
        if (current === version.current && !controller.signal.aborted) {
          setData({ results: [], error: 'Не удалось выполнить поиск. Проверьте соединение.' });
          setLoading(false);
        }
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);
  const results = data.results;
  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        data-global-search-trigger
        aria-label="Открыть глобальный поиск"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="flex h-11 w-full items-center gap-3 rounded-full border border-[var(--color-border-strong)] bg-[var(--color-elevated)] px-4 text-left text-[var(--color-text-secondary)] shadow-[inset_0_1px_2px_rgb(0_0_0/0.06)] transition-colors focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]"
      >
        <FiSearch aria-hidden="true" className="size-5 shrink-0" />
        <span className="min-w-0 flex-1 truncate text-sm">Поиск по системе</span>
      </button>
      {open &&
        createPortal(
          <Modal
            open={open}
            onOpenChange={setOpen}
            title="Глобальный поиск"
            hideTitle
            backdropClassName="!z-[120] !bg-black/50"
            style={{
              left: anchor.left,
              top: anchor.top,
              width: anchor.width,
              maxHeight: `calc(100dvh - ${anchor.top + 8}px)`,
            }}
            className="!fixed !m-0 !max-w-none !overflow-y-auto !rounded-xl !p-0"
          >
            <div className="flex items-center gap-3 border-b px-4">
              <FiSearch
                className="size-5 shrink-0 text-[var(--color-text-secondary)]"
                aria-hidden="true"
              />
              <input
                type="search"
                role="combobox"
                aria-label="Глобальный поиск"
                aria-autocomplete="list"
                aria-expanded={query.trim().length >= 2}
                aria-controls={query.trim().length >= 2 ? `${id}-results` : undefined}
                aria-activedescendant={active >= 0 ? `${id}-${active}` : undefined}
                placeholder="Авто, клиент, договор, постановление или дата"
                autoComplete="off"
                maxLength={120}
                value={query}
                className="h-16 min-w-0 flex-1 bg-transparent text-base outline-none [&::-webkit-search-cancel-button]:appearance-none"
                onChange={(event) => {
                  ++version.current;
                  setQuery(event.target.value);
                  setActive(-1);
                  setData({ results: [] });
                  setLoading(event.target.value.trim().length >= 2);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') setOpen(false);
                  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                    event.preventDefault();
                    const next = results.length
                      ? (active + (event.key === 'ArrowDown' ? 1 : -1) + results.length) %
                        results.length
                      : -1;
                    setActive(next);
                    document
                      .getElementById(`${id}-${next}`)
                      ?.scrollIntoView?.({ block: 'nearest' });
                  }
                  if (event.key === 'Enter' && active >= 0) {
                    event.preventDefault();
                    document.getElementById(`${id}-${active}`)?.click();
                  }
                }}
              />
              <button
                type="button"
                aria-label="Закрыть поиск"
                onClick={() => setOpen(false)}
                className="flex min-h-11 items-center gap-2 text-[var(--color-text-secondary)]"
              >
                <span className="hidden text-xs sm:inline">[esc]</span>
                <FiX aria-hidden="true" className="size-5" />
              </button>
            </div>
            <div className="max-h-[min(60dvh,480px)] overflow-y-auto overscroll-contain p-5 sm:p-8">
              {query.trim().length < 2 ? (
                <>
                  <p className="mb-5 text-xs font-medium tracking-wider text-[var(--color-text-muted)] uppercase">
                    Что можно найти
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {shortcuts.map(({ label, hint, icon: Icon }) => (
                      <div
                        key={label}
                        className="flex min-h-16 items-start gap-3 rounded-lg bg-[var(--color-elevated)] p-3 text-sm"
                      >
                        <Icon
                          aria-hidden="true"
                          className="mt-0.5 size-5 shrink-0 text-[var(--color-primary)]"
                        />
                        <span>
                          <span className="block font-medium">{label}</span>
                          <span className="mt-1 block text-xs leading-5 text-[var(--color-text-secondary)]">
                            {hint}
                          </span>
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <p role="status" className="mb-3 text-xs text-[var(--color-text-secondary)]">
                    {loading
                      ? 'Ищем…'
                      : (data.error ??
                        (results.length ? `Найдено: ${results.length}` : 'Ничего не найдено'))}
                  </p>
                  <div id={`${id}-results`} role="listbox" aria-label="Результаты поиска">
                    {results.map((result, index) => (
                      <div key={result.id}>
                        {(index === 0 || results[index - 1].group !== result.group) && (
                          <div className="pt-4 pb-2 text-xs font-medium tracking-wide text-[var(--color-text-muted)] uppercase">
                            {result.group}
                          </div>
                        )}
                        <Link
                          role="option"
                          aria-selected={active === index}
                          id={`${id}-${index}`}
                          href={result.href}
                          onClick={() => setOpen(false)}
                          onMouseEnter={() => setActive(index)}
                          className={`mb-1 flex min-h-16 items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm outline-none hover:bg-[var(--color-primary-soft)] focus:bg-[var(--color-primary-soft)] ${active === index ? 'bg-[var(--color-primary-soft)]' : ''}`}
                        >
                          <span className="min-w-0">
                            <span className="block font-medium">{result.title}</span>
                            <span className="mt-1 block text-xs text-[var(--color-text-secondary)]">
                              {result.subtitle}
                            </span>
                          </span>
                          <FiArrowUpRight
                            aria-hidden="true"
                            className="shrink-0 text-[var(--color-primary)]"
                          />
                        </Link>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
            <div className="border-t px-4 py-3 text-xs text-[var(--color-text-secondary)]">
              ↑ ↓ выбор · Enter открыть · Esc закрыть
            </div>
          </Modal>,
          document.body,
        )}
    </>
  );
}
