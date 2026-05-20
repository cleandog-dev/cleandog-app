-- New table: per-breed size options (variants)
CREATE TABLE "BreedSizeOption" (
  "id" TEXT NOT NULL,
  "breedId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BreedSizeOption_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BreedSizeOption_breedId_idx" ON "BreedSizeOption"("breedId");

ALTER TABLE "BreedSizeOption" ADD CONSTRAINT "BreedSizeOption_breedId_fkey"
  FOREIGN KEY ("breedId") REFERENCES "Breed"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- BreedServicePrice: add size + coat axes; drop the old (breedId,serviceId) unique.
ALTER TABLE "BreedServicePrice" DROP CONSTRAINT IF EXISTS "BreedServicePrice_breedId_serviceId_key";
DROP INDEX IF EXISTS "BreedServicePrice_breedId_serviceId_key";

ALTER TABLE "BreedServicePrice" ADD COLUMN "sizeOptionId" TEXT;
ALTER TABLE "BreedServicePrice" ADD COLUMN "coat" TEXT;

ALTER TABLE "BreedServicePrice" ADD CONSTRAINT "BreedServicePrice_sizeOptionId_fkey"
  FOREIGN KEY ("sizeOptionId") REFERENCES "BreedSizeOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "BreedServicePrice_breedId_serviceId_idx" ON "BreedServicePrice"("breedId", "serviceId");
CREATE INDEX "BreedServicePrice_sizeOptionId_idx" ON "BreedServicePrice"("sizeOptionId");

-- Booking: size snapshot
ALTER TABLE "Booking" ADD COLUMN "sizeOptionId" TEXT;
ALTER TABLE "Booking" ADD COLUMN "dogSizeLabel" TEXT;

ALTER TABLE "Booking" ADD CONSTRAINT "Booking_sizeOptionId_fkey"
  FOREIGN KEY ("sizeOptionId") REFERENCES "BreedSizeOption"("id") ON DELETE SET NULL ON UPDATE CASCADE;
