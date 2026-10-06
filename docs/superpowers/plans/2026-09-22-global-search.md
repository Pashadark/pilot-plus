# Global search implementation plan

Approved: header dropdown; vehicles, clients, rentals, leads and dated operations. Preserve system tokens and company access boundaries.

Architecture: authenticated no-store API; bounded Prisma queries with existing access policies; pure Moscow date parser; accessible client dropdown with debounce and abort.

- [ ] Test date parsing, invalid dates, inclusive ranges, plate normalization.
- [ ] Implement search parser in src/modules/search/query.ts.
- [ ] Implement server search using session-derived scopes, exact protected phone index, bounded result groups and explicit date labels.
- [ ] Add /api/search route with generic errors and no-store responses.
- [ ] Add HeaderSearch dropdown: keyboard navigation, loading/error/empty states, stale request cancellation, mobile layout.
- [ ] Wire header; verify tests, TypeScript and production build.

Dates: DD.MM.YYYY, DD.MM (current Moscow year), ranges separated by hyphen/en dash, сегодня/завтра. Invalid date-like queries return a helpful validation message. Maximum range 366 days. Phone search uses full normalized number only. No plaintext phone export or passport search. No schema changes.
