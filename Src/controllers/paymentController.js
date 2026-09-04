const { ObjectId } = require("mongodb");
const { getDB } = require("../config/db");

const {
  createCheckoutSession,
  getCheckoutSession,
} = require("../services/stripeService");

const generateTrackingId = require("../utils/generateTrackingId");

const createPaymentSession = async (req, res) => {
  try {
    const paymentInfo = req.body;

    const session = await createCheckoutSession(paymentInfo);

    res.send({
      url: session.url,
    });
  } catch (error) {
    res.status(500).send({
      message: "Failed to create checkout session",
      error: error.message,
    });
  }
};

const paymentSuccess = async (req, res) => {
  try {
    const db = getDB();

    const parcelCollection = db.collection("parcels");
    const paymentCollection = db.collection("payments");

    const sessionId = req.query.session_id;

    const session = await getCheckoutSession(sessionId);

    const trackingId = generateTrackingId();

    if (session.payment_status === "paid") {
      const id = session.metadata.parcelId;

      const result = await parcelCollection.updateOne(
        { _id: new ObjectId(id) },
        {
          $set: {
            paymentStatus: "paid",
            deliveryStatus: "pending-Pickup",
            trackingId,
          },
        }
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

    res.send({
      success: false,
    });
  } catch (error) {
    res.status(500).send({
      success: false,
      message: error.message,
    });
  }
};

const getPayments = async (req, res) => {
  try {
    const db = getDB();
    const paymentCollection = db.collection("payments");

    const { email } = req.query;

    const query = {};

    if (email) {
      query.customerEmail = email;
    }

    const result = await paymentCollection
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    res.send(result);
  } catch (error) {
    res.status(500).send({
      message: "Failed to get payments",
      error: error.message,
    });
  }
};

module.exports = {
  createPaymentSession,
  paymentSuccess,
  getPayments,
};