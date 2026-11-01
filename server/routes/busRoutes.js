
const express = require("express");
const mongoose = require("mongoose");
const Bus = require("../models/Bus");
const { protect, authorizeRoles } = require("../middleware/authMiddleware");

const router = express.Router();

// GET: Retrieve all buses
router.get("/", async (req, res) => {
  try {
    const buses = await Bus.find().sort({ createdAt: -1 });

    res.status(200).json(buses);
  } catch (error) {
    res.status(500).json({
      message: "Failed to retrieve buses"
    });
  }
});

// GET: Retrieve one bus by ID
router.get("/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid bus ID" });
    }

    const bus = await Bus.findById(req.params.id);

    if (!bus) {
      return res.status(404).json({ message: "Bus not found" });
    }

    res.status(200).json(bus);
  } catch (error) {
    res.status(500).json({ message: "Failed to retrieve bus" });
  }
});

// POST: Add a new bus
router.post("/", protect, authorizeRoles("ADMIN"), async (req, res) => {
  try {
    const { registrationNumber, busType, capacity } = req.body;

    const bus = await Bus.create({
      registrationNumber,
      busType,
      capacity
    });

    res.status(201).json({
      message: "Bus added successfully",
      bus
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: "This registration number already exists"
      });
    }

    if (error.name === "ValidationError") {
      return res.status(400).json({
        message: error.message
      });
    }

    res.status(500).json({ message: "Failed to add bus" });
  }
});

// PUT: Update a bus
router.put("/:id", protect, authorizeRoles("ADMIN"), async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid bus ID" });
    }

    const { registrationNumber, busType, capacity, status } = req.body;

    const bus = await Bus.findByIdAndUpdate(
      req.params.id,
      { registrationNumber, busType, capacity, status },
      { new: true, runValidators: true }
    );

    if (!bus) {
      return res.status(404).json({ message: "Bus not found" });
    }

    res.status(200).json({
      message: "Bus updated successfully",
      bus
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: "This registration number already exists"
      });
    }

    res.status(400).json({ message: error.message });
  }
});

// PATCH: Change bus status
router.patch("/:id/status", protect, authorizeRoles("ADMIN"), async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid bus ID" });
    }

    const { status } = req.body;

    if (!["ACTIVE", "MAINTENANCE", "INACTIVE"].includes(status)) {
      return res.status(400).json({ message: "Invalid bus status" });
    }

    const bus = await Bus.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    );

    if (!bus) {
      return res.status(404).json({ message: "Bus not found" });
    }

    res.status(200).json({
      message: "Bus status updated",
      bus
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to update bus status" });
  }
});

module.exports = router;
