# Supa Pro Zero-Downtime Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Убрать недоступность Supa Pro при обновлениях и снизить постоянную фоновую нагрузку без изменения пользовательских функций.

**Architecture:** Два systemd-слота Supa Pro слушают разные loopback-порты. Скрипт выкладки запускает неактивный слот, проверяет его напрямую, атомарно переводит Nginx и только после периода дренирования останавливает прежний слот. Стабильный ключ Server Actions и уникальный deployment ID предотвращают ошибки открытых вкладок при смене версии.

**Tech Stack:** Next.js 16, Node.js, systemd, Nginx, Bash, Python asyncio bot, Vitest/Pytest.

## Global Constraints

- Пользовательское название только Supa Pro; логотип и пользовательский дизайн не меняются.
- Схема данных и бизнес-функции не меняются.
- Существующий релиз сохраняется для немедленного отката.
- Новый слот получает трафик только после успешной локальной проверки.
- Секрет Server Actions хранится только на сервере и не выводится в журналы.

---

### Task 1: Deployment safety contract

**Files:**
- Modify: `src/deployment-config.test.ts`
- Create: `deploy/supapro-web@.service`
- Create: `deploy/supapro-zero-downtime-deploy.sh`
- Create: `deploy/supapro-nginx-site.conf`

- [x] Добавить падающий тест для двух слотов, прямого запуска Next.js, обязательной проверки готовности, атомарного переключения Nginx, дренирования старого процесса и отката при ошибке.
- [x] Запустить тест и подтвердить ожидаемое падение из-за отсутствующих артефактов.
- [x] Реализовать минимальные systemd/Nginx/deploy-артефакты.
- [x] Запустить тест повторно и подтвердить прохождение.

### Task 2: Adaptive notification polling

**Files:**
- Modify: `bot/services/notifications.py`
- Modify: `bot/tests/test_notifications.py`

- [x] Добавить падающие тесты: пустая очередь опрашивается реже, после задания следующий опрос остаётся быстрым, остановка worker не задерживается.
- [x] Реализовать адаптивную задержку без изменения обработки и подтверждения уведомлений.
- [x] Запустить bot-тесты и подтвердить прохождение.

### Task 3: Production rollout and verification

**Files:**
- Create: `docs/runbooks/supapro-zero-downtime.md`

- [x] Проверить целевые тесты, lint/typecheck и production build с уникальным deployment ID.
- [x] Создать и проверить резервную копию конфигурации сервера и базы.
- [x] Установить unit/template, стабильный Server Actions key и Nginx-конфигурацию.
- [x] Запустить новый слот, проверить его напрямую и переключить Nginx.
- [x] Проверить HTTPS, журналы, базу, Redis, карту/API и отсутствие 502 при контрольном переключении слотов.
- [x] Зафиксировать точный путь отката и фактические метрики после выкладки.
