
const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema(
  {
    // The trip the passenger wants to travel on
    trip: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Trip",
      required: true,
    },

    // Passenger account; authentication will be added later
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // Passenger information for our initial learning version
    passengerName: {
      type: String,
      required: true,
      trim: true,
    },

    passengerPhone: {
      type: String,
      required: true,
      trim: true,
    },

    // The selected seat, for example A1 or 12
    seatNumber: {
      type: String,
      required: true,
      trim: true,
    },

    // Boarding and destination stop codes
    fromStopCode: {
      type: String,
      required: true,
      trim: true,
    },

    toStopCode: {
      type: String,
      required: true,
      trim: true,
    },

    // Fare for this passenger's selected journey
    fare: {
      type: Number,
      required: true,
      min: 0,
    },

    status: {
      type: String,
      enum: ["PENDING", "CONFIRMED", "CANCELLED"],
      default: "PENDING",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Booking", bookingSchema);
