const express = require("express");
const router = express.Router();
const { oracledb } = require("../config/db");
const crypto = require("crypto");
const transporter = require("../config/mailer");

const PORT = process.env.PORT || 3000;

router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;
  const token = crypto.randomBytes(20).toString("hex");
  let connection;

  try {
    connection = await oracledb.getConnection();

    // 1) Fetch the user_id (not “id”) from USERS
    const userQuery = `SELECT user_id FROM USERS WHERE email = :email`;
    const userResult = await connection.execute(
      userQuery,
      { email },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (userResult.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const userId = userResult.rows[0].USER_ID;

    // 2) Update reset_token and reset_token_expiry for that user_id
    const updateTokenSql = `
      UPDATE USERS
      SET reset_token = :token,
          reset_token_expiry = SYSTIMESTAMP + INTERVAL '10' MINUTE
      WHERE user_id = :userId
    `;
    await connection.execute(
      updateTokenSql,
      { token, userId },
      { autoCommit: true }
    );

    // 3) Construct the reset link
    const resetLink = `http://localhost:${PORT}/reset-password/${token}`;

    // 4) Send the email
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
              This link will expire in 10 minutes. If you did not request a password reset, you can safely ignore this email.
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
        return res
          .status(500)
          .json({ success: false, message: "Error sending reset email." });
      }

      res.json({
        success: true,
        message: "Password reset link sent successfully!",
      });
    });
  } catch (err) {
    console.error("Error in /forgot-password route:", err);
    res.status(500).json({
      success: false,
      message: "An error occurred during the process.",
    });
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (closeErr) {
        console.error("Error closing connection:", closeErr);
      }
    }
  }
});

module.exports = router;
