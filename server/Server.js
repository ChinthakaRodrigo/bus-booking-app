const express = require("express");
const cors = require("cors");
const routeRoutes = require("./routes/routeRoutes");
const tripRoutes = require("./routes/tripRoutes");
const bookingRoutes = require("./routes/bookingRoutes");
require("dotenv").config();

const connectDB = require("./config/db");

const app = express();

app.use(cors());
app.use(express.json());

// Connect to MongoDB before starting the server
const startServer = async () => {
  await connectDB();

  app.get("/api/health", (req, res) => {
    res.json({
      message: "Bus Booking API is working!"
    });
  });

  app.use("/api/buses", require("./routes/busRoutes"));
  app.use("/api/routes", routeRoutes);
  app.use("/api/trips", tripRoutes);
  app.use("/api/bookings", bookingRoutes);

  const PORT = process.env.PORT || 5000;

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

startServer();