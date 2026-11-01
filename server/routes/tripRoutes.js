
const express = require("express");
const mongoose = require("mongoose");

const Trip = require("../models/Trip");
const Bus = require("../models/Bus");
const Route = require("../models/Route");
const User = require("../models/User");
const { protect, authorizeRoles } = require("../middleware/authMiddleware");

const router = express.Router();

// ======================================================
// GET ALL TRIPS
// GET /api/trips
// ======================================================
router.get("/", async (req, res) => {
  try {
    const trips = await Trip.find()
      .populate("bus")
      .populate("route")
      .populate("driver", "name")
      .sort({ departureTime: 1 });

    res.status(200).json(trips);
  } catch (error) {
    console.error("Get trips error:", error.message);

    res.status(500).json({
      message: "Failed to retrieve trips.",
    });
  }
});

// ======================================================
// SEARCH TIMETABLE
// GET /api/trips/search?from=GAL&to=MAK&date=2026-11-01
// ======================================================
router.get("/search", async (req, res) => {
  try {
    const { from, to, date } = req.query;

    // Check required query parameters
    if (!from || !to || !date) {
      return res.status(400).json({
        message: "Please provide from, to, and date.",
      });
    }

    // Origin and destination must be different
    if (from === to) {
      return res.status(400).json({
        message: "Origin and destination cannot be the same.",
      });
    }

    // Validate YYYY-MM-DD format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({
        message: "Date must use YYYY-MM-DD format.",
      });
    }

    // Validate that the date actually exists
    const [year, month, day] = date.split("-").map(Number);

    const isValidDate =
      year >= 1000 &&
      month >= 1 &&
      month <= 12 &&
      day >= 1 &&
      day <= new Date(Date.UTC(year, month, 0)).getUTCDate();

    if (!isValidDate) {
      return res.status(400).json({
        message: "Please provide a valid calendar date.",
      });
    }

    // Sri Lankan local day starts at midnight UTC+05:30
    const start = new Date(`${date}T00:00:00+05:30`);
    const end = new Date(start);

    // Calculate the beginning of the next local day
    end.setUTCDate(end.getUTCDate() + 1);

    // Find trips departing during the selected Sri Lankan date
    const trips = await Trip.find({
      departureTime: {
        $gte: start,
        $lt: end,
      },
      status: {
        $in: ["SCHEDULED", "IN_PROGRESS"],
      },
    })
      .populate("bus")
      .populate("route");

    const results = [];

    for (const trip of trips) {
      // Skip trips with missing bus or route information
      if (!trip.bus || !trip.route) {
        continue;
      }

      // Skip inactive buses and routes
      if (
        trip.bus.status !== "ACTIVE" ||
        trip.route.status !== "ACTIVE"
      ) {
        continue;
      }

      const stops = trip.route.stops || [];

      // Find origin and destination in the route
      const fromIndex = stops.findIndex(
        (stop) => stop.stopCode === from
      );

      const toIndex = stops.findIndex(
        (stop) => stop.stopCode === to
      );

      // Both stops must exist, and origin must come first
      if (
        fromIndex === -1 ||
        toIndex === -1 ||
        fromIndex >= toIndex
      ) {
        continue;
      }

      // Get the scheduled times for the selected stops
      const fromStopTime = trip.stopTimes[fromIndex];
      const toStopTime = trip.stopTimes[toIndex];

      if (!fromStopTime || !toStopTime) {
        continue;
      }

      const departureAt = fromStopTime.departureTime;
      const arrivalAt = toStopTime.arrivalTime;

      // A valid journey needs both times
      if (!departureAt || !arrivalAt) {
        continue;
      }

      // Return only trips whose selected departure falls
      // within the requested Sri Lankan calendar date
      if (
        new Date(departureAt) < start ||
        new Date(departureAt) >= end
      ) {
        continue;
      }

      results.push({
        tripId: trip._id,

        bus: {
          id: trip.bus._id,
          registrationNumber: trip.bus.registrationNumber,
          busType: trip.bus.busType,
          capacity: trip.bus.capacity,
        },

        routeName: trip.route.routeName,

        from: {
          stopCode: stops[fromIndex].stopCode,
          name: stops[fromIndex].name,
          departureTime: departureAt,
        },

        to: {
          stopCode: stops[toIndex].stopCode,
          name: stops[toIndex].name,
          arrivalTime: arrivalAt,
        },

        fullRouteFare: trip.fare,
        status: trip.status,
        currentStopCode: trip.currentStopCode,
        locationUpdatedAt: trip.locationUpdatedAt,
      });
    }

    // Show the earliest departures first
    results.sort(
      (a, b) =>
        new Date(a.from.departureTime) -
        new Date(b.from.departureTime)
    );

    return res.status(200).json({
      date,
      from,
      to,
      count: results.length,
      trips: results,
    });
  } catch (error) {
    console.error("Search trips error:", error.message);

    return res.status(500).json({
      message: "Failed to search for trips.",
    });
  }
});

