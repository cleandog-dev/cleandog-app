-- Custom ordering for services
ALTER TABLE "Service" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX "Service_sortOrder_idx" ON "Service"("sortOrder");

-- Seed sortOrder from current alphabetical name order so admin starts from a stable list.
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY "forAnimal" ORDER BY name) * 10 AS rn
  FROM "Service"
)
UPDATE "Service" s SET "sortOrder" = r.rn FROM ranked r WHERE s.id = r.id;
