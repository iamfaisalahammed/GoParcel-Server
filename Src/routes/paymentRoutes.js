const express = require("express");
const router = express.Router();

const {
  createPaymentSession,
  paymentSuccess,
  getPayments,
} = require("../controllers/paymentController");

const verifyFBToken = require("../middlewares/verifyFBToken");

router.post("/create-checkout-session", createPaymentSession);

router.patch("/payment-success", paymentSuccess);

router.get("/payments", verifyFBToken, getPayments);

module.exports = router;