// GET /api/trips/mine - trips assigned to the signed-in driver.
router.get("/mine", protect, authorizeRoles("DRIVER"), async (req, res) => {
  try {
    const trips = await Trip.find({ driver: req.user.id })
      .populate("bus")
      .populate("route")
      .sort({ departureTime: 1 });

    return res.status(200).json(trips);
  } catch (error) {
    console.error("Get driver trips error:", error.message);
    return res.status(500).json({ message: "Failed to retrieve assigned trips." });
  }
});

// ======================================================
// GET ONE TRIP BY ID
// GET /api/trips/:id
// ======================================================
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "Invalid trip ID.",
      });
    }

    const trip = await Trip.findById(id)
      .populate("bus")
      .populate("route")
      .select("-driver");

    if (!trip) {
      return res.status(404).json({
        message: "Trip not found.",
      });
    }

    return res.status(200).json(trip);
  } catch (error) {
    console.error("Get trip error:", error.message);

    return res.status(500).json({
      message: "Failed to retrieve trip.",
    });
  }
});

// ======================================================
// CREATE A TRIP
// POST /api/trips
// ======================================================
router.post("/", protect, authorizeRoles("ADMIN"), async (req, res) => {
  try {
    const {
      bus,
      route,
      departureTime,
      arrivalTime,
      fare,
      stopTimes,
      driver,
    } = req.body;

    // Check required fields
    if (
      !bus ||
      !route ||
      !departureTime ||
      !arrivalTime ||
      fare === undefined ||
      !Array.isArray(stopTimes)
    ) {
      return res.status(400).json({
        message:
          "Please provide bus, route, departureTime, arrivalTime, fare, and stopTimes.",
      });
    }

    // Validate MongoDB IDs
    if (
      !mongoose.Types.ObjectId.isValid(bus) ||
      !mongoose.Types.ObjectId.isValid(route) ||
      (driver && !mongoose.Types.ObjectId.isValid(driver))
    ) {
      return res.status(400).json({
        message: "Invalid bus ID or route ID.",
      });
    }

    // Validate date values
    const tripDeparture = new Date(departureTime);
    const tripArrival = new Date(arrivalTime);

    if (
      Number.isNaN(tripDeparture.getTime()) ||
      Number.isNaN(tripArrival.getTime())
    ) {
      return res.status(400).json({
        message: "Please provide valid departure and arrival times.",
      });
    }

    if (tripArrival <= tripDeparture) {
      return res.status(400).json({
        message: "Arrival time must be after departure time.",
      });
    }

    // Validate fare
    if (
      typeof fare !== "number" ||
      !Number.isFinite(fare) ||
      fare < 0
    ) {
      return res.status(400).json({
        message: "Fare must be a non-negative number.",
      });
    }

    // Load bus and route
    const busDocument = await Bus.findById(bus);
    const routeDocument = await Route.findById(route);

    if (!busDocument) {
      return res.status(404).json({
        message: "Bus not found.",
      });
    }

    if (!routeDocument) {
      return res.status(404).json({
        message: "Route not found.",
      });
    }

    if (driver) {
      const driverDocument = await User.findOne({ _id: driver, role: "DRIVER" });
      if (!driverDocument) {
        return res.status(400).json({ message: "Please select a valid driver account." });
      }
    }

    if (
      busDocument.status !== "ACTIVE" ||
      routeDocument.status !== "ACTIVE"
    ) {
      return res.status(400).json({
        message: "The bus and route must both be active.",
      });
    }

    const conflictingTrip = await Trip.findOne({
      $or: [
        { bus },
        ...(driver ? [{ driver }] : []),
      ],
      departureTime: { $lt: tripArrival },
      arrivalTime: { $gt: tripDeparture },
      status: { $nin: ["CANCELLED", "COMPLETED"] },
    });
    if (conflictingTrip) {
      return res.status(409).json({
        message: "The selected bus or driver is already assigned to an overlapping trip.",
      });
    }

    // There must be one stop-time entry per route stop
    const routeStops = routeDocument.stops;

    if (stopTimes.length !== routeStops.length) {
      return res.status(400).json({
        message:
          "The number of stopTimes must match the number of route stops.",
      });
    }

    // Ensure stop codes follow the route's stop order
    for (let i = 0; i < routeStops.length; i++) {
      if (stopTimes[i].stopCode !== routeStops[i].stopCode) {
        return res.status(400).json({
          message:
            "stopTimes must follow the exact stop order defined in the route.",
        });
      }
    }

    // Validate stop times and their chronological order
    let previousTime = tripDeparture;

    for (let i = 0; i < stopTimes.length; i++) {
      const stopTime = stopTimes[i];

      if (!stopTime || !stopTime.stopCode) {
        return res.status(400).json({
          message: `Invalid stopTimes entry at index ${i}.`,
        });
      }

      const arrival = stopTime.arrivalTime
        ? new Date(stopTime.arrivalTime)
        : null;

      const departure = stopTime.departureTime
        ? new Date(stopTime.departureTime)
        : null;

      if (
        (arrival && Number.isNaN(arrival.getTime())) ||
        (departure && Number.isNaN(departure.getTime()))
      ) {
        return res.status(400).json({
          message: `Invalid time at stop ${stopTime.stopCode}.`,
        });
      }

      if (
        (i < routeStops.length - 1 && !departure) ||
        (i > 0 && !arrival)
      ) {
        return res.status(400).json({
          message: `A required arrival or departure time is missing at stop ${stopTime.stopCode}.`,
        });
      }

      if (arrival && arrival < previousTime) {
        return res.status(400).json({
          message:
            `Arrival time at ${stopTime.stopCode} ` +
            "cannot be earlier than the previous time.",
        });
      }

      if (arrival && departure && departure < arrival) {
        return res.status(400).json({
          message:
            `Departure time at ${stopTime.stopCode} ` +
            "cannot be earlier than its arrival time.",
        });
      }

      if (departure) {
        previousTime = departure;
      } else if (arrival) {
        previousTime = arrival;
      }
    }

    if (
      new Date(stopTimes[0].departureTime).getTime() !== tripDeparture.getTime() ||
      new Date(stopTimes[stopTimes.length - 1].arrivalTime).getTime() !== tripArrival.getTime()
    ) {
      return res.status(400).json({
        message: "Trip departure/arrival must match the first and last stop times.",
      });
    }

    // Create the trip
    const newTrip = await Trip.create({
      bus,
      route,
      driver: driver || null,
      departureTime: tripDeparture,
      arrivalTime: tripArrival,
      fare,
      stopTimes,
    });

    const populatedTrip = await Trip.findById(newTrip._id)
      .populate("bus")
      .populate("route")
      .populate("driver", "name email");

    return res.status(201).json({
      message: "Trip created successfully.",
      trip: populatedTrip,
    });
  } catch (error) {
    console.error("Create trip error:", error.message);

    return res.status(500).json({
      message: "Failed to create trip.",
    });
  }
});

