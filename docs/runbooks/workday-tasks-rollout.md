# Workday tasks panel — 2026-10-08

Current release: /opt/pilot-plus/releases/20261008-workday-tasks. Previous mobile-dock release retained for rollback. Four production files changed: WorkdayDashboard.tsx, WorkdayTasksButton.tsx, WorkdayDetails.tsx (explicit client boundary), workday.css. No database changes.

Actions match cookie typography:600 weight,13px,44px height,12px radius. Tasks panel reuses TaskComposer and WorkdayDetails for manual tasks in selected overview period. Existing all-events disclosure retained. Notes use existing task comment field.

Verification:8 focused tests passed; typecheck and scoped lint passed; final server build exit0; activation returned TASKS_DEPLOY_OK. Live390px panel is bottom-aligned, full width, no horizontal overflow. Live1280px panel right-aligned,560px wide. Close and Escape verified. No real tasks created during verification.
