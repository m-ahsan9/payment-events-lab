import express from "express";

const app = express();
app.use(express.json());
const port = 3000;


app.get( '/health',(req , res)=> {

    console.log("GET /health received");
res.json({
         status: "ok" ,
        
    })

})
app.post('/webhooks/payments',(req,res)=>{

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
    

    
    console.log(req.body)
    return res.status(200).json({ received: true })
                                                         


                                                         
})


app.listen(port,()=>{
    console.log(`server is listening on ${port}`)
})