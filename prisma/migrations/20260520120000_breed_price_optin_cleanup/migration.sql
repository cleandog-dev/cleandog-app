-- Existing auto-populated BreedServicePrice rows (active=true + no price set) are
-- treated as opt-out by default. Admin re-enables per breed by setting a price
-- (auto-active) or toggling Attivo.
UPDATE "BreedServicePrice"
SET "active" = false
WHERE "active" = true
  AND "priceCents" IS NULL
  AND "priceLongCents" IS NULL;
