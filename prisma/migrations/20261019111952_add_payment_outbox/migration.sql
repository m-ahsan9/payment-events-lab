-- CreateTable
CREATE TABLE "PaymentOutbox" (
    "eventId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enqueuedAt" TIMESTAMP(3),

    CONSTRAINT "PaymentOutbox_pkey" PRIMARY KEY ("eventId")
);

-- CreateIndex
CREATE INDEX "PaymentOutbox_enqueuedAt_createdAt_idx" ON "PaymentOutbox"("enqueuedAt", "createdAt");

-- AddForeignKey
ALTER TABLE "PaymentOutbox" ADD CONSTRAINT "PaymentOutbox_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "PaymentEvent"("eventId") ON DELETE RESTRICT ON UPDATE CASCADE;
