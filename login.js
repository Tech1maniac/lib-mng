require("dotenv").config();
const express   = require("express");
const path      = require("path");
const { initPool } = require("./config/db");
const publisherRoutes = require('./routes/publishers');
const membersRoutes = require('./routes/members'); // Importing the members routes



const app  = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.static("public"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Mount existing auth routes
app.use(require("./routes/auth"));
app.use(require("./routes/forgotPassword"));
app.use(require("./routes/resetPassword"));

// Mount new stats & transactions routes
//   – GET  /api/stats                → stats.js
//   – GET  /api/transactions/recent → transactions.js
app.use("/api/stats",        require("./routes/stats"));
app.use("/api/transactions", require("./routes/transactions"));

// Mount books routes
//   – GET  /api/books?q=keyword
//   – POST /api/books
app.use("/api/books",        require("./routes/books"));

// Mount publishers routes
//   – GET  /api/publishers
//   – POST /api/publishers
app.use('/api/publishers', publisherRoutes);
app.use('/api/members', membersRoutes);


// Serve static HTML pages
app.get("/login",            (_, res) => res.sendFile(path.join(__dirname, "public", "login.html")));
app.get("/register",         (_, res) => res.sendFile(path.join(__dirname, "public", "register.html")));
app.get("/admin-dashboard",  (_, res) => res.sendFile(path.join(__dirname, "public", "admin_dashboard.html")));
app.get("/member-dashboard", (_, res) => res.sendFile(path.join(__dirname, "public", "member_dashboard.html")));
app.get("/dashboard",        (_, res) => res.sendFile(path.join(__dirname, "public", "dashboard.html")));
app.get("/forgot-password",  (_, res) => res.sendFile(path.join(__dirname, "public", "forgot_password.html")));

// Global error handler (optional)
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message });
});

// Start the server after initializing the Oracle pool
initPool()
  .then(() => {
    app.listen(PORT, () =>
      console.log(`Server is running on port ${PORT}`)
    );
  })
  .catch(err => {
    console.error("Failed to initialize DB pool:", err);
    process.exit(1);
  });
