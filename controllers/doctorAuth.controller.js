const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");
const crypto = require("crypto");
const Doctor = require("../models/doctor.model");
const ApiError = require("../utils/ApiError");
const { translate } = require("../utils/translation");
const { generateCode, hashCode } = require("../utils/generateCode");
// Controller classes
const { userVerificationEmail } = require("./email.controller");
const { checkIfPhoneStartsWithPlus2 } = require("../middlewares/phoneNumberChecker.middleware");
const EmailController = require("./email.controller");
const { DocumentPermissionInstance } = require("twilio/lib/rest/sync/v1/service/document/documentPermission");

class DoctorController {
  #getDoctorData = (doctor, lang = "en") => {
    return {
      _id: doctor._id,
      fullName: doctor.fullName,
      role: doctor.role,
      email: doctor.email, 
      phone: doctor.phone,
      medicalSpecialty: doctor.medicalSpecialty,
      createdAt: doctor.createdAt,
      loginType: doctor.loginType,
    };
  };

  login = (doctor, loginType) =>
    asyncHandler(async (req, res, next) => {
      const { password, email } = req.body;
      const lang = req.headers.lang || "en";

      if (loginType && loginType !== doctor.loginType)
          return next(new ApiError(translate("Incorrect Email/Phone or password", lang), 403));
      else if (!loginType) {
          if (!(await doctor.comparePassword(password)))
              return next(new ApiError(translate("Incorrect Email/Phone or password", lang), 403));
      }

      // Response Msg
      let message = `Welcome back ${doctor.fullName || ""}!`;

      // Check if doctor account is deactivated
      if (!doctor.isActive) {
          const targetDate = new Date(doctor.deactivatedAt);
          const currentDate = new Date();
          const timeDifference = currentDate - targetDate;
          const millisecondsIn15Days = 15 * 24 * 60 * 60 * 1000;

          if (timeDifference >= millisecondsIn15Days) {
              return next(new ApiError(translate("Incorrect Email/Phone or password", lang), 404));
          } else {
              doctor.deactivatedAt = undefined;
              doctor.isActive = true;
              message = "Welcome back! Your account has been reactivated.";
          }
      }

      // Check if account is verified
      if (!doctor.isVerified) {
          const { code, hashedCode } = await generateCode();
          doctor.verificationCode = hashedCode;
          doctor.verificationCodeExp = Date.now() + 10 * 60 * 1000;
          await doctor.save();

          if (doctor.email) {
              await userVerificationEmail(code, doctor.email);

              return res.status(200).json({
                  success: true,
                  message: "Verification OTP is sent to your Email",
                  data: {
                      ...this.#getDoctorData(doctor, lang)
                  }
              });
          }
      }

      if (doctor.isBlocked)
          return next(
              new ApiError(
                  translate("Your account is blocked, please contact the support team", lang),
                  403
              )
          );

      // generate token
      const token = await doctor.generateToken();

      // Save notification token
      if (req.body.notificationToken) doctor.notificationToken = req.body.notificationToken;
      await doctor.save();

      // Remove password from the response
      DocumentPermissionInstance.password = undefined;
      DocumentPermissionInstance.isVerified = undefined;
      DocumentPermissionInstance.isActive = undefined;

      // response
      res.status(200).json({
          success: true,
          message,
          data: {
              ...this.#getDoctorData(doctor, lang),
              // unseenNotifications,
              ...token
          }
      });
  });

  // @desc    Log In
  // @route   POST /doctors/auth/login
  // @access  Public
  doctorLogin = asyncHandler(async (req, res, next) => {
      checkIfPhoneStartsWithPlus2(req);
      const { email, password, loginType, phone } = req.body;
      const lang = req.headers.lang || "en";

      const doctorFilter = phone ? { phone } : { email };
      let query = Doctor.findOne(doctorFilter, null, {
          userLocationPopulation: true,
          skipPopulation: false
      });
      query.lang = lang;
      let doctor = await query;

      if (loginType) {
          if (!doctor)
              return res.status(200).json({
                  success: true,
                  message: "Please, Complete your profile!",
                  signUpForFirstTime: true
              });
          else return await this.login(doctor, loginType)(req, res, next);
      } else {
          if (!doctor) return next(new ApiError(translate("Incorrect Email or password", lang), 403));
          return await this.login(doctor, loginType)(req, res, next);
      }
  });

  // @desc    Sign Up
  // @route   POST /doctors/auth/register
  // @access  Public
  doctorRegister = async (req, res, next) => {
    console.log("++++++++++++++++++++++++");
    console.log(req.body.notificationToken);
    console.log("++++++++++++++++++++++++");

    const session = await mongoose.startSession();
    try {
        session.startTransaction();

        console.log(" 🚀~ Req.body ~ in Doctor register", req.body);


        // Create a new doctor
        let doctor = await Doctor.create(
            [
                {
                    fullName: req.body.fullName,
                    notVerifiedTime: Date.now(),
                    email: req.body.email,
                    phone: req.body.phone,
                    medicalSpecialty: req.body.medicalSpecialty,
                    loginType: req.body.loginType,
                    notificationToken: req.body.notificationToken,
                    password: req.body.password
                }
            ],
            { session }
        );
        doctor = doctor[0];

        // Generate a verification code
        const { code, hashedCode } = await generateCode();
        doctor.verificationCode = hashedCode;
        doctor.verificationCodeExp = Date.now() + 10 * 60 * 1000;

        await doctor.save({ session });

        const { email, loginType } = req.body;

        // For non-email login types, mark as verified immediately
        if (loginType && loginType !== "email") {
            doctor.isVerified = true;
            const token = await doctor.generateToken();
            await doctor.save({ session });
            await session.commitTransaction();

            doctor = await Doctor.findById(doctor._id, null, {
                lang: req.headers.lang,
                userLocationPopulation: true
            });

            res.status(200).json({
                success: true,
                message: "Account Created and verified successfully",
                data: {
                    ...this.#getDoctorData(doctor, req.headers.lang),
                    ...token
                }
            });
        } else if (email) {
            // Send verification email only
            await userVerificationEmail(code, email);
            await session.commitTransaction();

            doctor = await Doctor.findById(doctor._id, null, {
                lang: req.headers.lang,
                userLocationPopulation: true
            });

            res.status(200).json({
                success: true,
                message: "Verification OTP is sent to your Email",
                data: {
                    ...this.#getDoctorData(doctor, req.headers.lang)
                }
            });
        }
    } catch (err) {
        await session.abortTransaction();
        next(err);
    } finally {
        session.endSession();
    }
  };

  // @desc    Doctor account verification
  // @route   POST /doctors/auth/verifyAccount
  // @access  Public
  doctorVerifyAccount = asyncHandler(async (req, res, next) => {
    const lang = req.headers.lang || "en";
    console.log("++++++++++++++++++++++++");
    console.log(req.body.notificationToken);
    console.log("++++++++++++++++++++++++");

    if (!req.body.code)
      return next(new ApiError(translate("Verification OTP is required", lang), 400));

    const hashedCode = crypto.createHash("sha256").update(req.body.code).digest("hex");

    const doctor = await Doctor.findOne({ email: req.body.email });
    if (!doctor || (!doctor.verificationCode && !doctor.verificationCodeExp))
      return next(new ApiError(translate("Invalid request", lang), 400));

    if (Date.now() >= Date.parse(doctor.verificationCodeExp))
      return next(new ApiError(translate("Verification OTP is expired", lang), 401));

    if (doctor.verificationCode !== hashedCode)
      return next(new ApiError(translate("Invalid Verification OTP", lang), 401));

    doctor.isVerified = true;
    doctor.notVerifiedTime = undefined;
    doctor.verificationCode = undefined;
    doctor.verificationCodeExp = undefined;
    doctor.notificationToken = req.body.notificationToken;
    await doctor.save();

    const token = await doctor.generateToken();

    res.status(200).json({
      success: true,
      message: "Account verified successfully", 
      data: {
        ...this.#getDoctorData(doctor, req),
        ...token
      }
    });
  });

  // @desc    Update logged doctor password
  // @route   PATCH /doctors/auth/change-password
  // @access  Private
  updateLoggedDoctorPassword = asyncHandler(async (req, res, next) => { 
    const lang = req.headers.lang || "en";

    if (!(await req.user.comparePassword(req.body.currentPassword)))
      return next(new ApiError(translate("Incorrect password", lang), 401));

    const doctor = await Doctor.findById(req.user._id);
    if (!doctor) return next(new ApiError("User not found", 404));

    doctor.password = req.body.newPassword;
    doctor.passwordChangedAt = Date.now();
    await doctor.save();

    res.status(200).json({
      success: true,
      message: "Password updated successfully, please login again"
    });
  });

  verifyOtp = asyncHandler(async (req, res, next) => {
    const lang = req.headers.lang || "en";

    const hashedCode = hashCode(req.body.otp);
    const doctor = await Doctor.findOne(
      {
        verificationCode: hashedCode,
        verificationCodeExp: { $gt: Date.now() }
      },
      null,
      {
        userLocationPopulation: true
      }
    );

    if (!doctor)
      return next(new ApiError(translate("OTP isn't found!", lang), 403));

    let token = { token: doctor.token, tokenExpDate: doctor.tokenExpDate };

    if (doctor.unverifiedPhone) {
      if (doctor.phone) token = await doctor.generateToken();
      doctor.phone = doctor.unverifiedPhone;
      doctor.unverifiedPhone = undefined;
    } else if (doctor.unverifiedEmail) {
      if (doctor.email) token = await doctor.generateToken();
      doctor.email = doctor.unverifiedEmail;
      doctor.unverifiedEmail = undefined;
    }

    if (!token.token) token = await doctor.generateToken();

    doctor.isVerified = true;
    doctor.verificationCodeExp = undefined;
    doctor.verificationCode = undefined;
    await doctor.save();

    res.status(200).json({
      success: true,
      message: "Account verified successfully",
      data: {
        ...this.#getDoctorData(doctor, lang),
        ...token
      }
    });
  });

  sendOtp = asyncHandler(async (req, res, next) => {
    let { phone, email } = req.body;
    const doctorFilter = phone
      ? { $or: [{ phone }, { unverifiedPhone: phone }] }
      : { $or: [{ email }, { unverifiedEmail: email }] };
    const doctor = await Doctor.findOne(doctorFilter);
    if (!doctor) return next(new ApiError(translate("User Not Found!", lang), 404));
    const { code, hashedCode } = await generateCode();
    doctor.verificationCode = hashedCode;
    // Send verification mail
    // Save hashed verification code in DB
    doctor.verificationCode = hashedCode;
    doctor.verificationCodeExp = Date.now() + 10 * 60 * 1000;
    await doctor.save();

    if (email) {
      await EmailController.userVerificationEmail(code, email);
      res.status(200).json({
        success: true,
        message: "Verification OTP is sent to your Email"
      });
    }
  });

  logOut = asyncHandler(async (req, res, next) => {
    const doctor = req.user;
    await doctor.updateOne({
      $unset: { notificationToken: 1, token: 1, tokenExpDate: 1 }
    });

    res.status(200).json({
      success: true,
      message: "Doctor logged out successfully!"
    });
  });

}

module.exports = new DoctorController();
