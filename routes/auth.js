const express = require("express");
const router = express.Router();
const { oracledb } = require("../config/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { generateOTP, sendOTPEmail } = require("../utils/otp");

// Registration Route
router.post("/register", async (req, res) => {
  const { email, password, cnfPass, name } = req.body;
  if (password !== cnfPass) {
    return res.status(400).json({ message: "Passwords do not match" });
  }
  let connection;
  try {
    connection = await oracledb.getConnection();
    // Check for existing user
    const existingUserSql = `
      SELECT user_id
      FROM USERS
      WHERE email = :email
    `;
    const existing = await connection.execute(
      existingUserSql,
      { email },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({ message: "User already exists. Please login instead." });
    }

    // Hash password and insert new user
    const hashedPassword = await bcrypt.hash(password, 10);
    const insertUserSql = `
      INSERT INTO USERS (email, password, name)
      VALUES (:email, :password, :name)
      RETURNING user_id INTO :userId
    `;
    const bindVars = {
      email,
      password: hashedPassword,
      name: name || null,
      userId: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }
    };
    const result = await connection.execute(insertUserSql, bindVars, { autoCommit: true });
    const userId = result.outBinds.userId[0];

    res.json({ message: "Registration successful. Please login to continue.", userId });
  } catch (err) {
    console.error("Error in /register route:", err);
    res.status(500).json({ message: "An error occurred during the registration process." });
  } finally {
    if (connection) await connection.close();
  }
});

// Login Route: Verify credentials and send OTP
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const otp = generateOTP();
  let connection;
  try {
    connection = await oracledb.getConnection();

    const loginSql = `
      SELECT user_id, password, role
      FROM USERS
      WHERE email = :email
    `;
    const result = await connection.execute(
      loginSql,
      { email },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "User not found. Please register first." });
    }

    const user = result.rows[0];
    const isMatch = await bcrypt.compare(password, user.PASSWORD);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const userId = user.USER_ID;
    // Insert OTP into EMAIL_VERIFICATIONS
    const insertOtpSql = `
      INSERT INTO EMAIL_VERIFICATIONS (user_id, verification_code)
      VALUES (:userId, :otp)
    `;
    await connection.execute(insertOtpSql, { userId, otp }, { autoCommit: true });

    await sendOTPEmail(email, otp);
    res.json({ message: "OTP sent to email. Please enter the OTP to complete login.", email });
  } catch (err) {
    console.error("Error in /login route:", err);
    res.status(500).json({ message: "An error occurred during the login process." });
  } finally {
    if (connection) await connection.close();
  }
});

// OTP Verification Route: Validate OTP and redirect based on role
router.post("/verify-otp", async (req, res) => {
  const { email, otp } = req.body;
  let connection;
  try {
    connection = await oracledb.getConnection();

    const userSql = `
      SELECT user_id, role
      FROM USERS
      WHERE email = :email
    `;
    const userRes = await connection.execute(
      userSql,
      { email },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    if (userRes.rows.length === 0) {
      return res.status(400).json({ success: false, message: "User not found" });
    }

    const { USER_ID, ROLE } = userRes.rows[0];
    const otpFetchSql = `
      SELECT verification_code, creation_date
      FROM EMAIL_VERIFICATIONS
      WHERE user_id = :userId
      ORDER BY creation_date DESC
      FETCH FIRST 1 ROWS ONLY
    `;
    const otpRes = await connection.execute(
      otpFetchSql,
      { userId: USER_ID },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    if (otpRes.rows.length === 0) {
      return res.status(401).json({ success: false, message: "No OTP found. Please try logging in again." });
    }

    const { VERIFICATION_CODE, CREATION_DATE } = otpRes.rows[0];
    const now = new Date();
    const creationDate = new Date(CREATION_DATE);
    const diffMins = (now - creationDate) / 1000 / 60;
    if (diffMins > 5) {
      return res.status(401).json({ success: false, message: "OTP has expired. Please login again to receive a new OTP." });
    }
    if (VERIFICATION_CODE !== otp) {
      return res.status(401).json({ success: false, message: "Invalid OTP. Please try again." });
    }

    const redirectUrl = ROLE.toLowerCase() === "admin" ? "/admin-dashboard" : "/member-dashboard";
    res.json({ success: true, message: "OTP verified successfully.", redirectUrl });
  } catch (err) {
    console.error("Error in /verify-otp route:", err);
    res.status(500).json({ success: false, message: "An error occurred during OTP verification." });
  } finally {
    if (connection) await connection.close();
  }
});

module.exports = router;
