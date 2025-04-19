require("dotenv").config();
const jwt = require("jsonwebtoken");
const express = require("express");
const oracledb = require("oracledb");
const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.static("public"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Oracle DB configuration
const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  connectString: process.env.DB_CONNECT_STRING,
  poolMin: Number(process.env.POOL_MIN) || 1,
  poolMax: Number(process.env.POOL_MAX) || 10,
  poolIncrement: Number(process.env.POOL_INCREMENT) || 2,
};

// Nodemailer transporter configuration
const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Utility functions
const generateOTP = (length = 6) =>
  Array.from({ length }, () => Math.floor(Math.random() * 10)).join("");

const sendOTPEmail = async (email, otp) => {
  const mailOptions = {
    from: `"Institute Library" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "🔐 Your One-Time Password (OTP) for Login",
    html: `
      <div style="background-color: #121212; color: white; padding: 20px; font-family: Arial, sans-serif; border-radius: 10px;">
        <h2 style="color: white;">Your verification code is:</h2>
        <h1 style="color: #3498db; font-size: 48px; margin: 0;">${otp}</h1>
        <hr style="border: 0; height: 1px; background-color: #444; margin: 20px 0;">
        <p style="color: #ccc;">This code will expire in 5 minutes. If you did not request this code, you can ignore this email.</p>
        <p style="margin-top: 30px;">Thank you,<br><strong>Institute Library</strong></p>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`OTP email sent to ${email}: ${info.response}`);
  } catch (error) {
    console.error("Error sending OTP email:", error);
  }
};

// Initialize Oracle connection pool
const initPool = async () => {
  try {
    await oracledb.createPool(dbConfig);
    console.log("Oracle DB connection pool started");
  } catch (err) {
    console.error("Error creating Oracle DB connection pool", err);
    process.exit(1);
  }
};

// Routes
// Serve static pages
app.get("/login", (req, res) => {
  res.sendFile(__dirname + "/public/login.html");
});

app.get("/register", (req, res) => {
  res.sendFile(__dirname + "/public/register.html");
});

app.get("/dashboard", (req, res) => {
  res.sendFile(__dirname + "/public/dashboard.html");
});

app.get("/forgot-password", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "forgot_password.html"));
});

// Registration
app.post("/register", async (req, res) => {
  const { email, password, cnfPass } = req.body;

  try {
    const connection = await oracledb.getConnection();

    const userQuery = `SELECT id FROM USERS WHERE email = :email`;
    const result = await connection.execute(userQuery, { email }, { outFormat: oracledb.OUT_FORMAT_OBJECT });

    if (result.rows.length > 0) {
      return res.status(400).json({ message: "User already exists. Please login instead." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const insertUser = `
      INSERT INTO USERS (id, email, password)
      VALUES (USERS_SEQ.NEXTVAL, :email, :password)
      RETURNING id INTO :userId
    `;
    const bindVars = { email, password: hashedPassword, userId: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER } };
    const userResult = await connection.execute(insertUser, bindVars);
    await connection.commit();

    const userId = userResult.outBinds.userId[0];
    res.json({ message: "Registration successful. Please login to continue.", userId });
  } catch (err) {
    console.error("Error in /register route:", err);
    res.status(500).send("An error occurred during the registration process.");
  }
});

// Login
app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const otp = generateOTP();

  try {
    const connection = await oracledb.getConnection();
    const userQuery = `SELECT id, password FROM USERS WHERE email = :email`;
    const result = await connection.execute(userQuery, { email }, { outFormat: oracledb.OUT_FORMAT_OBJECT });

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "User not found. Please register first." });
    }

    const user = result.rows[0];
    const isMatch = await bcrypt.compare(password, user.PASSWORD);
    if (!isMatch) {
      return res.status(401).send("Invalid password");
    }

    const userId = user.ID;

    const insertOTP = `
      INSERT INTO EMAIL_VERIFICATIONS (id, user_id, verification_code, creation_date)
      VALUES (EMAIL_VERIFICATIONS_SEQ.NEXTVAL, :userId, :otp, SYSTIMESTAMP)
    `;
    await connection.execute(insertOTP, { userId, otp });
    await connection.commit();

    await sendOTPEmail(email, otp);
    res.json({ message: "OTP sent to email. Please enter the OTP to complete login.", email });
  } catch (err) {
    console.error("Error in /login route:", err);
    res.status(500).send("An error occurred during the login process.");
  }
});

