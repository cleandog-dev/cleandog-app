-- AlterTable
ALTER TABLE "Breed" ADD COLUMN     "coatType" TEXT;

-- AlterTable
ALTER TABLE "Service" DROP COLUMN "priceFullGroomCents",
DROP COLUMN "priceTrimCents",
ADD COLUMN     "priceCoatLongMaxCents" INTEGER,
ADD COLUMN     "priceCoatLongMinCents" INTEGER,
ADD COLUMN     "priceCoatShortMaxCents" INTEGER,
ADD COLUMN     "priceCoatShortMinCents" INTEGER;
