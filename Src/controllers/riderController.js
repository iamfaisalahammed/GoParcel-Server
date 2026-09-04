const { ObjectId } = require("mongodb");
const { getDB } = require("../config/db");

const getRiders = async (req, res) => {
  try {
    const db = getDB();
    const ridersCollection = db.collection("riders");

    const { status, district, workStatus } = req.query;

    const query = {};

    if (status) query.status = status;
    if (district) query.district = district;
    if (workStatus) query.workStatus = workStatus;

    const result = await ridersCollection.find(query).toArray();

    res.send(result);
  } catch (error) {
    res.status(500).send({
      message: "Failed to get riders",
      error: error.message,
    });
  }
};

const createRider = async (req, res) => {
  try {
    const db = getDB();

    const ridersCollection = db.collection("riders");
    const usersCollection = db.collection("users");

    const rider = req.body;

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
  } catch (error) {
    res.status(500).send({
      message: "Failed to create rider",
      error: error.message,
    });
  }
};

const updateRiderStatus = async (req, res) => {
  try {
    const db = getDB();

    const ridersCollection = db.collection("riders");
    const usersCollection = db.collection("users");

    const { status, email } = req.body;
    const { id } = req.params;

    const riderResult = await ridersCollection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          status,
          workStatus:
            status === "approved" ? "available" : "unavailable",
        },
      }
    );

    const role = status === "approved" ? "rider" : "user";

    const userResult = await usersCollection.updateOne(
      { email },
      {
        $set: {
          role,
        },
      }
    );

    res.send({
      success: true,
      riderResult,
      userResult,
      message: `Rider ${status} successfully`,
    });
  } catch (error) {
    res.status(500).send({
      success: false,
      message: "Failed to update rider status",
      error: error.message,
    });
  }
};

const deleteRider = async (req, res) => {
  try {
    const db = getDB();
    const ridersCollection = db.collection("riders");

    const { id } = req.params;

    const result = await ridersCollection.deleteOne({
      _id: new ObjectId(id),
    });

    res.send(result);
  } catch (error) {
    res.status(500).send({
      message: "Failed to delete rider",
      error: error.message,
    });
  }
};

module.exports = {
  getRiders,
  createRider,
  updateRiderStatus,
  deleteRider,
};