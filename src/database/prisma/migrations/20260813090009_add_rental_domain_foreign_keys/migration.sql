-- This transactional wave follows every supporting legacy-table key. The populated Vehicle
-- foreign key is attached without scanning historic rows; 20260813090010 validates it later.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

ALTER TABLE "public"."Vehicle" ADD CONSTRAINT "Vehicle_archivedByUserId_fkey" FOREIGN KEY ("archivedByUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;
ALTER TABLE "public"."ContractTemplateVersion" ADD CONSTRAINT "ContractTemplateVersion_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."ContractTemplateVersion" ADD CONSTRAINT "ContractTemplateVersion_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."Rental" ADD CONSTRAINT "Rental_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."Rental" ADD CONSTRAINT "Rental_companyId_clientId_fkey" FOREIGN KEY ("companyId", "clientId") REFERENCES "public"."Client"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."Rental" ADD CONSTRAINT "Rental_companyId_vehicleId_fkey" FOREIGN KEY ("companyId", "vehicleId") REFERENCES "public"."Vehicle"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."Rental" ADD CONSTRAINT "Rental_companyId_templateVersionId_fkey" FOREIGN KEY ("companyId", "templateVersionId") REFERENCES "public"."ContractTemplateVersion"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."Rental" ADD CONSTRAINT "Rental_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."RentalDriver" ADD CONSTRAINT "RentalDriver_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."RentalDriver" ADD CONSTRAINT "RentalDriver_companyId_rentalId_fkey" FOREIGN KEY ("companyId", "rentalId") REFERENCES "public"."Rental"("companyId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."RentalDriver" ADD CONSTRAINT "RentalDriver_companyId_clientId_fkey" FOREIGN KEY ("companyId", "clientId") REFERENCES "public"."Client"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."RentalDocumentVersion" ADD CONSTRAINT "RentalDocumentVersion_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."RentalDocumentVersion" ADD CONSTRAINT "RentalDocumentVersion_companyId_clientId_rentalId_fkey" FOREIGN KEY ("companyId", "clientId", "rentalId") REFERENCES "public"."Rental"("companyId", "clientId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."RentalDocumentVersion" ADD CONSTRAINT "RentalDocumentVersion_companyId_clientId_clientDocumentId_fkey" FOREIGN KEY ("companyId", "clientId", "clientDocumentId") REFERENCES "public"."ClientDocument"("companyId", "clientId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."RentalDocumentVersion" ADD CONSTRAINT "RentalDocumentVersion_clientDocumentId_clientDocumentVersionId_fkey" FOREIGN KEY ("clientDocumentId", "clientDocumentVersionId") REFERENCES "public"."ClientDocumentVersion"("documentId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
