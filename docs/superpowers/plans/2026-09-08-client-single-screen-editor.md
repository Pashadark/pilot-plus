# Client Card Variant 1 Implementation Plan

1. Add failing validation, action and query tests for optional `additionalPhone`, including normalization, encryption and decryption.
2. Wire the existing `Client.additionalPhoneEncrypted` column through `ClientInput`, DTOs, form validation, encrypted create/update data and client queries.
3. Add failing component tests for the selected first client-card concept: two displayed phone numbers, separate passport and driver-licence cards, registration address, rental count, real history and no aggregate passport input.
4. Update `ClientForm`: create mode retains the wizard, edit mode remains one continuous form, both modes expose `Дополнительный телефон`, and the aggregate `Паспорт (как в базе)` control is removed while structured passport values remain compatible with stored data.
5. Rebuild `ClientDetailPage` in the selected responsive Variant 1 structure while preserving the real rentals, documents, comments, rating and editor functionality.
6. Run focused client tests, Prisma validation/generation, lint, type checking and a production build.
7. Render desktop and mobile screenshots, compare them with `docs/design/client-card-concepts/client-card-1.png`, resolve visible overflow/hierarchy regressions, and record the result in `design-qa.md`.
8. Before production changes, create a database backup. Deploy the verified release without seeding, restart the service, and smoke-test the live client list, selected client card and edit flow.
