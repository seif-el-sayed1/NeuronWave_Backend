const asyncHandler = require("express-async-handler");
const crypto = require("crypto");

const Admin = require("../models/admin.model");
const ApiError = require("../utils/ApiError");

const EmailController = require("./email.controller");
const { translate } = require("../utils/translation");

class AdminAuthController {
  // @desc    Admin login
  // @route   POST /admins/auth/login
  // @access  Public
  login = asyncHandler(async (req, res, next) => {
    const lang = req.headers.lang || "en"
    const { email, password } = req.body;
    if (!password) return next(new ApiError(translate("Password field is required", lang), 400));
    // Check admin
    let admin = await Admin.findOne({ email }).select(
      "_id fullName email password isVerified isDeleted isBlocked notificationToken"
    );
    if (!admin || admin.isDeleted) return next(new ApiError(translate("Incorrect email or password", lang), 404));
    // Check if the password is correct
    if (!(await admin.comparePassword(password)))
      return next(new ApiError(translate("Incorrect email or password", lang), 404));
    // Check if the admin is blocked
    if (admin.isBlocked) {
      return next(
        new ApiError(translate("Your account has been blocked. Please contact the super admin", lang), 403)
      );
    }
    // add notification token if exists
    if (req.body.notificationToken) admin.notificationToken = req.body.notificationToken;

    // Response message
    let message = `Welcome back ${admin.fullName}!`;
    // Check if account is verified
    if (admin.isVerified !== true) {
      // Generate token for verification email
      const tokenData = await admin.generateToken();
      console.log(tokenData.token);
      // Send verification mail
      await EmailController.adminVerificationEmail(tokenData.token, email);
      return res.status(200).json({
        success: true,
        message: "Verification email is sent to your email address"
      });
    }
    /*
    In case of account is not verified ^^^:
      A verification code is sent to admin's email address
      And the rest of this function is ignored vvv
  */
    // Response admin data
    const adminData = { ...admin.toJSON(), password: undefined };
    // generate token
    const tokenData = await admin.generateToken();
    // Save the token
    admin.token = tokenData.token;
    admin.tokenExpDate = tokenData.tokenExpDate;
    await admin.save();
    // response
    admin.token = undefined;
    admin.password = undefined;
    admin.isVerified = undefined;
    admin.createdAt = undefined;
    admin.updatedAt = undefined;
    // response
    res.status(200).json({
      success: true,
      message,
      data: adminData,
      token: tokenData.token,
      tokenExpDate: tokenData.tokenExpDate
    });
  });


}

module.exports = new AdminAuthController();
