# Production Operations Upgrade — Design

Date: 2026-09-06

## Goal

Bring the complete daily workflow on `supapro.ru` to a production-ready state: lead intake, client creation, contract creation, vehicle operation, violations, maintenance, rental completion, and historical archive.

## Delivery strategy

The work is delivered in four reversible waves so the running service remains usable:

1. Critical flow repairs: broken dashboard links, contract creation and download, dashboard month period and financial iconography.
2. Dashboard and identity: licensed local weather illustrations, profile banner, company team, and session management.
3. Fleet operations: stable vehicle cards, attributed events, fine evidence, rental archive, and maintenance presentation.
4. Intake automation: complete identity document fields, local OCR with operator review, client portrait extraction, and lead/call tracking.

Each wave must pass focused tests, type checking, and a production build before deployment. Production deployment must create database and private-storage backups before migrations or service restart.

## UX decisions

- Dashboard quick actions target real routes: client creation opens `/clients?form=new`; generic rental creation begins with client selection instead of returning 404.
- Dashboard periods include `month`, calculated as a calendar month view rather than a fixed 30-day approximation.
- Weather uses locally bundled, MIT-licensed animated Meteocons assets. No runtime dependency on a third-party CDN is introduced.
- Financial KPIs use a ruble/coin symbol; dollar imagery is removed.
- Profile banner becomes user-configurable. The redundant company badge on the banner is removed.
- Company view lists employees with avatar, name, role, account status, and last activity.
- Security view lists active sessions and allows terminating one session or all other sessions. The current session is protected from accidental termination.
- Vehicle cards do not translate, scale, or shift images on hover.
- Event attribution resolves the rental and driver that were active at the event timestamp. If no confident match exists, the UI explicitly says that attribution is unavailable.
- Fine evidence is proxied through an authenticated application route when the provider returns a photo. Provider URLs are never exposed as trusted client-side credentials.
- Closed and cancelled rentals older than the active operating window appear in an archive view. Archiving changes presentation, not legal records, and never deletes a rental.
- Rental document download remains access-controlled and supports a clear empty/error state when a document was not generated.
- Maintenance supports a consistent list and a three-column card layout with vehicle image, problem, status, dates, mileage, and cost.
- Passport OCR is a server-side, locally hosted adapter. Extracted fields remain suggestions until the operator reviews them. Missing values remain empty and editable.
- Lead intake stores name, phone, source, comment, responsible employee, next-contact time, and status history. Conversion to a client preserves the lead history.

## Data model additions

- User profile banner metadata and private/public storage reference.
- Revocable user sessions with timestamps, device metadata, and current-session identity.
- Structured client passport and driving-license fields instead of relying only on free-form strings.
- OCR extraction records with confidence and review state; original documents remain in the protected client-document pipeline.
- Lead and lead-status history records scoped to the company.

## Security and privacy

- Every mutation rechecks authentication, company scope, and role on the server.
- Passport files use the existing private upload, validation, malware scanning, and download authorization pipeline.
- OCR processing stays on the VPS by default and does not transmit identity documents to an external provider.
- Session revocation never reveals raw tokens.
- Fine photos and contract files are served through authenticated routes.

## Acceptance criteria

- No dashboard primary action leads to 404.
- Month filtering affects all dashboard summaries consistently.
- Contract creation and document download succeed for authorized users and produce actionable errors otherwise.
- All requested profile, fleet, event, fine, rental archive, maintenance, client-document, and lead flows are covered by automated tests.
- Existing production records remain intact through migration and deployment.
