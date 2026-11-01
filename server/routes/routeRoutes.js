
const express = require("express");
const mongoose = require("mongoose");
const Route = require("../models/Route");
const { protect, authorizeRoles } = require("../middleware/authMiddleware");

const router = express.Router();

// GET: Get all routes
router.get("/", async (req, res) => {
  try {
    const routes = await Route.find().sort({ createdAt: -1 });
    res.status(200).json(routes);
  } catch (error) {
    res.status(500).json({
      message: "Failed to retrieve routes"
    });
  }
});

// GET: Get one route
router.get("/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        message: "Invalid route ID"
      });
    }

    const route = await Route.findById(req.params.id);

    if (!route) {
      return res.status(404).json({
        message: "Route not found"
      });
    }

    res.status(200).json(route);
  } catch (error) {
    res.status(500).json({
      message: "Failed to retrieve route"
    });
  }
});

// POST: Create a route
router.post("/", protect, authorizeRoles("ADMIN"), async (req, res) => {
  try {
    const { routeName, stops } = req.body;

    if (!Array.isArray(stops) || stops.length < 2) {
      return res.status(400).json({
        message: "A route needs at least two stops"
      });
    }

    // Check stop order and unique stop codes
    const orders = stops.map(stop => stop.order);
    const codes = stops.map(stop => stop.stopCode);

    const validOrders = orders.every(
      order => Number.isInteger(order) && order >= 1
    );

    if (
      !validOrders ||
      new Set(orders).size !== orders.length ||
      new Set(codes).size !== codes.length
    ) {
      return res.status(400).json({
        message: "Stop orders and stop codes must be unique and valid"
      });
    }

    const sortedStops = [...stops].sort(
      (a, b) => a.order - b.order
    );

    // Require consecutive stop orders: 1, 2, 3...
    if (sortedStops.some((stop, index) => stop.order !== index + 1)) {
      return res.status(400).json({
        message: "Stop orders must start at 1 and be consecutive"
      });
    }

    const route = await Route.create({
      routeName,
      stops: sortedStops
    });

    res.status(201).json({
      message: "Route created successfully",
      route
    });
  } catch (error) {
    if (error.name === "ValidationError") {
      return res.status(400).json({
        message: error.message
      });
    }

    res.status(500).json({
      message: "Failed to create route"
    });
  }
});

// PATCH: Activate or deactivate a route
router.patch("/:id/status", protect, authorizeRoles("ADMIN"), async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        message: "Invalid route ID"
      });
    }

    const { status } = req.body;

    if (!["ACTIVE", "INACTIVE"].includes(status)) {
      return res.status(400).json({
        message: "Invalid route status"
      });
    }

    const route = await Route.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    );

    if (!route) {
      return res.status(404).json({
        message: "Route not found"
      });
    }

    res.status(200).json({
      message: "Route status updated",
      route
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to update route status"
    });
  }
});

module.exports = router;
