import express from "express";
import { Prisma } from "./generated/prisma/client.js";
import { prisma } from "./db.js";
const app = express();
app.use(express.json());
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
    await prisma.paymentEvent.create({
        data: {
            eventId,
            orderId,
            amountMinor: BigInt(amountMinor),
            type,
            currency
        }
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


app.listen(port,()=>{
    console.log(`server is listening on ${port}`)
})