// Src/middlewares/verifyAdmin.js

const { getDB } = require("../config/db");

const verifyAdmin = async (req, res, next) => {
  try {
    const email = req.decoded_email;

    const db = getDB();
    const usersCollection = db.collection("users");

    const user = await usersCollection.findOne({ email });

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

module.exports = verifyAdmin;