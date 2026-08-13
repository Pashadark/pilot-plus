-- Validate the populated Vehicle foreign key after its quick NOT VALID attachment. This takes
-- a lighter validation lock but still fails fast under contention.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '10min';

ALTER TABLE "public"."Vehicle"
VALIDATE CONSTRAINT "Vehicle_archivedByUserId_fkey";
