// server.js
require("dotenv").config();
const express = require("express");
const session = require("express-session");
// Optional (for production):
// const OracleStore = require("connect-oracledb")(session);

const path = require("path");
const { initPool } = require("./config/db");

const app = express();
const PORT = process.env.PORT || 3000;

// ——— Session middleware ———
app.use(
  session({
    secret: process.env.SESSION_SECRET || "keyboard cat",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 1000 * 60 * 60 * 24, // 1 day
    },
    // store: new OracleStore({ /* your store config */ })
  })
);

// Logging incoming requests (incl. session info)
app.use((req, res, next) => {
  console.log(
    `${req.method} ${req.url} — session.userId=${req.session.userId}`
  );
  next();
});

// Static files & body parsing
app.use(express.static("public"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API routes
app.use("/api/books", require("./routes/books"));
app.use("/api/publishers", require("./routes/publishers"));
app.use("/api/members", require("./routes/members"));
app.use("/api/loans", require("./routes/loans"));
app.use("/api/stats", require("./routes/stats"));
app.use(require("./routes/auth"));
app.use(require("./routes/forgotPassword"));
app.use(require("./routes/resetPassword"));

// Static page routes
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
// New: Search Books page
app.get("/books", (_, res) =>
  res.sendFile(path.join(__dirname, "public", "books.html"))
);

// Global error handler
app.use((err, req, res, next) => {
  console.error("Global Error:", err);
  res.status(500).json({ error: err.message });
});

// Start server after DB init
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
