
const express = require("express");
const mongoose = require("mongoose");

const Booking = require("../models/Booking");
const Trip = require("../models/Trip");

const router = express.Router();

// ======================================================
// GET ALL BOOKINGS
// GET /api/bookings
// Development only: protect this endpoint with admin
// authorization before deploying the application.
// ======================================================
router.get("/", async (req, res) => {
  try {
    const bookings = await Booking.find()
      .populate({
        path: "trip",
        populate: [
          { path: "bus" },
          { path: "route" },
        ],
      })
      .sort({ createdAt: -1 });

    return res.status(200).json({
      count: bookings.length,
      bookings,
    });
  } catch (error) {
    console.error("Get bookings error:", error.message);

    return res.status(500).json({
      message: "Failed to retrieve bookings.",
    });
  }
});

// ======================================================
// GET ONE BOOKING
// GET /api/bookings/:id
// ======================================================
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "Invalid booking ID.",
      });
    }

    const booking = await Booking.findById(id).populate({
      path: "trip",
      populate: [
        { path: "bus" },
        { path: "route" },
      ],
    });

    if (!booking) {
      return res.status(404).json({
        message: "Booking not found.",
      });
    }

    return res.status(200).json(booking);
  } catch (error) {
    console.error("Get booking error:", error.message);

    return res.status(500).json({
      message: "Failed to retrieve booking.",
    });
  }
});

// ======================================================
// CREATE A BOOKING
// POST /api/bookings
// ======================================================
router.post("/", async (req, res) => {
  try {
    const {
      tripId,
      passengerName,
      passengerPhone,
      seatNumber,
      fromStopCode,
      toStopCode,
    } = req.body;

    // Validate required fields
    if (
      !tripId ||
      !passengerName ||
      !passengerPhone ||
      seatNumber === undefined ||
      !fromStopCode ||
      !toStopCode
    ) {
      return res.status(400).json({
        message:
          "Please provide tripId, passengerName, passengerPhone, seatNumber, fromStopCode, and toStopCode.",
      });
    }

    // Validate trip ID
    if (!mongoose.Types.ObjectId.isValid(tripId)) {
      return res.status(400).json({
        message: "Invalid trip ID.",
      });
    }

    // Validate passenger information
    if (
      typeof passengerName !== "string" ||
      passengerName.trim().length < 2
    ) {
      return res.status(400).json({
        message: "Please provide a valid passenger name.",
      });
    }

    if (
      typeof passengerPhone !== "string" ||
      !/^[0-9+\s()-]{7,20}$/.test(passengerPhone.trim())
    ) {
      return res.status(400).json({
        message: "Please provide a valid phone number.",
      });
    }

    // This version uses numbered seats: 1, 2, 3, ...
    const seatText = String(seatNumber).trim();

    if (!/^\d+$/.test(seatText) || Number(seatText) < 1) {
      return res.status(400).json({
        message: "Seat number must be a positive whole number.",
      });
    }

    const requestedSeat = Number(seatText);

    // Load trip and its route and bus
    const trip = await Trip.findById(tripId)
      .populate("bus")
      .populate("route");

    if (!trip || !trip.bus || !trip.route) {
      return res.status(404).json({
        message: "Trip, bus, or route not found.",
      });
    }

    if (trip.status !== "SCHEDULED") {
      return res.status(400).json({
        message: "Bookings are only allowed for scheduled trips.",
      });
    }

    if (
      trip.bus.status !== "ACTIVE" ||
      trip.route.status !== "ACTIVE"
    ) {
      return res.status(400).json({
        message: "The bus or route is not active.",
      });
    }

    // Ensure the selected seat exists on this bus
    if (requestedSeat > trip.bus.capacity) {
      return res.status(400).json({
        message:
          `Seat number must be between 1 and ${trip.bus.capacity}.`,
      });
    }

    const stops = trip.route.stops || [];

    // Find the passenger's boarding and destination stops
    const fromIndex = stops.findIndex(
      (stop) => stop.stopCode === fromStopCode
    );

    const toIndex = stops.findIndex(
      (stop) => stop.stopCode === toStopCode
    );

    if (
      fromIndex === -1 ||
      toIndex === -1 ||
      fromIndex >= toIndex
    ) {
      return res.status(400).json({
        message:
          "Invalid journey. The boarding stop must appear before the destination stop.",
      });
    }

    // Check that the selected trip has times for both stops
    const fromTime = trip.stopTimes[fromIndex];
    const toTime = trip.stopTimes[toIndex];

    if (
      !fromTime ||
      !toTime ||
      !(fromTime.departureTime || fromTime.arrivalTime) ||
      !(toTime.arrivalTime || toTime.departureTime)
    ) {
      return res.status(400).json({
        message: "Scheduled times are missing for this journey.",
      });
    }

    // Check existing active bookings for the same seat.
    // A seat is unavailable when journey segments overlap.
    const existingBookings = await Booking.find({
      trip: trip._id,
      seatNumber: seatText,
      status: { $in: ["PENDING", "CONFIRMED"] },
      fromStopCode: { $in: stops.map((stop) => stop.stopCode) },
      toStopCode: { $in: stops.map((stop) => stop.stopCode) },
    });

    for (const booking of existingBookings) {
      const existingFromIndex = stops.findIndex(
        (stop) => stop.stopCode === booking.fromStopCode
      );

      const existingToIndex = stops.findIndex(
        (stop) => stop.stopCode === booking.toStopCode
      );

      if (
        existingFromIndex !== -1 &&
        existingToIndex !== -1 &&
        fromIndex < existingToIndex &&
        existingFromIndex < toIndex
      ) {
        return res.status(409).json({
          message:
            `Seat ${seatText} is already booked for part of this journey. Please choose another seat.`,
        });
      }
    }

    // Calculate a provisional fare based on the number
    // of route segments travelled.
    // This assumes the full route fare is distributed
    // evenly across all route segments.
    const totalSegments = stops.length - 1;
    const travelledSegments = toIndex - fromIndex;

    const fare = Number(
      (
        (trip.fare * travelledSegments) /
        totalSegments
      ).toFixed(2)
    );

    // Create booking
    const booking = await Booking.create({
      trip: trip._id,
      passengerName: passengerName.trim(),
      passengerPhone: passengerPhone.trim(),
      seatNumber: seatText,
      fromStopCode,
      toStopCode,
      fare,
      status: "PENDING",
    });

    return res.status(201).json({
      message: "Booking created successfully.",
      booking,
    });
  } catch (error) {
    console.error("Create booking error:", error.message);

    return res.status(500).json({
      message: "Failed to create booking.",
    });
  }
});

module.exports = router;
