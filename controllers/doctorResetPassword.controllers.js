const asyncHandler = require("express-async-handler");
const crypto = require("crypto");
const ApiError = require("../utils/ApiError");
const { translate } = require("../utils/translation");
const { generateCode, hashCode } = require("../utils/generateCode");
const EmailController = require("./email.controller");

class DoctorResetPasswordController {
  // @desc    Doctor Forgot Password
  // @route   POST /doctors/auth/forgotPassword
  // @access  Public
  forgotPassword = asyncHandler(async (req, res, next) => {
    let doctor = req.requestedDoctor;
    if (!doctor.isVerified) return next(new ApiError(translate("Your account is not verified yet", req.headers.lang || "en"), 400));
    const { email } = req.body;
    const { code: resetCode, hashedCode: hashedResetCode } = await generateCode();
    // Save hashed reset code in DB
    doctor.passwordResetCode = hashedResetCode;
    doctor.passwordResetCodeExp = Date.now() + 10 * 60 * 1000;
    doctor.passwordResetCodeVerified = false;
    await doctor.save();
    if (email) await EmailController.userResetPasswordEmail(email, resetCode);
    // Response
    res.status(200).json({
      success: true,
      message: `Reset OTP is sent to your email`,
      email: email ? doctor.email : undefined,
      codeExp: doctor.passwordResetCodeExp
    });
  });

  // @desc    Doctor verify reset code
  // @route   POST /doctors/auth/verifyResetCode
  // @access  Public
  verifyResetCode = asyncHandler(async (req, res, next) => {
    const lang = req.headers.lang || "en";
    // Hash code
    const hashedResetCode = crypto.createHash("sha256").update(req.body.code).digest("hex");
    let doctor = req.requestedDoctor;
    // Check code expiration
    if (Date.now() >= Date.parse(doctor.passwordResetCodeExp))
      return next(new ApiError(translate("Reset OTP is expired", lang), 401));
    // Check code
    if (doctor.passwordResetCode !== hashedResetCode)
      return next(new ApiError(translate("Invalid reset code", lang), 401));
    // Update doctor => verified
    doctor.passwordResetCodeVerified = true;
    await doctor.save();
    // Response
    res.status(200).json({
      success: true,
      message: "Reset OTP is verified successfully",
      phone: doctor.phone
    });
  });

  // @desc    Doctor reset password
  // @route   PATCH /doctors/auth/resetPassword
  // @access  Public
  resetPassword = asyncHandler(async (req, res, next) => {
    const { newPassword } = req.body;
    let doctor = req.requestedDoctor;
    // Update doctor data
    doctor.password = newPassword;
    doctor.passwordResetCode = undefined;
    doctor.passwordResetCodeExp = undefined;
    doctor.passwordResetCodeVerified = undefined;
    doctor.token = undefined;
    await doctor.save();
    // Response
    res.status(200).json({
      success: true,
      message: "Password is reset successfully"
    });
  });
}

module.exports = new DoctorResetPasswordController();
