# Task 2 — Driver Helper sandbox invoice client report

## RED evidence

Command:

```powershell
npx vitest run src/modules/fines/integrations/driver-helper/client.test.ts src/modules/fines/integrations/driver-helper/payment-url.test.ts
```

Before production implementation, Vitest reported nine failures: `checkInvoice` and
`createSandboxInvoice` did not exist, and `payment-url.ts` could not be resolved.
The six pre-existing client tests remained green. The RED tests covered exact form
encoding, capped responses, 401/402 mapping, malformed/excess/numeric money, empty
and duplicate IDs, forced sandbox mode, and unsafe payment URLs.

## Files

- `src/modules/fines/integrations/driver-helper/client.ts`
- `src/modules/fines/integrations/driver-helper/client.test.ts`
- `src/modules/fines/integrations/driver-helper/schemas.ts`
- `src/modules/fines/integrations/driver-helper/payment-url.ts`
- `src/modules/fines/integrations/driver-helper/payment-url.test.ts`

## Verification

- Focused Vitest: 2 files, 21 tests passed.
- `npm run typecheck` passed.
- Scoped `npx prettier --check` passed for all five task TypeScript files.
- `git diff --check` passed.

No migration, seed, or live Driver Helper invoice request was run.

## Self-review

- Invoice endpoints use POST form data, force `sandbox=1`, preserve the existing
  timeout/response cap/error mapping boundary, and never log tokens, callback URLs,
  payment URLs, or provider payloads.
- Callback URLs must be supplied by server-side trusted callers and are restricted to
  HTTPS without credentials or fragments. The API rejects any explicit non-true
  sandbox input before it can issue a request.
- Response schemas support documented snake-case and Cyrillic money field variants,
  reject numeric, malformed, and out-of-range values, and convert valid decimal
  strings with `BigInt` only. Returned minor units are serialized strings.
- Payment URLs are accepted only for the explicit Driver Helper payment-host allowlist,
  HTTPS, no credentials, no port, query, or fragment; only the vetted URL and hostname
  are returned. This task persists nothing.

## Concerns

The production endpoint protocol was deliberately not called. Before enabling a
non-sandbox integration, confirm the provider's current payment-host allowlist and
callback parameter names against its authenticated documentation; this release remains
sandbox-only and has no caller wired to untrusted client input.

## Transport hardening follow-up

### RED evidence

The focused client/payment-URL command initially reported eight failures after the
adversarial tests were added: constructor callback configuration was ignored, supplied
attacker callback URLs were sent in the form body, malformed configured callback URLs
were accepted, and a no-`content-length` chunked response timed out because the old
reader waited for the stream to close.

### Fix and exact verification

- `paymentCallbacks` is now constructor-only configuration. Public invoice input has
  no callback fields, and the constructor validates the configured exact URLs as HTTPS
  origin/path values without credentials, port, query, or fragment.
- `boundedJson` now reads incrementally, accounts for each chunk before retaining it,
  and cancels the reader immediately above the 2 MiB cap. The `content-length` cap is
  retained as an early rejection.
- `npx vitest run src/modules/fines/integrations/driver-helper/client.test.ts src/modules/fines/integrations/driver-helper/payment-url.test.ts` — passed: 2 files, 28 tests.
- `npm run typecheck` — passed.
- Scoped `npx prettier --check` — passed.
- `git diff --check` — passed.

No migration, seed, or live Driver Helper invoice call was run.
