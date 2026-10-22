import "dotenv/config";
import { createHmac } from "node:crypto";

const secret = process.env.WEBHOOK_SECRET;

if (!secret) {
    throw new Error("WEBHOOK_SECRET is missing");
}

const payment = {
    eventId:  "evt_retry_001",
    orderId: "ord_001",
    amountMinor: 25000,
    type: "payment.succeeded",
    currency: "PKR"
};

const body = JSON.stringify(payment);
const bodyBytes = Buffer.from(body, "utf8");

 const timestamp = Math.floor(Date.now() / 1000).toString();
// const timestamp = (
//     Math.floor(Date.now() / 1000) - 600
// ).toString();

const signature = createHmac("sha256", secret)
    .update(timestamp + ".")
    .update(bodyBytes)
    .digest("hex");

    const alteredBody = Buffer.from(
    JSON.stringify({ ...payment, amountMinor: 50000 }),
    "utf8"
);

const response = await fetch(
    "http://localhost:3000/webhooks/payments",
    {
        method: "POST",
       headers: {
    "Content-Type": "application/json",
    "X-Webhook-Signature": signature,
    "X-Webhook-Timestamp": timestamp
},
        body: bodyBytes
    }
);

console.log("HTTP status:", response.status);
console.log("Response:", await response.text());