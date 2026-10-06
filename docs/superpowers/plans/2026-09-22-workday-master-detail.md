# Workday master-detail implementation plan

**Goal:** Implement the user-approved mock with overdue/today/tomorrow tasks, a muted list of up to 20 other items, and a selected-item inspector.

**Architecture:** Keep authenticated company-scoped queries on the server and pass serializable data to a client interaction island. Use existing design tokens and actions. No changes to payments or rental state as part of display.

## Tasks
- [ ] Add failing tests for Moscow calendar boundaries, overdue precedence, unscheduled items, 20-item secondary limit, selection and filters.
- [ ] Add a pure grouping helper and master-detail WorkdayBoard using existing Badge/Card components. Keyboard buttons select items; links navigate. On mobile details follow the selected row.
- [ ] Enrich rental item DTO with existing contract/vehicle/client links, rental dates and committed-operation history. Show missing financial breakdown as unknown, never assume zero.
- [ ] Expand default today's work queue through the next 30 days while preserving KPI period; include overdue service tasks. Tomorrow must be loaded, not only relabelled.
- [ ] Keep manual task completion and real domain navigation. Do not introduce a nonfunctional comment-save control; link to existing entity workflow where needed.
- [ ] Run focused unit tests, lint and type checking, build, and inspect responsive rendering. Preserve unrelated working-tree edits.

## Acceptance
Dates use Europe/Moscow; primary groups are not truncated by the secondary limit. Old unscheduled leads are not classified overdue. Details update on selection/filter changes. No fabricated history, payment amounts, phone, contract identifiers. No production DB mutations or migration needed.