// PATCH /api/trips/:id/location - drivers can report a stop on their assigned route.
router.patch("/:id/location", protect, authorizeRoles("DRIVER"), async (req, res) => {
  try {
    const { id } = req.params;
    const { stopCode } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid trip ID." });
    }
    if (typeof stopCode !== "string" || !stopCode.trim()) {
      return res.status(400).json({ message: "A valid stop code is required." });
    }

    const trip = await Trip.findOne({ _id: id, driver: req.user.id }).populate("route");
    if (!trip) {
      return res.status(404).json({ message: "Assigned trip not found." });
    }
    if (!trip.route.stops.some((stop) => stop.stopCode === stopCode)) {
      return res.status(400).json({ message: "The stop is not part of this trip's route." });
    }
    if (!["SCHEDULED", "IN_PROGRESS"].includes(trip.status)) {
      return res.status(400).json({ message: "Location updates are unavailable for this trip." });
    }

    trip.currentStopCode = stopCode;
    trip.locationUpdatedAt = new Date();
    if (trip.status === "SCHEDULED") trip.status = "IN_PROGRESS";
    await trip.save();

    return res.status(200).json({
      message: "Live location updated.",
      currentStopCode: trip.currentStopCode,
      locationUpdatedAt: trip.locationUpdatedAt,
      status: trip.status,
    });
  } catch (error) {
    console.error("Update trip location error:", error.message);
    return res.status(500).json({ message: "Failed to update live location." });
  }
});

// PATCH /api/trips/:id/status - assigned drivers can complete their trip.
router.patch("/:id/status", protect, authorizeRoles("DRIVER"), async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid trip ID." });
    }
    if (!["IN_PROGRESS", "COMPLETED"].includes(status)) {
      return res.status(400).json({ message: "Invalid driver trip status." });
    }

    const trip = await Trip.findOne({ _id: id, driver: req.user.id });
    if (!trip) {
      return res.status(404).json({ message: "Assigned trip not found." });
    }
    if (trip.status === "COMPLETED" || trip.status === "CANCELLED") {
      return res.status(400).json({ message: "This trip is already closed." });
    }

    trip.status = status;
    await trip.save();
    return res.status(200).json({ message: "Trip status updated.", status: trip.status });
  } catch (error) {
    console.error("Update trip status error:", error.message);
    return res.status(500).json({ message: "Failed to update trip status." });
  }
});

module.exports = router;
