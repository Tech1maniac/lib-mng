const express = require("express");
const path = require("path");
const jwtVerify = require("../middleware/jwtVerify");
const router = express.Router();

// Admin-only route
router.get("/admin-dashboard", jwtVerify, (req, res) => {
  if (req.user.userRole.toLowerCase() !== "admin") {
    return res.status(403).json({ message: "Access denied" });
  }
  res.sendFile(path.join(__dirname, "../public/admin_dashboard.html"));
});

// Member route
router.get("/member-dashboard", jwtVerify, (req, res) => {
  res.sendFile(path.join(__dirname, "../public/member_dashboard.html"));
});

// Optional: general token validation
router.get("/validate", jwtVerify, (req, res) => {
  res.json({ success: true, user: req.user });
});

module.exports = router;
