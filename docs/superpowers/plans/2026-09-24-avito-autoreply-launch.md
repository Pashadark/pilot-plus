# Avito auto-reply launch

> Use executing-plans and test-driven-development. The conversational design is approved in the preceding user turn.

**Goal:** Actual rental-only replies with Moscow-relative dates, conservative live availability and expected-return labels.

**Architecture:** Persist accumulated enquiry fields from timestamped messages; generate answers from fresh tenant-scoped fleet data immediately before sending. Keep existing durable outbox, ad ownership gate and human handover.

**Stack:** Existing TypeScript, Prisma, Avito API, Vitest; no new dependencies or external LLM.

- [ ] Add failing tests for today/tomorrow across midnight, duration and pickup time, total mileage answers. Extend request parsing without guessing missing times.
- [ ] Add failing tests for free/expected/overdue categories and future reservation overlap. Build customer-safe answer with no client identities or internal plates.
- [ ] Test fresh answers for complete enquiries and repeated questions; enqueue per new incoming, never per bot webhook. Re-read fleet at send time.
- [ ] Prevent reminders starving behind inbox; preserve API cooldown. Verify unknown sends stay fail-closed.
- [ ] Unit tests, types, lint; deploy worker-only source update with backups and sending disabled.
- [ ] Read authoritative test chat, verify rental ownership and pause state. Send one controlled reply only to that user-provided test chat; verify the returned provider ID and persisted SENT state before general enabling.
- [ ] Enable only future new incoming events on approved rental ads. Do not drain pre-launch historical outbox.
