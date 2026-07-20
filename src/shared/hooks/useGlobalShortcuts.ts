'use client';

import { useEffect, useLayoutEffect, useRef } from 'react';

export interface GlobalShortcutCallbacks {
  focusSearch?: () => boolean;
  closeOverlay?: () => void;
  toggleTheme?: () => void;
}

interface GlobalShortcutCallbacksRef {
  current: GlobalShortcutCallbacks;
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
        if (callbacks.focusSearch?.()) {
          event.preventDefault();
        }
        break;
      case 'escape':
        callbacks.closeOverlay?.();
        break;
    }
  };
}

export function createGlobalShortcutListener(callbacksRef: GlobalShortcutCallbacksRef) {
  return (event: GlobalShortcutEvent) => createGlobalShortcutHandler(callbacksRef.current)(event);
}

export function useGlobalShortcuts(callbacks: GlobalShortcutCallbacks) {
  const callbacksRef = useRef(callbacks);

  useLayoutEffect(() => {
    callbacksRef.current = callbacks;
  });

  useEffect(() => {
    const handleKeyDown = createGlobalShortcutListener(callbacksRef);
    window.addEventListener('keydown', handleKeyDown);

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
}
