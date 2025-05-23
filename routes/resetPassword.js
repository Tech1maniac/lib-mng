const express = require("express");
const router = express.Router();
const { oracledb } = require("../config/db");
const bcrypt = require("bcrypt");
const path = require("path");

// Validate token and serve reset form
router.get("/reset-password/:token", async (req, res) => {
  const { token } = req.params;
  let connection;

  try {
    connection = await oracledb.getConnection();
    const tokenQuery = `
      SELECT user_id
      FROM USERS
      WHERE reset_token = :token
        AND reset_token_expiry > SYSTIMESTAMP
    `;
    const tokenResult = await connection.execute(
      tokenQuery,
      { token },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (tokenResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Token is invalid or has expired."
      });
    }

    // Serve the password reset HTML form
    res.sendFile(path.join(__dirname, "../public/reset_pass.html"));
  } catch (err) {
    console.error("Error in GET /reset-password:", err);
    res.status(500).json({ success: false, message: "Internal server error." });
  } finally {
    if (connection) {
      try { await connection.close(); } catch (e) { console.error("Error closing connection:", e); }
    }
  }
});

// Handle form submission and reset password
router.post("/reset-password/:token", async (req, res) => {
  const { token } = req.params;
  const { newPassword, cnfPass } = req.body;

  if (newPassword.trim() !== cnfPass.trim()) {
    return res.status(400).json({ success: false, message: "Passwords do not match!" });
  }

  let connection;
  try {
    connection = await oracledb.getConnection();
    const userQuery = `
      SELECT user_id
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
      return res.status(400).json({
        success: false,
        message: "Token is invalid or has expired."
      });
    }

    const userId = userResult.rows[0].USER_ID;
    const hashedPassword = await bcrypt.hash(newPassword.trim(), 10);

    const updatePasswordSql = `
      UPDATE USERS
      SET password = :password,
          reset_token = NULL,
          reset_token_expiry = NULL
      WHERE user_id = :userId
    `;
    await connection.execute(
      updatePasswordSql,
      { password: hashedPassword, userId },
      { autoCommit: true }
    );

    res.status(200).json({ success: true, message: "Password reset successfully." });
  } catch (error) {
    console.error("Error in POST /reset-password:", error);
    res.status(500).json({ success: false, message: "Internal server error." });
  } finally {
    if (connection) {
      try { await connection.close(); } catch (e) { console.error("Error closing connection:", e); }
    }
  }
});

module.exports = router;
