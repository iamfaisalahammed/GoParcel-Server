const express = require("express");
const cors = require("cors");

const userRoutes = require("./routes/userRoutes");
const riderRoutes = require("./routes/riderRoutes");
const parcelRoutes = require("./routes/parcelRoutes");
const paymentRoutes = require("./routes/paymentRoutes");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use("/users", userRoutes);
app.use("/riders", riderRoutes);
app.use("/parcels", parcelRoutes);
app.use("/", paymentRoutes);

// Home Route
app.get("/", (req, res) => {
  res.send("GoParcel API is running");
});

module.exports = app;