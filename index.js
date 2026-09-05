const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const cors = require("cors");
const app = express();
require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const port = process.env.PORT || 3000;

const crypto = require("crypto");

function generateTrackingId() {
  const prefix = "PRCL";

  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");

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

  next();
};
// Middleware: Verify Admin
// Must be used after verifyFBToken middleware

const verifyAdmin = async (req, res, next) => {
  try {
    const email = req.decoded_email;

    const query = { email };
    const user = await userCollection.findOne(query);

    if (!user || user.role !== "admin") {
      return res.status(403).send({
        message: "Forbidden Access",
      });
    }

    next();
  } catch (error) {
    res.status(500).send({
      message: "Internal Server Error",
      error: error.message,
    });
  }
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
    const trackingCollection = db.collection("tracking");

    // Log Tracking
    const logTracking = async (trackingId, status) => {
      const log = {
        trackingId,
        status,
        details: status.split("-").join(" "),
        createdAt: new Date(),
      };

      const result = await trackingCollection.insertOne(log);

      return result;
    };

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
    app.get("/users", verifyFBToken, async (req, res) => {
      const searchText = req.query.searchText || "";

      let query = {};

      if (searchText) {
        query = {
          $or: [
            { name: { $regex: searchText, $options: "i" } },
            { email: { $regex: searchText, $options: "i" } },
          ],
        };
      }

      const result = await usersCollection
        .find(query)
        .sort({ createdAt: -1 })
        .toArray();

      res.send(result);
    });

    // Make Admin
    app.patch(
      "/users/admin/:id",
      verifyFBToken,

      async (req, res) => {
        const { id } = req.params;

        const result = await usersCollection.updateOne(
          { _id: new ObjectId(id) },
          {
            $set: {
              role: "admin",
            },
          },
        );

        res.send(result);
      },
    );
    // Removed Admin
    app.patch(
      "/users/remove-admin/:id",
      verifyFBToken,

      async (req, res) => {
        const { id } = req.params;

        const result = await usersCollection.updateOne(
          { _id: new ObjectId(id) },
          {
            $set: {
              role: "user",
            },
          },
        );

        res.send(result);
      },
    );

    app.get("/users/:email/role", verifyFBToken, async (req, res) => {
      const email = req.params.email;

      const user = await usersCollection.findOne({ email });

      if (!user) {
        return res.status(404).send({ role: "user" });
      }

      res.send({
        role: user.role || "user",
      });
    });

    // !------------------------Riders Related Api---------------------------------------------
    app.get("/riders", async (req, res) => {
      const { status, district, workStatus } = req.query;
      const query = {};
      if (status) {
        query.status = req.query.status;
      }
      if (district) {
        query.district = district;
      }
      if (workStatus) {
        query.workStatus = workStatus;
      }
      const cursor = ridersCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });
    app.post("/riders", async (req, res) => {
      const rider = req.body;

      // Check user role
      const user = await usersCollection.findOne({
        email: rider.email,
      });

      if (user?.role === "admin") {
        return res.status(403).send({
          success: false,
          message:
            "Administrator accounts are not eligible to apply for the Rider Program.",
        });
      }

      rider.status = "pending";
      rider.createdAt = new Date();

      const result = await ridersCollection.insertOne(rider);

      res.send(result);
    });

    app.patch("/riders/:id", verifyFBToken, async (req, res) => {
      try {
        const { status, email } = req.body;
        const id = req.params.id;

        const riderResult = await ridersCollection.updateOne(
          { _id: new ObjectId(id) },
          {
            $set: {
              status,
              workStatus: status === "approved" ? "available" : "unavailable",
            },
          },
        );

        const role = status === "approved" ? "rider" : "user";

        const userResult = await usersCollection.updateOne(
          { email },
          {
            $set: { role },
          },
        );

        res.send({
          success: true,
          riderResult,
          userResult,
          message: `Rider ${status} successfully`,
        });
      } catch (error) {
        console.error(error);
        res.status(500).send({
          success: false,
          message: "Failed to update rider status",
        });
      }
    });

    app.delete("/riders/:id", verifyFBToken, async (req, res) => {
      const id = req.params.id;

      const result = await ridersCollection.deleteOne({
        _id: new ObjectId(id),
      });

      res.send(result);
    });

    // aggregate pipeline with lookup to get rider details with parcels

    app.get("/riders/delivery-per-day", async (req, res) => {
      try {
        const { email } = req.query;

        if (!email) {
          return res.status(400).send({
            success: false,
            message: "Rider email is required",
          });
        }

        const pipeline = [
          {
            $match: {
              riderEmail: email,
              deliveryStatus: "delivered",
            },
          },
          {
            $group: {
              _id: {
                $dateToString: {
                  format: "%Y-%m-%d",
                  date: "$createdAt",
                },
              },
              count: {
                $sum: 1,
              },
            },
          },
          {
            $sort: {
              _id: 1,
            },
          },
        ];

        const result = await parcelCollection.aggregate(pipeline).toArray();

        res.send(result);
      } catch (error) {
        res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });

    //!-------------------------------------- Parcel API---------------------------------
    app.get("/parcels", async (req, res) => {
      const query = {};
      const { email, deliveryStatus } = req.query;
      if (email) {
        query.senderEmail = email;
      }
      if (deliveryStatus) {
        query.deliveryStatus = deliveryStatus;
      }
      const options = { sort: { createdAt: -1 } }; // Sort by createdAt in descending order
      const cursor = parcelCollection.find(query, options);
      const result = await cursor.toArray();
      res.send(result);
    });

    app.patch("/parcels/:id", async (req, res) => {
      try {
        const { riderId, riderName, riderEmail } = req.body;
        const id = req.params.id;

        // Update Parcel
        const parcelResult = await parcelCollection.updateOne(
          { _id: new ObjectId(id) },
          {
            $set: {
              deliveryStatus: "driver_assigned",
              riderId,
              riderName,
              riderEmail,
            },
          },
        );

        // Get updated parcel
        const parcel = await parcelCollection.findOne({
          _id: new ObjectId(id),
        });

        // Update Rider
        const riderResult = await ridersCollection.updateOne(
          { _id: new ObjectId(riderId) },
          {
            $set: {
              workStatus: "in_delivery",
            },
          },
        );

        // Save tracking history
        if (parcel?.trackingId) {
          await logTracking(parcel.trackingId, "driver_assigned");
        }

        res.send({
          success: true,
          parcelResult,
          riderResult,
        });
      } catch (error) {
        res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });

    app.get("/parcels/rider", async (req, res) => {
      try {
        const { riderEmail, deliveryStatus } = req.query;

        const query = {};

        if (riderEmail) {
          query.riderEmail = riderEmail;
        }

        if (deliveryStatus) {
          query.deliveryStatus = deliveryStatus;
        }

        const result = await parcelCollection.find(query).toArray();

        res.send(result);
      } catch (error) {
        res.status(500).send({
          message: "Failed to fetch parcels",
          error: error.message,
        });
      }
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

    app.patch("/parcels/:id/status", async (req, res) => {
      try {
        const id = req.params.id;

        if (!ObjectId.isValid(id)) {
          return res.status(400).send({
            message: "Invalid parcel id",
          });
        }

        const { deliveryStatus } = req.body;

        // Update parcel status
        const result = await parcelCollection.updateOne(
          { _id: new ObjectId(id) },
          {
            $set: {
              deliveryStatus,
            },
          },
        );

        const parcel = await parcelCollection.findOne({
          _id: new ObjectId(id),
        });

        if (parcel?.trackingId) {
          await logTracking(parcel.trackingId, deliveryStatus);
        }

        // If parcel delivered or cancelled
        if (deliveryStatus === "delivered" || deliveryStatus === "cancelled") {
          const parcel = await parcelCollection.findOne({
            _id: new ObjectId(id),
          });

          if (parcel?.riderId) {
            await ridersCollection.updateOne(
              {
                _id: new ObjectId(parcel.riderId),
              },
              {
                $set: {
                  workStatus: "available",
                },
              },
            );
          }
        }

        res.send(result);
      } catch (error) {
        res.status(500).send({
          message: error.message,
        });
      }
    });
    app.delete("/parcels/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await parcelCollection.deleteOne(query);
      res.send(result);
    });

    //Get parcel delivery status statistics

    app.get("/parcel/delivery-status/stats", async (req, res) => {
      const pipeline = [
        {
          $group: {
            _id: "$deliveryStatus",
            count: { $sum: 1 },
          },
        },
      ];

      const result = await parcelCollection.aggregate(pipeline).toArray();
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

      res.send({ url: session.url });
    });

    app.patch("/payment-success", async (req, res) => {
      try {
        const sessionId = req.query.session_id;

        if (!sessionId) {
          return res.status(400).send({
            success: false,
            message: "Session ID is required",
          });
        }

        const session = await stripe.checkout.sessions.retrieve(sessionId);

        if (session.payment_status !== "paid") {
          return res.send({
            success: false,
            message: "Payment not completed",
          });
        }

        // Prevent duplicate payment processing
        const existingPayment = await paymentCollection.findOne({
          transactionId: session.payment_intent,
        });

        if (existingPayment) {
          return res.send({
            success: true,
            message: "Payment already processed",
            trackingId: existingPayment.trackingId,
          });
        }

        const trackingId = generateTrackingId();
        const parcelId = session.metadata.parcelId;

        // Update parcel
        const parcelResult = await parcelCollection.updateOne(
          { _id: new ObjectId(parcelId) },
          {
            $set: {
              paymentStatus: "paid",
              deliveryStatus: "Parcel-paid",
              trackingId,
            },
          },
        );

        // Save payment
        const payment = {
          amount: session.amount_total / 100,
          currency: session.currency,
          transactionId: session.payment_intent,
          customerEmail: session.customer_email,
          parcelId,
          parcelName: session.metadata.parcelName,
          paymentStatus: session.payment_status,
          trackingId,
          createdAt: new Date(),
        };

        const paymentResult = await paymentCollection.insertOne(payment);

        // Save tracking history
        await logTracking(trackingId, "pending-Pickup");

        res.send({
          success: true,
          modifyParcel: parcelResult,
          paymentInfo: paymentResult,
          transactionId: session.payment_intent,
          trackingId,
        });
      } catch (error) {
        console.error("Payment Success Error:", error);

        res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });

    // !----------------- Tracking API-----------------------------

    // Get tracking information by tracking ID
    app.get("/trackings/:trackingId", async (req, res) => {
      const { trackingId } = req.params;

      const result = await trackingCollection
        .find({ trackingId })
        .sort({ createdAt: 1 })
        .toArray();

      res.send(result);
    });

    //!___________________________ Payment related API_____________________________________________
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
    // await client.db("admin").command({ ping: 1 });
    // console.log(
    //   "Pinged your deployment. You successfully connected to MongoDB!",
    // );
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
