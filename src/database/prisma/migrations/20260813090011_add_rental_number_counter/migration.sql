-- An empty additive counter table.  `nextValue` is advanced inside the same
-- SERIALIZABLE confirmation transaction as the immutable rental snapshot.
CREATE TABLE "public"."RentalNumberCounter" (
    "companyId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "nextValue" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "RentalNumberCounter_pkey" PRIMARY KEY ("companyId", "year"),
    CONSTRAINT "RentalNumberCounter_nextValue_positive_check" CHECK ("nextValue" > 0)
);

ALTER TABLE "public"."RentalNumberCounter"
ADD CONSTRAINT "RentalNumberCounter_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
