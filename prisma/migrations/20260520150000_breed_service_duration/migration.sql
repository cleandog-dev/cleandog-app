-- Per-cell duration override. null = inherit Service.durationMin.
ALTER TABLE "BreedServicePrice" ADD COLUMN "durationMin" INTEGER;
