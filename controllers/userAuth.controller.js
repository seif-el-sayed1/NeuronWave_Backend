const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");
const crypto = require("crypto");
const User = require("../models/user.model");
const Appointment = require("../models/appointment.model");
const Analysis = require("../models/analysis.model");
const Notification = require("../models/notification.model")
const ApiError = require("../utils/ApiError");
const { translate } = require("../utils/translation");
const { generateCode, hashCode } = require("../utils/generateCode");
// Controller classes
const { userVerificationEmail } = require("./email.controller");
const { checkIfPhoneStartsWithPlus2 } = require("../middlewares/phoneNumberChecker.middleware");
const EmailController = require("./email.controller");

class UserController {
  #getUsersData = (user, lang = "en") => {
    return {
      _id: user._id,
      fullName: user.fullName,
      role: user.role,
      email: user.email,
      phone: user.phone,
      dateOfBirth: user.dateOfBirth,
      gender: user.gender,
      emergencyContact: user.emergencyContact,
      createdAt: user.createdAt,
      loginType: user.loginType,
      notificationToken: user.notificationToken,
    };
  };

  login = (user, loginType) =>
    asyncHandler(async (req, res, next) => {
        const { password } = req.body;
        const lang = req.headers.lang || "en";

        if (loginType && loginType !== user.loginType) {
            return next(new ApiError(translate("Incorrect Email or password", lang), 403));
        }

        if (!loginType && !(await user.comparePassword(password))) {
            return next(new ApiError(translate("Incorrect Email or password", lang), 403));
        }

        if (!user.isActive) {
            return next(new ApiError(translate("Incorrect Email or password", lang), 403));
        }

        if (user.isBlocked) {
            return next(
                new ApiError(
                    translate("Your account is blocked, please contact the support team", lang),
                    403
                )
            );
        }

        if (!user.isVerified) {
            const { code, hashedCode } = await generateCode();
            user.verificationCode = hashedCode;
            user.verificationCodeExp = Date.now() + 10 * 60 * 1000;
            await user.save();

            if (user.email) {
                await userVerificationEmail(code, user.email);
                return res.status(200).json({
                    success: true,
                    message: translate("Verification OTP is sent to your Email", lang),
                    data: {
                        ...this.#getUsersData(user, lang)
                    }
                });
            }
        }

        // CHECK IF USER ALREADY LOGGED IN
        if (user.token && user.tokenExpDate && user.tokenExpDate > Date.now()) {
            return next(
                new ApiError(
                    "This email is currently logged in on another device. Please log out from other devices.",
                    403
                )
            );
        }

        const token = await user.generateToken();

        if (req.body.notificationToken) user.notificationToken = req.body.notificationToken;
        user.lastVisit = new Date();
        await user.save();

        const [appointmentsReports, analysesReports, pendingAnalyses, notifications] = await Promise.all([
            Appointment.find({
                patient: user._id,
                status: "accepted",
                date: { $ne: null },
                time: { $ne: null }
            }),
            Analysis.find({
                patient: user._id,
                status: "approved",
                consultation: { $exists: true, $ne: null }
            }),
            Analysis.find({
                patient: user._id,
                status: "pending",
            }),
            Notification.find({
                user: user._id,
                seen: false
            })
        ]);

        const totalReports = appointmentsReports.length + analysesReports.length;

        const responseUser = {
            ...user.toObject(),
            password: undefined,
            isVerified: undefined,
            isActive: undefined
        };

        res.status(200).json({
            success: true,
            message: `Welcome back ${user.fullName || ""}!`,
            totalReports,
            pendingAnalyses: pendingAnalyses.length,
            totalUnseenNotifications: notifications.length,
            data: {
                ...this.#getUsersData(responseUser, lang),
                ...token
            }
        });
    });




  // @desc    Log In
  // @route   POST /user/auth/login
  // @access  Public
  userLogin = asyncHandler(async (req, res, next) => {
      checkIfPhoneStartsWithPlus2(req);
      const { email, password, loginType, phone } = req.body;
      const lang = req.headers.lang || "en";

      const userFilter = phone ? { phone } : { email };
      let query = User.findOne(userFilter, null, {
          userLocationPopulation: true,
          skipPopulation: false
      });
      query.lang = lang;
      let user = await query;

      if (loginType) {
          if (!user)
              return res.status(200).json({
                  success: true,
                  message: "Please, Complete your profile!",
                  signUpForFirstTime: true
              });
          else return await this.login(user, loginType)(req, res, next);
      } else {
          if (!user) return next(new ApiError(translate("Incorrect Email or password", lang), 403));
          return await this.login(user, loginType)(req, res, next);
      }
  });


  // @desc    Sign Up
  // @route   POST /user/auth/register
  // @access  Public
  userRegister = async (req, res, next) => {
    console.log("++++++++++++++++++++++++");
    console.log(req.body.notificationToken);
    console.log("++++++++++++++++++++++++");

    const session = await mongoose.startSession();
    try {
        session.startTransaction();

        console.log(" 🚀~ Req.body ~ in User register", req.body);


        // Create a new user
        let user = await User.create(
            [
                {
                    fullName: req.body.fullName,
                    genderAr: req.body.genderAr,
                    gender: req.body.gender,
                    notVerifiedTime: Date.now(),
                    email: req.body.email,
                    phone: req.body.phone,
                    dateOfBirth: req.body.dateOfBirth,
                    loginType: req.body.loginType,
                    emergencyContact: req.body.emergencyContact,
                    notificationToken: req.body.notificationToken,
                    password: req.body.password
                }
            ],
            { session }
        );
        user = user[0];

        // Generate a verification code
        const { code, hashedCode } = await generateCode();
        user.verificationCode = hashedCode;
        user.verificationCodeExp = Date.now() + 10 * 60 * 1000;

        await user.save({ session });

        const { email, loginType } = req.body;

        // For non-email login types, mark as verified immediately
        if (loginType && loginType !== "email") {
            user.isVerified = true;
            const token = await user.generateToken();
            await user.save({ session });
            await session.commitTransaction();

            user = await User.findById(user._id, null, {
                lang: req.headers.lang,
                userLocationPopulation: true
            });

            res.status(200).json({
                success: true,
                message: "Account Created and verified successfully",
                data: {
                    ...this.#getUsersData(user, req.headers.lang),
                    ...token
                }
            });
        } else if (email) {
            // Send verification email only
            await userVerificationEmail(code, email);
            await session.commitTransaction();

            user = await User.findById(user._id, null, {
                lang: req.headers.lang,
                userLocationPopulation: true
            });

            res.status(200).json({
                success: true,
                message: "Verification OTP is sent to your Email",
                data: {
                    ...this.#getUsersData(user, req.headers.lang)
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

  // @desc    User account verification
  // @route   POST /user/auth/verifyAccount
  // @access  Public
  userVerifyAccount = asyncHandler(async (req, res, next) => {
    const lang = req.headers.lang || "en";
    console.log("++++++++++++++++++++++++");
    console.log(req.body.notificationToken);
    console.log("++++++++++++++++++++++++");

    if (!req.body.code)
      return next(new ApiError(translate("Verification OTP is required", lang), 400));

    const hashedCode = crypto.createHash("sha256").update(req.body.code).digest("hex");

    const user = await User.findOne({ email: req.body.email });
    if (!user || (!user.verificationCode && !user.verificationCodeExp))
      return next(new ApiError(translate("Invalid request", lang), 400));

    if (Date.now() >= Date.parse(user.verificationCodeExp))
      return next(new ApiError(translate("Verification OTP is expired", lang), 401));

    if (user.verificationCode !== hashedCode)
      return next(new ApiError(translate("Invalid Verification OTP", lang), 401));

    user.isVerified = true;
    user.notVerifiedTime = undefined;
    user.verificationCode = undefined;
    user.verificationCodeExp = undefined;
    user.notificationToken = req.body.notificationToken;
    await user.save();

    const token = await user.generateToken();

    res.status(200).json({
      success: true,
      message: "Account verified successfully", 
      data: {
        ...this.#getUsersData(user, req),
        ...token
      }
    });
  });


  // @desc    Update logged user password
  // @route   PATCH /user/auth/change-password
  // @access  Private
  updateLoggedUserPassword = asyncHandler(async (req, res, next) => { 
    const lang = req.headers.lang || "en";

    if (!(await req.user.comparePassword(req.body.currentPassword)))
      return next(new ApiError(translate("Incorrect password", lang), 401));

    const user = await User.findById(req.user._id);
    if (!user) return next(new ApiError("User not found!", 404));

    user.password = req.body.newPassword;
    user.passwordChangedAt = Date.now();
    await user.save();

    res.status(200).json({
      success: true,
      message: "Password updated successfully, please login again"
    });
  });

  verifyOtp = asyncHandler(async (req, res, next) => {
    const lang = req.headers.lang || "en";

    const hashedCode = hashCode(req.body.otp);
    const user = await User.findOne(
      {
        verificationCode: hashedCode,
        verificationCodeExp: { $gt: Date.now() }
      },
      null,
      {
        userLocationPopulation: true
      }
    );

    if (!user)
      return next(new ApiError(translate("OTP isn't found!", lang), 403));

    let token = { token: user.token, tokenExpDate: user.tokenExpDate };

    if (user.unverifiedPhone) {
      if (user.phone) token = await user.generateToken();
      user.phone = user.unverifiedPhone;
      user.unverifiedPhone = undefined;
    } else if (user.unverifiedEmail) {
      if (user.email) token = await user.generateToken();
      user.email = user.unverifiedEmail;
      user.unverifiedEmail = undefined;
    }

    if (!token.token) token = await user.generateToken();

    user.isVerified = true;
    user.verificationCodeExp = undefined;
    user.verificationCode = undefined;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Account verified successfully",
      data: {
        ...this.#getUsersData(user, lang),
        ...token
      }
    });
  });

  sendOtp = asyncHandler(async (req, res, next) => {
    let { phone, email } = req.body;
    const userFilter = phone
      ? { $or: [{ phone }, { unverifiedPhone: phone }] }
      : { $or: [{ email }, { unverifiedEmail: email }] };
    const user = await User.findOne(userFilter);
    if (!user) return next(new ApiError(translate("User Not Found!", lang), 404));
    const { code, hashedCode } = await generateCode();
    user.verificationCode = hashedCode;
    // Send verification mail
    // Save hashed verification code in DB
    user.verificationCode = hashedCode;
    user.verificationCodeExp = Date.now() + 10 * 60 * 1000;
    await user.save();

    if (email) {
      await EmailController.userVerificationEmail(code, email);
      res.status(200).json({
        success: true,
        message: "Verification OTP is sent to your Email"
      });
    }
  });

  logOut = asyncHandler(async (req, res, next) => {
    const user = req.user;
    await user.updateOne({
      $unset: { notificationToken: 1, token: 1, tokenExpDate: 1 }
    });

    res.status(200).json({
      success: true,
      message: "User logged out successfully!"
    });
  });
}

module.exports = new UserController();