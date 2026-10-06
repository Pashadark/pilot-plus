# Client Card Variant 1 and Single-Screen Editor Design

## Goal

Implement the user-selected first client-card concept in the existing Pilot+ design system, and let an authorized manager edit an existing client directly without moving through the four-step new-client wizard.

## Behavior

- Creating a client keeps the existing four-step flow: contacts, documents, files, verification.
- Editing an existing client shows all editable contact, passport, address, driver-license, and status fields on one screen.
- Contacts contain a required primary phone and an optional **Дополнительный телефон**. Both values are encrypted at rest; only the primary number participates in duplicate detection.
- The obsolete aggregate **Паспорт (как в базе)** input is not shown. Structured passport fields remain the source of truth and are composed into the existing encrypted passport payload for backwards compatibility.
- The edit form has one primary action: **Сохранить изменения**.
- Existing document-file uploads remain in the client card's **Документы** tab so replacing metadata cannot accidentally replace signed scans.
- The client header contains a visible **Редактировать** link that scrolls to the editor.
- Existing permissions remain unchanged: only users with `canManage` see the editor and edit link.
- The card header shows the client photo, name, both phone numbers when present, status, reliability rating, rental count and primary actions.
- The overview uses four calm information surfaces: personal data, Russian passport, driver licence and current/last rental. Passport registration address stays in the passport card.
- A full-width client-history timeline uses only existing facts: card creation, comments, rental start, committed handover/return operations and completed-rental dates. No fictional events are generated.
- Tabs retain the existing real workspaces for rentals, documents and comments.
- The layout collapses to one column on mobile without horizontal page overflow.

## Compatibility

The existing `additionalPhoneEncrypted` database column is wired through validation, encrypted writes, reads and presentation. No new database column or migration is required. Optimistic concurrency and permissions remain unchanged.
