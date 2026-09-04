const express = require("express");
const router = express.Router();

const {
  createUser,
  getUsers,
  makeAdmin,
  removeAdmin,
  getUserRole,
} = require("../controllers/userController");

const verifyFBToken = require("../middlewares/verifyFBToken");
const verifyAdmin = require("../middlewares/verifyAdmin");

router.post("/", createUser);

router.get("/", verifyFBToken, getUsers);

router.patch(
  "/admin/:id",
  verifyFBToken,
  verifyAdmin,
  makeAdmin
);

router.patch(
  "/remove-admin/:id",
  verifyFBToken,
  verifyAdmin,
  removeAdmin
);

router.get(
  "/:email/role",
  verifyFBToken,
  getUserRole
);

module.exports = router;