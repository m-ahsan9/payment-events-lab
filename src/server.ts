import express from "express";
import type { ErrorRequestHandler } from "express";
import { createHmac, timingSafeEqual } from "node:crypto";
import { Prisma } from "./generated/prisma/client.js";
import { prisma } from "./db.js";
const app = express();
const webhookSecret = process.env.WEBHOOK_SECRET;

if (!webhookSecret) {
    throw new Error("WEBHOOK_SECRET is missing");
}
app.use(express.json({
   verify(req, res, buffer) {
    const signature = req.headers["x-webhook-signature"];
    const timestamp = req.headers["x-webhook-timestamp"];

    if (
        typeof signature !== "string" ||
        !/^[0-9a-f]{64}$/.test(signature)
    ) {
        throw new Error("Missing or invalid webhook signature");
    }

    if (
        typeof timestamp !== "string" ||
        !/^[0-9]{1,12}$/.test(timestamp)
    ) {
        throw new Error("Missing or invalid webhook timestamp");
    }

    const timestampSeconds = Number(timestamp);
    const nowSeconds = Math.floor(Date.now() / 1000);

    if (Math.abs(nowSeconds - timestampSeconds) > 300) {
        throw new Error("Webhook timestamp is outside the allowed window");
    }

    const expectedSignature = createHmac("sha256", webhookSecret)
        .update(timestamp + ".")
        .update(buffer)
        .digest();

    const suppliedSignature = Buffer.from(signature, "hex");

    if (!timingSafeEqual(expectedSignature, suppliedSignature)) {
        throw new Error("Webhook signature does not match");
    }
}}))
const port = 3000;


app.get( '/health',(req , res)=> {

    console.log("GET /health received");
res.json({
         status: "ok" ,
        
    })

})
app.post('/webhooks/payments', async(req,res)=>{

    const eventId=req.body?.eventId
    const orderId = req.body?.orderId
    const amountMinor = req.body?.amountMinor
    const type = req.body?.type
    const currency =req.body?.currency
    

    if (typeof eventId!=="string" || eventId.trim()===""){

        return res.status(400).json({error:"eventid must be a non-empty string"})
    }
   

    if (typeof orderId!=="string" || orderId.trim()===""){

        return res.status(400).json({error:"orderId must be a non-empty string"})
    }
   
    if ( !Number.isSafeInteger(amountMinor) || amountMinor <= 0  ){

         return res.status(400).json({ error: "amountMinor must be a positive safe integer" })
    }
    if (type!=="payment.succeeded" ){

        return res.status(400).json({error:"type  must be a non-empty string and equal to payment.succeeded "})
    }
    if (currency!=="PKR" ){

        return res.status(400).json({error:"currency  must be a non-empty string and equal to PKR "})
    }
    try {
 await prisma.$transaction(async (tx) => {
    await tx.paymentEvent.create({
        data: {
            eventId,
            orderId,
            amountMinor: BigInt(amountMinor),
            type,
            currency,
        },
    });

    await tx.paymentOutbox.create({
        data: {
            eventId,
        },
    });

    });

    return res.status(200).json({ received: true });

} 


catch (error) {
    if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
    ) {
        try {
            const existing = await prisma.paymentEvent.findUnique({
                where: { eventId }
            });

            if (existing) {
                const identical =
                    existing.orderId === orderId &&
                    existing.amountMinor === BigInt(amountMinor) &&
                    existing.type === type &&
                    existing.currency === currency;

                if (identical) {
                    return res.status(200).json({
                        received: true,
                        duplicate: true
                    });
                }

                return res.status(409).json({
                    error: "eventId already exists with different payment data"
                });
            }
        } catch (lookupError) {
            console.error("Failed to look up existing event:", lookupError);
        }
    }

    console.error("Failed to save payment event:", error);

    return res.status(500).json({
        error: "Failed to save payment event"
    });
}

                                                         
})

app.get("/payment-events/:eventId", async (req, res) => {
    const eventId = req.params.eventId;

    try {
        const payment = await prisma.paymentEvent.findUnique({
            where: { eventId },
            select: {
                eventId: true,
                receivedAt: true,
                processedAt: true,
                outbox: {
                    select: {
                        enqueuedAt: true,
                    },
                },
            },
        });

        if (!payment) {
            return res.status(404).json({
                error: "Payment event not found",
            });
        }

        let status = "received";

        if (payment.processedAt !== null) {
            status = "processed";
        } else if (payment.outbox?.enqueuedAt != null) {
            status = "dispatched";
        } else if (payment.outbox !== null) {
            status = "pending_dispatch";
        }

        return res.json({
            eventId: payment.eventId,
            status,
            receivedAt: payment.receivedAt,
            enqueuedAt: payment.outbox?.enqueuedAt ?? null,
            processedAt: payment.processedAt,
        });
    } catch (error) {
        console.error("Failed to read payment event:", error);

        return res.status(500).json({
            error: "Failed to read payment event",
        });
    }
});

const errorHandler: ErrorRequestHandler = (
    error: unknown,
    req,
    res,
    next
) => {
    if (
        error instanceof Error &&
        "type" in error &&
        error.type === "entity.verify.failed"
    ) {
        return res.status(403).json({
            error: "Invalid webhook signature"
        });
    }

    next(error);
};

app.use(errorHandler);


app.listen(port,()=>{
    console.log(`server is listening on ${port}`)
})