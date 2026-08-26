const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const cors = require("cors");
const app = express();
require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const port = process.env.PORT || 3000;

const crypto = require("crypto");

// const admin = require("firebase-admin");

// const serviceAccount = require("./goparcel-aea49-firebase-adminsdk-fbsvc-0d2735d7ac.json");

// admin.initializeApp({
//   credential: admin.credential.cert(serviceAccount)
// });

function generateTrackingId() {
  const prefix = "PRCL"; // your brand prefix

  // YYYYMMDD
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");

  // 6-char random hex
  const random = crypto.randomBytes(3).toString("hex").toUpperCase();

  return `${prefix}-${date}-${random}`;
}

// Middleware
app.use(cors());
app.use(express.json());

const verifyFBToken = async (req, res, next) => {
  const token = req.headers.authorization;
  if (!token) {
    return res.status(401).send({ message: "unauthorized access" });
  }
  // try {
  //   const idToken = token.split("")[1];
  //   const decoded = await admin.auth().verifyFBToken(idToken);
  //   console.log("decoded in the token", decoded);
  // } catch (err) {}

  next();
};

// Database Connection
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.qq6y6.mongodb.net/?appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // !--DataBase Collection
    const db = client.db("go_parcel");
    const parcelCollection = db.collection("parcels");
    const paymentCollection = db.collection("payments");
    const usersCollection = db.collection("users");
    const ridersCollection = db.collection("riders");

    //!--------------------------User related api---------------------------------
    app.post("/users", async (req, res) => {
      const user = req.body;
      user.role = "user";
      user.createdAt = new Date();
      const email = user.email;
      const userExists = await usersCollection.findOne({ email });
      if (userExists) {
        return res.send({ message: "User Exists" });
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    // !------------------------Riders Related Api---------------------------------------------
    app.get("/riders", async (req, res) => {
      const query = {};
      if (req.query.status) {
        query.status = req.query.status;
      }
      const cursor = ridersCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });
    app.post("/riders", async (req, res) => {
      const rider = req.body;
      rider.status = "pending";
      rider.createdAt = new Date();
      const result = await ridersCollection.insertOne(rider);
      res.send(result);
    });

    app.patch("/riders/:id", verifyFBToken, async (req, res) => {
      const status = req.body.status;
      const id = req.params.id;

      const query = { _id: new ObjectId(id) };

      const updatedDoc = {
        $set: {
          status: status,
        },
      };

      const result = await ridersCollection.updateOne(query, updatedDoc);

      if (status === "approved") {
        const email = req.body.email;

        const userQuery = {
          email: email,
        };

        const updateUser = {
          $set: {
            role: "rider",
          },
        };

        const userResult = await usersCollection.updateOne(
          userQuery,
          updateUser,
        );
      }

      res.send(result);
    });

    app.delete("/riders/:id", verifyFBToken, async (req, res) => {
      const id = req.params.id;

      const result = await ridersCollection.deleteOne({
        _id: new ObjectId(id),
      });

      res.send(result);
    });

    //!-------------------------------------- Parcel API---------------------------------
    app.get("/parcels", async (req, res) => {
      const query = {};
      const { email } = req.query;
      if (email) {
        query.senderEmail = email;
      }
      const options = { sort: { createdAt: -1 } }; // Sort by createdAt in descending order
      const cursor = parcelCollection.find(query, options);
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/parcels/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await parcelCollection.findOne(query);
      res.send(result);
    });

    app.post("/parcels", async (req, res) => {
      const parcel = req.body;
      // parcels created time
      parcel.createdAt = new Date();
      const result = await parcelCollection.insertOne(parcel);
      res.send(result);
    });

    app.delete("/parcels/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await parcelCollection.deleteOne(query);
      res.send(result);
    });

    //!----------------- Stripe API--------------Payment--------------------------------
    app.post("/create-checkout-session", async (req, res) => {
      const paymentInfo = req.body;
      const amount = paymentInfo.cost * 100; // Convert to cents
      const session = await stripe.checkout.sessions.create({
        line_items: [
          {
            price_data: {
              currency: "usd",
              unit_amount: amount,
              product_data: {
                name: paymentInfo.parcelName,
              },
            },
            quantity: 1,
          },
        ],
        customer_email: paymentInfo.senderEmail,
        mode: "payment",
        metadata: {
          parcelId: paymentInfo.parcelId,
          parcelName: paymentInfo.parcelName,
        },
        success_url: `${process.env.SITE_DOMAIN}/dashboard/payment-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.SITE_DOMAIN}/dashboard/payment-cancelled`,
      });

      console.log(session);
      res.send({ url: session.url });
    });

    app.patch("/payment-success", async (req, res) => {
      const sessionId = req.query.session_id;
      console.log("sessionid", sessionId);
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      console.log("session retrieve", session);
      const trackingId = generateTrackingId();

      if (session.payment_status === "paid") {
        const id = session.metadata.parcelId;

        const result = await parcelCollection.updateOne(
          { _id: new ObjectId(id) },
          {
            $set: {
              paymentStatus: "paid",
              trackingId,
            },
          },
        );

        const payment = {
          amount: session.amount_total / 100,
          currency: session.currency,
          transactionId: session.payment_intent,
          customerEmail: session.customer_email,
          parcelId: session.metadata.parcelId,
          parcelName: session.metadata.parcelName,
          paymentStatus: session.payment_status,
          createdAt: new Date(),
        };

        const existingPayment = await paymentCollection.findOne({
          transactionId: session.payment_intent,
        });

        let paymentResult = null;

        if (!existingPayment) {
          paymentResult = await paymentCollection.insertOne(payment);
        }

        return res.send({
          success: true,
          modifyParcel: result,
          transactionId: session.payment_intent,
          trackingId,
          paymentInfo: paymentResult,
        });
      }

      return res.send({ success: false });
    });

    //___________________________ Payment related API_____________________________________________
    app.get("/payments", verifyFBToken, async (req, res) => {
      const email = req.query.email;
      const query = {};
      if (email) {
        query.customerEmail = email;
      }
      const cursor = paymentCollection.find(query).sort({ createdAt: -1 });
      const result = await cursor.toArray();
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("GoParcel API is running");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
