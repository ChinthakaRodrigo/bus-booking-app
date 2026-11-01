
const mongoose = require("mongoose");

const tripStopTimeSchema = new mongoose.Schema(
  {
    stopCode: {
      type: String,
      required: true
    },

    arrivalTime: {
      type: Date,
      default: null
    },

    departureTime: {
      type: Date,
      default: null
    }
  },
  { _id: false }
);

const tripSchema = new mongoose.Schema(
  {
    bus: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Bus",
      required: true
    },

    route: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Route",
      required: true
    },

    driver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },

    departureTime: {
      type: Date,
      required: true
    },

    arrivalTime: {
      type: Date,
      required: true
    },

    fare: {
      type: Number,
      required: true,
      min: 0
    },

    stopTimes: {
      type: [tripStopTimeSchema],
      default: []
    },

    status: {
      type: String,
      enum: ["SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"],
      default: "SCHEDULED"
    },

    currentStopCode: {
      type: String,
      default: ""
    },

    locationUpdatedAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Trip", tripSchema);
