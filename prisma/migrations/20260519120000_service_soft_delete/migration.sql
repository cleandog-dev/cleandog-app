-- Soft-delete for Service + serviceName snapshot on Booking
ALTER TABLE "Service" ADD COLUMN "deletedAt" TIMESTAMP(3);
CREATE INDEX "Service_deletedAt_idx" ON "Service"("deletedAt");

ALTER TABLE "Booking" ADD COLUMN "serviceName" TEXT;

-- Backfill snapshot for existing bookings
UPDATE "Booking" b
SET "serviceName" = s."name"
FROM "Service" s
WHERE b."serviceId" = s."id" AND b."serviceName" IS NULL;
