const { getDB } = require("../config/db");

const createUser = async (req, res) => {
  try {
    const db = getDB();
    const usersCollection = db.collection("users");

    const user = req.body;
    user.role = "user";
    user.createdAt = new Date();

    const userExists = await usersCollection.findOne({
      email: user.email,
    });

    if (userExists) {
      return res.send({ message: "User Exists" });
    }

    const result = await usersCollection.insertOne(user);

    res.send(result);
  } catch (error) {
    res.status(500).send({
      message: "Failed to create user",
      error: error.message,
    });
  }
};

const getUsers = async (req, res) => {
  try {
    const db = getDB();
    const usersCollection = db.collection("users");

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
  } catch (error) {
    res.status(500).send({
      message: "Failed to get users",
      error: error.message,
    });
  }
};

const makeAdmin = async (req, res) => {
  try {
    const db = getDB();
    const usersCollection = db.collection("users");

    const { ObjectId } = require("mongodb");
    const { id } = req.params;

    const result = await usersCollection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          role: "admin",
        },
      }
    );

    res.send(result);
  } catch (error) {
    res.status(500).send({
      message: "Failed to make admin",
      error: error.message,
    });
  }
};

const removeAdmin = async (req, res) => {
  try {
    const db = getDB();
    const usersCollection = db.collection("users");

    const { ObjectId } = require("mongodb");
    const { id } = req.params;

    const result = await usersCollection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          role: "user",
        },
      }
    );

    res.send(result);
  } catch (error) {
    res.status(500).send({
      message: "Failed to remove admin",
      error: error.message,
    });
  }
};

const getUserRole = async (req, res) => {
  try {
    const db = getDB();
    const usersCollection = db.collection("users");

    const { email } = req.params;

    const user = await usersCollection.findOne({ email });

    if (!user) {
      return res.status(404).send({
        role: "user",
      });
    }

    res.send({
      role: user.role || "user",
    });
  } catch (error) {
    res.status(500).send({
      message: "Failed to get user role",
      error: error.message,
    });
  }
};

module.exports = {
  createUser,
  getUsers,
  makeAdmin,
  removeAdmin,
  getUserRole,
};