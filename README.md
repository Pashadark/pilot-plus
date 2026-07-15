# Pilot+

Pilot+ — веб-платформа для мониторинга и управления коммерческим автопарком. Проект должен объединить онлайн-карту, телеметрию транспорта, устройства, историю маршрутов, события, геозоны, техническое обслуживание, отчёты и администрирование компаний.

[![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=111827)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL%20%2B%20PostGIS-17-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Project status](https://img.shields.io/badge/status-active%20development-0092BE)](https://github.com/Pashadark/pilot-plus)

Создатель и владелец проекта: **Павел Седов (Pashadark)**.

> Сейчас проект находится на стадии интерактивного frontend-прототипа и инфраструктурной основы. Дашборд и карта работают на демонстрационных данных; прикладная модель БД, API и поток телеметрии ещё не реализованы.

## Документация

Главный источник контекста для разработчиков и AI-агентов:

- [Полный гид по проекту](docs/PROJECT_GUIDE.md)
- [Правила участия в разработке](CONTRIBUTING.md)

В нём зафиксированы исходное видение, фактический стек, архитектура, инфраструктура, текущее состояние, правила разработки и roadmap.

## Быстрый запуск

Требования:

- Node.js 20 или новее;
- npm;
- Docker Desktop с Docker Compose.

```powershell
npm install
docker compose up -d
npm run dev
```

Приложение: <http://localhost:3000>

Сервисы разработки:

- PostgreSQL/PostGIS: `127.0.0.1:5433`;
- Redis: `127.0.0.1:6379`;
- MQTT: `127.0.0.1:1883`;
- MQTT WebSocket: `127.0.0.1:9001`.

## Основные команды

```powershell
npm run dev
npm run build
npm run start
npm run lint
npx tsc --noEmit
npx prisma validate
```

Перед использованием Prisma требуется `DATABASE_URL`. Локальное значение находится в `.env`; безопасный шаблон переменных окружения ещё предстоит добавить.

## Статус

Уже есть:

- Next.js App Router, React, TypeScript и Tailwind CSS;
- desktop-дашборд со статистикой, событиями и статусами;
- MapLibre-карта с демонстрационными автомобилями;
- Prisma и PostgreSQL/PostGIS;
- Redis и Mosquitto в Docker Compose;
- заготовки общей UI-библиотеки и дизайн-токенов.

Ближайшая цель: стабилизировать tooling и реализовать первый сквозной сценарий `MQTT → обработка телеметрии → PostgreSQL/Redis → обновление автомобиля на карте`.

## Ветки

- `main` — стабильное, проверенное состояние проекта;
- `develop` — интеграционная версия для тестирования следующих изменений;
- `feature/*` и `fix/*` — короткоживущие ветки задач с pull request в `develop`.

Стабильные релизы переносятся из `develop` в `main` отдельным pull request.

## Автор

**Павел Седов (Pashadark)** — идея, продукт и разработка Pilot+.

[GitHub](https://github.com/Pashadark)
