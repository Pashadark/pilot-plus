# Task 10 report: protected rental document downloads

- Added the Next 16.2 route at `rentals/[id]/documents/[version]/[format]`; it awaits all dynamic parameters and accepts only bounded identifiers, positive numeric versions, and exact `DOCX`/`PDF` formats.
- Rental access comes from the server-only rental access boundary. Company admin/dispatcher access is tenant-scoped, foreign and absent metadata share the same 404, and non-managing users receive 403 before metadata/storage access.
- The route requires the exact generated (`COMMITTED`), `CLEAN`, current linked client-document version. It streams private storage only after an initial scoped lookup and then repeats authorization, metadata validation, and a PII-free `VIEW`/`DOWNLOAD` audit inside one transaction.
- Response headers are `private, no-store`, `nosniff`, format MIME, and an RFC 5987 attachment filename with control/path characters removed. Storage errors and races return the same safe 404 response.
- RED: focused test initially failed because the route module did not exist. GREEN: focused Vitest verifies success, exact version, foreign/nonexistent concealment, driver rejection, invalid path-shaped parameters, safe filename, DOWNLOAD/VIEW audit, and stale-current-version rejection.
- Verification: focused Vitest (5/5), `npm run typecheck`, targeted Prettier, and `git diff --check` pass.
