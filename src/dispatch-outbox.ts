import { setTimeout as delay } from "node:timers/promises";
import { prisma } from "./db.js";
import { paymentQueue, queueConnection } from "./queue.js";

let stopping = false;

process.once("SIGINT", () => {
    console.log("Stopping dispatcher after current work...");
    stopping = true;
});

async function dispatchBatch() {
    const pending = await prisma.paymentOutbox.findMany({
        where: { enqueuedAt: null },
        orderBy: { createdAt: "asc" },
        take: 100,
    });

    if (pending.length > 0) {
        console.log("Pending outbox records:", pending.length);
    }

    for (const record of pending) {
        if (stopping) {
            break;
        }

        await paymentQueue.add(
            "process-payment",
            { eventId: record.eventId },
            {
                jobId: `payment-${encodeURIComponent(record.eventId)}`,
                attempts: 3,
                backoff: {
                    type: "exponential",
                    delay: 1000,
                },
                removeOnComplete: false,
                removeOnFail: false,
            },
        );

        await prisma.paymentOutbox.updateMany({
            where: {
                eventId: record.eventId,
                enqueuedAt: null,
            },
            data: {
                enqueuedAt: new Date(),
            },
        });

        console.log("Queued payment event:", record.eventId);
    }
}

console.log("Outbox dispatcher started");

try {
    while (!stopping) {
        try {
            await dispatchBatch();
        } catch (error) {
            console.error("Dispatch batch failed; will retry:", error);
        }

        if (!stopping) {
            await delay(5000);
        }
    }
} finally {
    await paymentQueue.close();
    await queueConnection.quit();
    await prisma.$disconnect();

    console.log("Dispatcher stopped");
}