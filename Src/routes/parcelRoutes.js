const express = require("express");
const router = express.Router();

const {
  getParcels,
  getParcelById,
  createParcel,
  assignRider,
  deleteParcel,
} = require("../controllers/parcelController");

router.get("/", getParcels);

router.get("/:id", getParcelById);

router.post("/", createParcel);

router.patch("/:id", assignRider);

router.delete("/:id", deleteParcel);

module.exports = router;