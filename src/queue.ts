import "dotenv/config";
import { Redis } from "ioredis";
import { Queue } from "bullmq";

const host = process.env.REDIS_HOST;
const port = Number(process.env.REDIS_PORT);

if (!host || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("Redis connection settings are invalid");
}

export const queueConnection = new Redis({
    host,
    port,
    maxRetriesPerRequest: 1,
});

queueConnection.on("error", (error) => {
    console.error("Queue connection error:", error.message);
});

export const paymentQueue = new Queue("payment-events", {
    connection: queueConnection,
});