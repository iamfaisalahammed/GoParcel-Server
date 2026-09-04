const express = require("express");
const router = express.Router();

const {
  getRiders,
  createRider,
  updateRiderStatus,
  deleteRider,
} = require("../controllers/riderController");

const verifyFBToken = require("../middlewares/verifyFBToken");

router.get("/", getRiders);

router.post("/", createRider);

router.patch("/:id", verifyFBToken, updateRiderStatus);

router.delete("/:id", verifyFBToken, deleteRider);

module.exports = router;