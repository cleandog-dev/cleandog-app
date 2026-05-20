-- Booking: price snapshot + reminder tracking
ALTER TABLE "Booking" ADD COLUMN "bathCents" INTEGER;
ALTER TABLE "Booking" ADD COLUMN "trimCents" INTEGER;
ALTER TABLE "Booking" ADD COLUMN "touchUpCents" INTEGER;
ALTER TABLE "Booking" ADD COLUMN "extrasCents" INTEGER;
ALTER TABLE "Booking" ADD COLUMN "extrasJson" TEXT;
ALTER TABLE "Booking" ADD COLUMN "coatChoice" TEXT;
ALTER TABLE "Booking" ADD COLUMN "reminderSentAt" TIMESTAMP(3);

CREATE INDEX "Booking_customerPhone_idx" ON "Booking"("customerPhone");

-- PushSubscription
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "userId" TEXT,
    "customerPhone" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");
CREATE INDEX "PushSubscription_scope_idx" ON "PushSubscription"("scope");
CREATE INDEX "PushSubscription_userId_idx" ON "PushSubscription"("userId");
CREATE INDEX "PushSubscription_customerPhone_idx" ON "PushSubscription"("customerPhone");

-- NotificationLog
CREATE TABLE "NotificationLog" (
    "id" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "bookingId" TEXT,
    "subscriptionId" TEXT,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "payload" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "NotificationLog_event_createdAt_idx" ON "NotificationLog"("event", "createdAt");
CREATE INDEX "NotificationLog_bookingId_idx" ON "NotificationLog"("bookingId");
