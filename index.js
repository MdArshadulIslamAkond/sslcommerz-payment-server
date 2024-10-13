const express = require('express');
const cors = require('cors');
require('dotenv').config();
const axios = require('axios');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const SSLCommerzPayment = require('sslcommerz-lts');
const app = express();
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded());


// MongoDB connection URI
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.jp5aibk.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
}); 
const store_id = process.env.DB_STORE_ID
const store_passwd = process.env.DB_STORE_PASS
const is_live = false //true for live, false for sandbox
console.log(process.env.DB_STORE_ID)
console.log(process.env.DB_STORE_PASS)
async function run() {
  try {

    const paymentCollection = client.db("sslcommerzDB").collection("payment")
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    app.post('/create-payment', async (req, res) => {
        const paymentInfo = req.body;
        // console.log(paymentInfo);
        const tran_id = new ObjectId().toString();
        const initialData = {
            total_amount:parseFloat(paymentInfo.amount),
            currency: paymentInfo.currency,
            tran_id: tran_id, // use unique tran_id for each api call
            success_url:`http://localhost:5000/success-payment/${tran_id}`,
            fail_url: `http://localhost:5000/fail-payment/${tran_id}`,
            cancel_url: `http://localhost:5000/cancle-payment/${tran_id}`,
            ipn_url: 'http://localhost:5000/ipn',
            shipping_method: 'Courier',
            product_name: 'Computer.',
            product_category: 'Electronic',
            product_profile: 'general',
            cus_name: paymentInfo.name, 
            cus_email: paymentInfo.email,
            cus_add1: paymentInfo.address,
            cus_add2: 'Dhaka',
            cus_city: 'Dhaka',
            cus_state: paymentInfo.state,
            cus_postcode: paymentInfo.postalCode,
            cus_country: 'Bangladesh',
            cus_phone: '01711111111',
            cus_fax: '01711111111',
            ship_name: 'Customer Name',
            ship_add1: 'Dhaka',
            ship_add2: 'Dhaka',
            ship_city: 'Dhaka',
            ship_state: 'Dhaka',
            ship_postcode: 1000,
            ship_country: 'Bangladesh',
        };
        const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live)
        sslcz.init(initialData).then(async(apiResponse) => {
            // Redirect the user to payment gateway
            let GatewayPageURL = apiResponse.GatewayPageURL
           
            const finalPayment = {
                name: paymentInfo.name,
                email: paymentInfo.email,
                amount: paymentInfo.amount,
                currency: paymentInfo.currency,
                tranjectionId: tran_id,
                paidStatus: "pending",
            }
            const result = await paymentCollection.insertOne(finalPayment);
            if(result){
                res.send({url:GatewayPageURL})
            }
            // console.log('Redirecting to: ', GatewayPageURL)
        });
        // const response = await axios({
        //     method: 'POST',
        //     url: 'https://sandbox.sslcommerz.com/gwprocess/v4/api.php',
        //     data: initialData,
        //     headers: {
        //         'Content-Type': 'application/x-www-form-urlencoded'
        //     }
        // })
        
        // res.send(paymentInfo);
    })

    app.post("/success-payment/:tranId", async (req, res) => {
        const tran_id = req.params.tranId;
        const success = req.body;
        if(success.status !== "VALID"){
            throw new Error("Unauthorized Payment or Invalid Transaction")
        }
        
        // Update the database
        const query = {tranjectionId: tran_id};
        const result = await paymentCollection.updateOne(query, {$set: {paidStatus: "Success"}})
        if(result.matchedCount > 0){
            res.redirect(`http://localhost:5173/success/${tran_id}`)
        }
        // console.log("success payment:", tran_id);
    });

    app.post("/fail-payment/:tranId", async (req, res) => {
        const tran_id = req.params.tranId;
        const fail = req.body;
        // Update the database
        const query = {tranjectionId: tran_id};
        // const result = await paymentCollection.updateOne(query, {$set: {paidStatus: "Failed"}})
        // if(result.matchedCount > 0){
        //     res.redirect(`http://localhost:5173/fail/${tran_id}`)
        // }
        // delete order the database
        const result = await paymentCollection.deleteOne(query);
        if(result.deletedCount > 0){
            res.redirect(`http://localhost:5173/fail/${tran_id}`)
        }
        
    })
    
    app.post("/cancle-payment/:tranId", async (req, res) => {
        const tran_id = req.params.tranId;
        const cancle = req.body;
        // Update the database
        const query = {tranjectionId: tran_id};
        // const result = await paymentCollection.updateOne(query, {$set: {paidStatus: "Canceled"}})
        // if(result.matchedCount > 0){
        //     res.redirect(`http://localhost:5173/cancle/${tran_id}`)
        // }
        // delete order the database
        const result = await paymentCollection.deleteOne(query);
        if(result.deletedCount > 0){
            res.redirect(`http://localhost:5173/cancle/${tran_id}`)
        }
       
    })
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  } 
}
run().catch(console.dir);


app.get('/', (req, res)=>{
    res.send("SSLCOMMERZ Payment server is running");
})

app.listen(port, ()=>{
    console.log(`SSLCOMMERZ Payment server is running on port ${port}`);
})