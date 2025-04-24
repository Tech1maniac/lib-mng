// server.js

require("dotenv").config();
const express = require("express");
const path = require("path");
const { initPool } = require("./config/db");

const app = express();
const PORT = process.env.PORT || 3000;

// Logging incoming requests (for debugging)
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// Middleware
app.use(express.static("public"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/api/books", require("./routes/books"));
app.use("/api/publishers", require("./routes/publishers"));
app.use("/api/members", require("./routes/members")); // Mount members route
app.use("/api/loans", require("./routes/loans"));

app.use("/api/stats", require("./routes/stats"));
app.use(require("./routes/auth"));
app.use(require("./routes/forgotPassword"));
app.use(require("./routes/resetPassword"));

// Static Pages
app.get("/login", (_, res) =>
  res.sendFile(path.join(__dirname, "public", "login.html"))
);
app.get("/register", (_, res) =>
  res.sendFile(path.join(__dirname, "public", "register.html"))
);
app.get("/admin-dashboard", (_, res) =>
  res.sendFile(path.join(__dirname, "public", "admin_dashboard.html"))
);
app.get("/member-dashboard", (_, res) =>
  res.sendFile(path.join(__dirname, "public", "member_dashboard.html"))
);
app.get("/dashboard", (_, res) =>
  res.sendFile(path.join(__dirname, "public", "dashboard.html"))
);
app.get("/forgot-password", (_, res) =>
  res.sendFile(path.join(__dirname, "public", "forgot_password.html"))
);

// Error Handler
app.use((err, req, res, next) => {
  console.error("Global Error:", err);
  res.status(500).json({ error: err.message });
});

// Start Server after DB Init
initPool()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("DB connection failed:", err);
    process.exit(1);
  });
