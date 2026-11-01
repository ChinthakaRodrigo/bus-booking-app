const express = require("express");
const cors = require("cors");
const routeRoutes = require("./routes/routeRoutes");
const tripRoutes = require("./routes/tripRoutes");
const bookingRoutes = require("./routes/bookingRoutes");
const authRoutes = require("./routes/authRoutes");
const bcrypt = require("bcryptjs");
const User = require("./models/User");
require("dotenv").config();

const connectDB = require("./config/db");

const app = express();

async function ensureInitialAdmin() {
  const { ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME } = process.env;
  if (!ADMIN_EMAIL && !ADMIN_PASSWORD) return;
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD || ADMIN_PASSWORD.length < 8) {
    throw new Error("Set both ADMIN_EMAIL and an ADMIN_PASSWORD of at least 8 characters.");
  }

  const email = ADMIN_EMAIL.trim().toLowerCase();
  const existingAdmin = await User.findOne({ role: "ADMIN", email });
  if (!existingAdmin) {
    await User.create({
      name: (ADMIN_NAME || "BusGo Administrator").trim(),
      email,
      password: await bcrypt.hash(ADMIN_PASSWORD, 12),
      role: "ADMIN",
    });
    console.log("Initial administrator account created.");
  }
}

app.use(cors());
app.use(express.json());

// Connect to MongoDB before starting the server
const startServer = async () => {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error("JWT_SECRET must be set to a random value of at least 32 characters.");
  }

  await connectDB();
  await ensureInitialAdmin();

  app.get("/api/health", (req, res) => {
    res.json({
      message: "Bus Booking API is working!"
    });
  });

  app.use("/api/buses", require("./routes/busRoutes"));
  app.use("/api/routes", routeRoutes);
  app.use("/api/trips", tripRoutes);
  app.use("/api/bookings", bookingRoutes);
  app.use("/api/auth", authRoutes);
  app.use("/api/users", require("./routes/userRoutes"));

  const PORT = process.env.PORT || 5000;

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

startServer();