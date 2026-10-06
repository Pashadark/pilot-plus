# Avito document review and notification consistency

> **For agentic workers:** Use executing-plans for inline implementation and checkpoints.

**Goal:** Deliver new rental-chat photos to the bound company Telegram group, with owner-only audited review, and consistent lead/deposit messages.

**Architecture:** Preserve encrypted AvitoDialogue state; use durable BotNotificationJob records per image and revision. Review is separate from rental approval. Never forward historic messages or sales chats.

**Tech Stack:** Existing Next.js/Prisma workers and aiogram bot; no new dependencies or schema changes.

## Constraints

- No document URLs or contents in logs; URLs remain encrypted at rest.
- Group must match company binding, and reviewer must be its bound active superadmin.
- New images invalidate old revision buttons; review never books a vehicle.
- Treat images as received photos, not proof of a complete or valid identity-document set.
- Preserve existing one-reply Avito policy and live cutoff.

## Tasks

- [x] Add failing compact lead/deposit formatting tests; implement escaped HTML and wire deposit jobs.
- [ ] Test and implement validated Avito image extraction, encrypted document state and revision calculation.
- [ ] Queue individual image notifications and a debounced revision-specific review message; hydrate only to the bound group.
- [ ] Implement owner-only decision API and aiogram callbacks with stale-revision and repeat-click protection.
- [ ] Test Python delivery, TypeScript regressions and production build.
- [ ] Deploy a backed-up release and bot, verify services and document flow without replaying old messages.

## Verification commands

```powershell
npx vitest run src/modules/leads/avito src/modules/bot-api/lead-notifications.test.ts src/modules/bot-api/deposit-notifications.test.ts src/modules/rentals/settlement/server/deposit-return-action.test.ts
npx tsc --project .codex-tmp/tsconfig-avito.json --noEmit
python -m pytest bot/tests/test_notifications.py
```

Production rollout must copy the current release, overlay only task files, build before switching the current symlink, and retain the previous release for rollback.
