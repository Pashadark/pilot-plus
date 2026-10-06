# Timeweb Billing Monitor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Показывать финансовое состояние Timeweb Cloud в SUPER_ADMIN-мониторинге и один раз уведомлять рабочую Telegram-группу при остатке не более семи дней.

**Architecture:** Почасовой systemd timer запускает однократный TypeScript worker. Worker читает только официальные Timeweb `GET`-методы, сохраняет атомарный безопасный снимок в shared storage и ставит внутреннее Telegram-задание в существующий PostgreSQL outbox при пересечении порога 168 часов; веб-монитор читает снимок без внешнего API-вызова на каждом 15-секундном обновлении.

**Tech Stack:** Next.js 16 Route Handlers, TypeScript 5, Prisma 6, Vitest 3, systemd, Telegram notification outbox.

## Global Constraints

- Только чтение Timeweb API; никаких изменяющих запросов.
- `TIMEWEB_CLOUD_TOKEN` остаётся только в `/etc/pilot-plus.env` и никогда не сериализуется.
- Порог равен 168 часам включительно.
- Одно сообщение на один непрерывный период ниже порога; сброс только после пополнения выше порога.
- Адресат — Telegram-группа компании из `TIMEWEB_ALERT_COMPANY_ID`.
- Старая информация не выдаётся за актуальную: снимок старше двух часов получает неизвестное состояние.

---

### Task 1: Чистая модель Timeweb и порог уведомления

**Files:**

- Create: `src/modules/system-health/timeweb-monitor.ts`
- Test: `src/modules/system-health/timeweb-monitor.test.ts`

**Interfaces:**

- Produces: `buildTimewebSnapshot(rawFinances, rawServers, previous, checkedAt)`, `shouldEnqueueTimewebAlert(previous, next)`, `formatTimewebAlert(snapshot)`.
- Snapshot contains only normalized finance/server fields and `alertActive`; it cannot contain credentials or raw responses.

- [ ] Write failing tests for valid normalization, missing `hours_left`, 169/168-hour threshold, repeated low balance, reset after refill and Telegram copy.
- [ ] Run `npx vitest run src/modules/system-health/timeweb-monitor.test.ts` and confirm failure because the module is absent.
- [ ] Implement strict bounded normalization and pure threshold/message helpers.
- [ ] Re-run the target test and confirm it passes.

### Task 2: Worker, persistent snapshot and Telegram outbox

**Files:**

- Create: `src/modules/system-health/timeweb-monitor-worker.ts`
- Create: `src/modules/system-health/timeweb-monitor-worker.test.ts`
- Create: `scripts/sync-timeweb-monitor.ts`
- Modify: `package.json`
- Modify: `.env.example`

**Interfaces:**

- Consumes: `TIMEWEB_CLOUD_TOKEN`, `TIMEWEB_ALERT_COMPANY_ID`, `TIMEWEB_MONITOR_SNAPSHOT_PATH`.
- Produces: `runTimewebMonitor(dependencies)` and npm script `system:sync-timeweb`.

- [ ] Write failing worker tests for two bounded GET requests, atomic snapshot write, one `SYSTEM_BILLING_ALERT` outbox row, no duplicate below threshold, reset above threshold and missing group handling.
- [ ] Run `npx vitest run src/modules/system-health/timeweb-monitor-worker.test.ts` and confirm expected failure.
- [ ] Implement injected worker orchestration, safe error codes and a thin executable script that disconnects Prisma.
- [ ] Add documented environment variable names and npm script without secret values.
- [ ] Re-run the worker tests and confirm they pass.

### Task 3: Safe Telegram template routing

**Files:**

- Modify: `src/modules/bot-api/notification-routing.ts`
- Modify: `src/modules/bot-api/notification-routing.test.ts`
- Modify: `bot/services/notifications.py`
- Modify: `bot/tests/test_notifications.py`

**Interfaces:**

- Consumes: outbox template `SYSTEM_BILLING_ALERT` with already formatted plain-text `payload.message`.
- Produces: delivery only to the currently bound internal group; never to a client identity.

- [ ] Add failing TypeScript and Python tests proving the template is internal-only and preserves the intended message.
- [ ] Run the two target test files and confirm failure.
- [ ] Add the template to the internal allowlist; keep the Python sender on its generic safe-message path.
- [ ] Re-run the target tests and confirm they pass.

### Task 4: SUPER_ADMIN monitor card

**Files:**

- Create: `src/modules/system-health/timeweb-monitor-card.ts`
- Create: `src/modules/system-health/timeweb-monitor-card.test.ts`
- Modify: `src/modules/system-health/monitor-server.ts`
- Modify: `src/modules/system-health/monitor.test.ts`

**Interfaces:**

- Consumes: sanitized snapshot file.
- Produces: `MonitorCard` key `timeweb` with balance, remaining time, forecast date, hourly/daily/monthly spend, autopay, discount and server statuses.

- [ ] Write failing tests for healthy, seven-day warning, stale, malformed and absent snapshots.
- [ ] Run target tests and confirm failure.
- [ ] Implement bounded file parsing and card formatting; add the card to `getMonitorSnapshot()` without exposing raw API data.
- [ ] Re-run target tests and confirm they pass.

### Task 5: systemd scheduling and runbook

**Files:**

- Create: `deploy/pilot-plus-timeweb-monitor.service`
- Create: `deploy/pilot-plus-timeweb-monitor.timer`
- Create: `docs/runbooks/timeweb-monitor.md`

**Interfaces:**

- Timer runs hourly with `Persistent=true`.
- Service uses `/etc/pilot-plus.env`, writes only `/opt/pilot-plus/shared`, and runs as `pilot-plus`.

- [ ] Add hardened unit files and exact install, verification, secret configuration, start/status and rollback commands.
- [ ] Validate unit syntax where `systemd-analyze` is available and inspect the unit files otherwise.

### Task 6: Verification and production rollout

**Files:**

- Modify only files required by defects exposed during verification.

- [ ] Run targeted Vitest and Python tests.
- [ ] Run `npm run typecheck`, `npm run lint`, `npm run test:unit`, `npm run build` and `git diff --check`.
- [ ] Build a new production release without changing the existing env file, install the two systemd units and add only the new variable names/values to `/etc/pilot-plus.env`.
- [ ] Start the one-shot worker, confirm a sanitized snapshot, active timer, active application and visible Timeweb card.
- [ ] Confirm no real Telegram alert is sent when more than seven days remain; inspect the outbox only if the real balance is already within the threshold.