// OTP Verification
app.post("/verifyOTP", async (req, res) => {
  const { email, otp } = req.body;

  try {
    const connection = await oracledb.getConnection();

    const userQuery = `SELECT id FROM USERS WHERE email = :email`;
    const userResult = await connection.execute(userQuery, { email }, { outFormat: oracledb.OUT_FORMAT_OBJECT });

    if (userResult.rows.length === 0) {
      return res.status(400).json({ success: false, message: "User not found" });
    }

    const userId = userResult.rows[0].ID;

    const otpQuery = `
      SELECT verification_code, creation_date 
      FROM EMAIL_VERIFICATIONS
      WHERE user_id = :userId
      ORDER BY creation_date DESC FETCH FIRST 1 ROWS ONLY
    `;
    const otpResult = await connection.execute(otpQuery, { userId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });

    if (otpResult.rows.length === 0) {
      return res.status(401).json({ success: false, message: "No OTP found. Please try logging in again." });
    }

    const { VERIFICATION_CODE, CREATION_DATE } = otpResult.rows[0];
    const expirationMinutes = 5;
    const now = new Date();
    const creationDate = new Date(CREATION_DATE);

    if ((now - creationDate) / (1000 * 60) > expirationMinutes) {
      return res.status(401).json({ success: false, message: "OTP has expired. Please login again to receive a new OTP." });
    }

    if (VERIFICATION_CODE !== otp) {
      return res.status(401).json({ success: false, message: "Invalid OTP. Please try again." });
    }

    res.json({ success: true, message: "OTP verified successfully. Login complete." });
  } catch (err) {
    console.error("Error in /verifyOTP route:", err);
    res.status(500).json({ success: false, message: "An error occurred during OTP verification." });
  }
});

// Forgot Password
app.post("/forgot-password", async (req, res) => {
  const { email } = req.body;

  const token = crypto.randomBytes(20).toString("hex");
  const connection = await oracledb.getConnection();

  const userQuery = `SELECT id FROM USERS WHERE email = :email`;
  const userResult = await connection.execute(userQuery, { email }, { outFormat: oracledb.OUT_FORMAT_OBJECT });

  if (userResult.rows.length === 0) {
    return res.status(404).send("User not found");
  }

  const updateToken = `
    UPDATE USERS
    SET reset_token = :token, reset_token_expiry = SYSTIMESTAMP + (10/1440)
    WHERE email = :email
  `;
  await connection.execute(updateToken, { token, email });
  await connection.commit();

  const resetLink = `http://localhost:${PORT}/reset-password/${token}`;

  const mailOptions = {
    to: email,
    from: process.env.EMAIL_USER,
    subject: "🔒 Password Reset Request",
    html: `
      <div style="font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 30px;">
        <div style="max-width: 600px; margin: auto; background: white; padding: 20px; border-radius: 10px; box-shadow: 0 0 10px rgba(0,0,0,0.1);">
          <h2 style="color: #333;">🔒 Password Reset Request</h2>
          <p style="color: #555;">
            We received a request to reset your password for your Institute Library account.
          </p>
          <p style="color: #555;">
            Click the button below to reset your password:
          </p>
          <a href="${resetLink}" style="display: inline-block; padding: 12px 20px; background-color: #3498db; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">
            Reset Password
          </a>
          <p style="color: #999; font-size: 14px; margin-top: 20px;">
            This link will expire in 10 minutes. If you did not request a password reset, you can safely ignore this email or contact support for assistance.
          </p>
          <p style="margin-top: 30px; color: #333;">
            Thank you,<br>
            <strong>Institute Library Team</strong>
          </p>
        </div>
      </div>
    `,
  };

  transporter.sendMail(mailOptions, (err, info) => {
    if (err) {
      console.error("Error sending email:", err);
      return res.status(500).send("Error sending reset email.");
    }
    res.send(`
      <script>
        alert("Password reset link sent successfully!");
        window.location.href = "/login";
      </script>
    `);
  });
});

app.get("/reset-password/:token", async (req, res) => {
  const token = req.params.token;
  const connection = await oracledb.getConnection();

  const tokenQuery = `SELECT id FROM USERS WHERE reset_token = :token AND reset_token_expiry > SYSTIMESTAMP`;
  const tokenResult = await connection.execute(tokenQuery, { token }, { outFormat: oracledb.OUT_FORMAT_OBJECT });

  if (tokenResult.rows.length === 0) {
    return res.status(400).send("<h2>Password reset token is invalid or has expired.</h2>");
  }

  res.sendFile(path.join(__dirname, "public", "reset_pass.html"));
});

app.post("/reset-password/:token", async (req, res) => {
  const { token } = req.params;
  const { newPassword, cnfPass } = req.body;

  if (newPassword.trim() !== cnfPass.trim()) {
    return res.status(400).send("Passwords do not match!");
  }

  let connection;
  try {
    connection = await oracledb.getConnection();

    const userQuery = `
      SELECT id 
      FROM USERS 
      WHERE reset_token = :token 
      AND reset_token_expiry > SYSTIMESTAMP
    `;
    const userResult = await connection.execute(
      userQuery,
      { token },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (userResult.rows.length === 0) {
      return res.status(400).send("Password reset token is invalid or has expired.");
    }

    const userId = userResult.rows[0].ID;
    const hashedPassword = await bcrypt.hash(newPassword.trim(), 10);

    const updatePassword = `
      UPDATE USERS
      SET password = :password, reset_token = NULL, reset_token_expiry = NULL
      WHERE id = :userId
    `;
    await connection.execute(updatePassword, { password: hashedPassword, userId });
    await connection.commit();

    res.send(`
      <script>
        alert("Password reset successfully!");
        window.location.href = "/login";
      </script>
    `);
  } catch (error) {
    console.error("Error in reset-password route:", error);
    res.status(500).send("Internal server error.");
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (closeError) {
        console.error("Error closing the connection", closeError);
      }
    }
  }
});


// Start the server after initializing the Oracle pool
initPool().then(() => {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
});

