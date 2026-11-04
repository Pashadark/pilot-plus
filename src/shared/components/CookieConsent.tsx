'use client';

import { useState, useSyncExternalStore } from 'react';
import { LuCookie } from 'react-icons/lu';

const key = 'pilot-cookie-choice-v1';
const eventName = 'pilot-cookie-choice';
let memoryChoice: string | null = null;
let storageFailed = false;
function subscribe(callback: () => void) {
  window.addEventListener('storage', callback);
  window.addEventListener(eventName, callback);
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener(eventName, callback);
  };
}
function snapshot() {
  if (storageFailed) return memoryChoice;
  try {
    const value = localStorage.getItem(key);
    return value === 'accepted' || value === 'declined' ? value : null;
  } catch {
    return memoryChoice;
  }
}
const serverSnapshot = () => 'pending';

export function CookieConsent() {
  const choice = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const [details, setDetails] = useState(false);
  function choose(value: 'accepted' | 'declined') {
    memoryChoice = value;
    try {
      localStorage.setItem(key, value);
    } catch {
      storageFailed = true;
    }
    window.dispatchEvent(new Event(eventName));
  }
  if (choice) return null;
  return (
    <section className="cookie-bar" role="region" aria-label="Cookie">
      <div className="cookie-bar__info">
        <LuCookie className="cookie-bar__icon" size={32} aria-hidden="true" />
        <div>
          <p className="cookie-bar__text">
            Cookie помогают сохранять вход и настройки сайта.{' '}
            <button
              type="button"
              className="cookie-bar__details"
              aria-expanded={details}
              onClick={() => setDetails(!details)}
            >
              Подробнее
            </button>
          </p>
          {details && (
            <p className="cookie-bar__text mt-2">
              Необходимые cookie обеспечивают вход в систему. Настройки оформления и ваш выбор
              сохраняются в браузере. Аналитические cookie сейчас не используются. Отклонение не
              мешает работе сайта.
            </p>
          )}
        </div>
      </div>
      <div className="cookie-bar__actions">
        <button
          type="button"
          className="cookie-bar__btn cookie-bar__btn--accept"
          onClick={() => choose('accepted')}
        >
          Принять
        </button>
        <button
          type="button"
          className="cookie-bar__btn cookie-bar__btn--decline"
          onClick={() => choose('declined')}
        >
          Отклонить
        </button>
      </div>
    </section>
  );
}
