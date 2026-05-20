-- Service: new pricing fields
ALTER TABLE "Service" ADD COLUMN "pricingMode" TEXT NOT NULL DEFAULT 'FIXED';
ALTER TABLE "Service" ADD COLUMN "breedScope" TEXT NOT NULL DEFAULT 'ALL';
ALTER TABLE "Service" ADD COLUMN "isDefault" BOOLEAN NOT NULL DEFAULT false;

-- BreedServicePrice: per-breed pricing
CREATE TABLE "BreedServicePrice" (
    "id" TEXT NOT NULL,
    "breedId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "priceCents" INTEGER,
    "priceLongCents" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BreedServicePrice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BreedServicePrice_breedId_serviceId_key" ON "BreedServicePrice"("breedId", "serviceId");
CREATE INDEX "BreedServicePrice_breedId_idx" ON "BreedServicePrice"("breedId");
CREATE INDEX "BreedServicePrice_serviceId_idx" ON "BreedServicePrice"("serviceId");

ALTER TABLE "BreedServicePrice" ADD CONSTRAINT "BreedServicePrice_breedId_fkey" FOREIGN KEY ("breedId") REFERENCES "Breed"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BreedServicePrice" ADD CONSTRAINT "BreedServicePrice_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;
