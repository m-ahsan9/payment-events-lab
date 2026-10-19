import { paymentQueue, queueConnection } from "./queue.js";

try {
    const job = await paymentQueue.add("process-payment", {
        eventId: "evt_002",
    });

    console.log("Job ID:", job.id);
    console.log("Job name:", job.name);
    console.log("Job data:", job.data);
    console.log("Job state:", await job.getState());
}  finally {
    await paymentQueue.close();
    await queueConnection.quit();
}