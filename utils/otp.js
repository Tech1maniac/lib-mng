const transporter = require("../config/mailer");

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

module.exports = { generateOTP, sendOTPEmail };
