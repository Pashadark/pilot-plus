import { describe, expect, it, vi } from 'vitest';

import { createGlobalShortcutHandler, createGlobalShortcutListener } from './useGlobalShortcuts';

function createKeyboardEvent(
  key: string,
  options: {
    target?: EventTarget | null;
    altKey?: boolean;
    ctrlKey?: boolean;
    metaKey?: boolean;
    shiftKey?: boolean;
  } = {},
) {
  return {
    key,
    target: options.target ?? null,
    altKey: options.altKey ?? false,
    ctrlKey: options.ctrlKey ?? false,
    metaKey: options.metaKey ?? false,
    shiftKey: options.shiftKey ?? false,
    preventDefault: vi.fn(),
  };
}

describe('createGlobalShortcutHandler', () => {
  it.each(['T', 't'])('переключает тему по %s', (key) => {
    const toggleTheme = vi.fn();
    const handler = createGlobalShortcutHandler({ toggleTheme });

    handler(createKeyboardEvent(key));

    expect(toggleTheme).toHaveBeenCalledOnce();
  });

  it.each(['F', 'f', '/'])('переводит фокус в поиск по %s', (key) => {
    const focusSearch = vi.fn();
    const handler = createGlobalShortcutHandler({ focusSearch });

    handler(createKeyboardEvent(key));

    expect(focusSearch).toHaveBeenCalledOnce();
  });

  it('закрывает активный слой по Escape', () => {
    const closeOverlay = vi.fn();
    const handler = createGlobalShortcutHandler({ closeOverlay });

    handler(createKeyboardEvent('Escape'));

    expect(closeOverlay).toHaveBeenCalledOnce();
  });

  it.each(['INPUT', 'TEXTAREA', 'SELECT'])('игнорирует ввод в %s', (tagName) => {
    const callbacks = {
      focusSearch: vi.fn(),
      closeOverlay: vi.fn(),
      toggleTheme: vi.fn(),
    };
    const handler = createGlobalShortcutHandler(callbacks);

    handler(createKeyboardEvent('t', { target: { tagName } as unknown as EventTarget }));

    expect(callbacks.focusSearch).not.toHaveBeenCalled();
    expect(callbacks.closeOverlay).not.toHaveBeenCalled();
    expect(callbacks.toggleTheme).not.toHaveBeenCalled();
  });

  it('игнорирует contenteditable', () => {
    const toggleTheme = vi.fn();
    const handler = createGlobalShortcutHandler({ toggleTheme });

    handler(
      createKeyboardEvent('t', {
        target: { isContentEditable: true } as unknown as EventTarget,
      }),
    );

    expect(toggleTheme).not.toHaveBeenCalled();
  });

  it.each([{ ctrlKey: true }, { metaKey: true }, { altKey: true }, { shiftKey: true }])(
    'не перехватывает сочетания с модификаторами',
    (modifier) => {
      const toggleTheme = vi.fn();
      const handler = createGlobalShortcutHandler({ toggleTheme });

      handler(createKeyboardEvent('t', modifier));

      expect(toggleTheme).not.toHaveBeenCalled();
    },
  );

  it('предотвращает ввод слэша только когда доступен поиск', () => {
    const withSearch = createKeyboardEvent('/');
    createGlobalShortcutHandler({ focusSearch: vi.fn() })(withSearch);
    expect(withSearch.preventDefault).toHaveBeenCalledOnce();

    const withoutSearch = createKeyboardEvent('/');
    createGlobalShortcutHandler({})(withoutSearch);
    expect(withoutSearch.preventDefault).not.toHaveBeenCalled();
  });

  it('проверяет актуальное наличие поиска в момент события', () => {
    let callbacks = { focusSearch: vi.fn() };
    const listener = createGlobalShortcutListener(() => callbacks);
    const withSearch = createKeyboardEvent('/');
    listener(withSearch);
    expect(withSearch.preventDefault).toHaveBeenCalledOnce();

    callbacks = {} as typeof callbacks;
    const withoutSearch = createKeyboardEvent('/');
    listener(withoutSearch);
    expect(withoutSearch.preventDefault).not.toHaveBeenCalled();
  });
});
