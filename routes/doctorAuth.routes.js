const express = require("express");

const { DOCTOR, SUPER_DOCTOR } = require("../utils/constants");

// Middlewares
const { protect, allowedTo } = require("../middlewares/auth.middleware");
// Classes
const DoctorAuthController = require("../controllers/doctorAuth.controller");
const DoctorResetPasswordController = require("../controllers/doctorResetPassword.controllers");
const DoctorValidator = require("../validators/doctor.validator");
const GlobalValidator = require("../validators/global.validator");

// Router`
const router = express.Router();

// Auth Routes
router.route("/register").post(
  DoctorValidator.validateRegisterDoctor,
  DoctorAuthController.doctorRegister
);

router.route("/login").post(GlobalValidator.validateLogin, DoctorAuthController.doctorLogin);

router.route("/verify-account").post(DoctorAuthController.doctorVerifyAccount);
//  Forgot Password Routes
router
  .route("/forgot-password")
  .post(DoctorValidator.forgetPasswordValidator, DoctorResetPasswordController.forgotPassword);
router
  .route("/verify-reset-code")
  .post(DoctorValidator.resetPasswordCodeValidator, DoctorResetPasswordController.verifyResetCode);
router
  .route("/reset-password")
  .patch(DoctorValidator.resetPasswordValidator, DoctorResetPasswordController.resetPassword);

router.patch(
  "/change-password",
  protect,
  allowedTo(DOCTOR, SUPER_DOCTOR),
  GlobalValidator.validateChangePassword,
  DoctorAuthController.updateLoggedDoctorPassword
);

router.post("/verify-otp", DoctorAuthController.verifyOtp);
router.post("/send-otp", GlobalValidator.sendOtpValidator, DoctorAuthController.sendOtp);
router.post("/log-out", protect, allowedTo(DOCTOR, SUPER_DOCTOR), DoctorAuthController.logOut);

module.exports = router;
