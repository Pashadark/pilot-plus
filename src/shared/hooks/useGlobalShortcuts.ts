'use client';

import { useEffect, useRef } from 'react';

export interface GlobalShortcutCallbacks {
  focusSearch?: () => void;
  closeOverlay?: () => void;
  toggleTheme?: () => void;
}

interface GlobalShortcutEvent {
  key: string;
  target: EventTarget | null;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  preventDefault: () => void;
}

interface EditableTarget {
  tagName?: string;
  isContentEditable?: boolean;
  closest?: (selector: string) => unknown;
}

function isEditableTarget(target: EventTarget | null) {
  if (!target || typeof target !== 'object') return false;

  const element = target as EditableTarget;
  const tagName = element.tagName?.toLowerCase();
  return (
    tagName === 'input' ||
    tagName === 'textarea' ||
    tagName === 'select' ||
    element.isContentEditable === true ||
    Boolean(element.closest?.('[contenteditable]:not([contenteditable="false"])'))
  );
}

export function createGlobalShortcutHandler(callbacks: GlobalShortcutCallbacks) {
  return (event: GlobalShortcutEvent) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (isEditableTarget(event.target)) return;

    switch (event.key.toLowerCase()) {
      case 't':
        callbacks.toggleTheme?.();
        break;
      case 'f':
        callbacks.focusSearch?.();
        break;
      case '/':
        if (callbacks.focusSearch) {
          event.preventDefault();
          callbacks.focusSearch();
        }
        break;
      case 'escape':
        callbacks.closeOverlay?.();
        break;
    }
  };
}

export function createGlobalShortcutListener(getCallbacks: () => GlobalShortcutCallbacks) {
  return (event: GlobalShortcutEvent) => createGlobalShortcutHandler(getCallbacks())(event);
}

export function useGlobalShortcuts(callbacks: GlobalShortcutCallbacks) {
  const callbacksRef = useRef(callbacks);

  useEffect(() => {
    callbacksRef.current = callbacks;
  });

  useEffect(() => {
    const handleKeyDown = createGlobalShortcutListener(() => callbacksRef.current);
    window.addEventListener('keydown', handleKeyDown);

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
}
