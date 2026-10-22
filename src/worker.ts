import "dotenv/config";
import { Redis } from "ioredis";
import { Worker } from "bullmq";
import { prisma } from "./db.js";

const host = process.env.REDIS_HOST;
const port = Number(process.env.REDIS_PORT);

if (!host || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("Redis connection settings are invalid");
}

const workerConnection = new Redis({
    host,
    port,
    maxRetriesPerRequest: null,
});

workerConnection.on("error", (error) => {
    console.error("Worker connection error:", error.message);
});

const worker = new Worker(
    "payment-events",

    async (job) => {
        const eventId = job.data?.eventId;

        if (typeof eventId !== "string" || eventId.trim() === "") {
            throw new Error("Job eventId must be a non-empty string");
        }

        console.log("Processing job:", job.id);

        const payment = await prisma.paymentEvent.findUnique({
            where: { eventId },
        });

        if (!payment) {
            throw new Error(`Payment event not found: ${eventId}`);
        }
        console.log("Processing attempt:", job.attemptsMade + 1);

// TEMPORARY: simulate one failed attempt for this test event.


       const result = await prisma.paymentEvent.updateMany({
    where: {
        eventId,
        processedAt: null,
    },
    data: {
        processedAt: new Date(),
    },
});

if (result.count === 0) {
    console.log("Already processed, skipping:", eventId);

    return { eventId, skipped: true };
}

console.log("Marked as processed:", eventId);

return { eventId, processed: true };
    },

    {
        connection: workerConnection,
    },
);

worker.on("completed", (job, result) => {
    console.log("Completed job:", job.id, result);
});

worker.on("failed", (job, error) => {
    console.error("Failed job:", job?.id, error.message);
});

worker.on("error", (error) => {
    console.error("Worker error:", error);
});