-- CreateTable
CREATE TABLE "Breed" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "animalType" TEXT NOT NULL,
    "size" "DogSize",
    "priceMin" INTEGER NOT NULL,
    "priceMax" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Breed_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Breed_name_key" ON "Breed"("name");

-- CreateIndex
CREATE INDEX "Breed_animalType_active_idx" ON "Breed"("animalType", "active");

-- CreateIndex
CREATE INDEX "Breed_size_idx" ON "Breed"("size");
