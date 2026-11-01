const express = require("express");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const { protect, authorizeRoles } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect, authorizeRoles("ADMIN"));

router.get("/drivers", async (req, res) => {
  try {
    const drivers = await User.find({ role: "DRIVER" })
      .select("name email createdAt")
      .sort({ name: 1 });
    return res.status(200).json(drivers);
  } catch (error) {
    console.error("List drivers error:", error.message);
    return res.status(500).json({ message: "Failed to retrieve drivers." });
  }
});

router.post("/drivers", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (
      typeof name !== "string" ||
      name.trim().length < 2 ||
      typeof email !== "string" ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
      typeof password !== "string" ||
      password.length < 8
    ) {
      return res.status(400).json({
        message: "Provide a name, valid email, and password of at least 8 characters.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (await User.exists({ email: normalizedEmail })) {
      return res.status(409).json({ message: "An account with this email already exists." });
    }

    const driver = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: await bcrypt.hash(password, 12),
      role: "DRIVER",
    });

    return res.status(201).json({
      message: "Driver account created.",
      driver: { id: driver._id, name: driver.name, email: driver.email },
    });
  } catch (error) {
    console.error("Create driver error:", error.message);
    if (error.code === 11000) {
      return res.status(409).json({ message: "An account with this email already exists." });
    }
    return res.status(500).json({ message: "Failed to create driver account." });
  }
});

module.exports = router;
