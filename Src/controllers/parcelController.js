const { ObjectId } = require("mongodb");
const { getDB } = require("../config/db");

const getParcels = async (req, res) => {
  try {
    const db = getDB();
    const parcelCollection = db.collection("parcels");

    const query = {};
    const { email, deliveryStatus } = req.query;

    if (email) {
      query.senderEmail = email;
    }

    if (deliveryStatus) {
      query.deliveryStatus = deliveryStatus;
    }

    const result = await parcelCollection
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    res.send(result);
  } catch (error) {
    res.status(500).send({
      message: "Failed to get parcels",
      error: error.message,
    });
  }
};

const getParcelById = async (req, res) => {
  try {
    const db = getDB();
    const parcelCollection = db.collection("parcels");

    const { id } = req.params;

    const result = await parcelCollection.findOne({
      _id: new ObjectId(id),
    });

    res.send(result);
  } catch (error) {
    res.status(500).send({
      message: "Failed to get parcel",
      error: error.message,
    });
  }
};

const createParcel = async (req, res) => {
  try {
    const db = getDB();
    const parcelCollection = db.collection("parcels");

    const parcel = req.body;

    parcel.createdAt = new Date();

    const result = await parcelCollection.insertOne(parcel);

    res.send(result);
  } catch (error) {
    res.status(500).send({
      message: "Failed to create parcel",
      error: error.message,
    });
  }
};

const assignRider = async (req, res) => {
  try {
    const db = getDB();

    const parcelCollection = db.collection("parcels");
    const ridersCollection = db.collection("riders");

    const { riderId, riderName, riderEmail } = req.body;
    const { id } = req.params;

    const parcelResult = await parcelCollection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          deliveryStatus: "driver_assigned",
          riderId,
          riderName,
          riderEmail,
        },
      }
    );

    const riderResult = await ridersCollection.updateOne(
      { _id: new ObjectId(riderId) },
      {
        $set: {
          workStatus: "in_delivery",
        },
      }
    );

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
};

const deleteParcel = async (req, res) => {
  try {
    const db = getDB();
    const parcelCollection = db.collection("parcels");

    const { id } = req.params;

    const result = await parcelCollection.deleteOne({
      _id: new ObjectId(id),
    });

    res.send(result);
  } catch (error) {
    res.status(500).send({
      message: "Failed to delete parcel",
      error: error.message,
    });
  }
};

module.exports = {
  getParcels,
  getParcelById,
  createParcel,
  assignRider,
  deleteParcel,
};