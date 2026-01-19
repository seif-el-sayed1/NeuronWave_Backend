const Joi = require("joi");
const asyncHandler = require("express-async-handler");
const joiErrorHandler = require("./joiErrorHandler");
const {
  phoneNumberValidator,
} = require("./validatorComponents");
const ApiError = require("../utils/ApiError");
const { translate } = require("../utils/translation");
const User = require("../models/user.model");
const {
  GENDER_LIST_EN,
  GENDER_LIST_AR,
  LOGIN_TYPE_PLATFORM_LIST,
  LANGS,
} = require("../utils/constants");
const {
  checkIfPhoneStartsWithPlus2,
} = require("../middlewares/phoneNumberChecker.middleware");

/**
 * UserValidator class for validating user registration requests.
 *
 * This class contains methods for validating user data during the registration process using Joi and additional checks.
 */
class UserValidator {
  validateRegisterUser = asyncHandler(async (req, res, next) => {
    const schema = Joi.object({
      fullName: Joi.string()
        .when("loginType", {
          is: Joi.valid(...LOGIN_TYPE_PLATFORM_LIST),
          then: Joi.optional().allow(""),
          otherwise: Joi.required(),
        })
        .min(2)
        .max(32)
        .messages({ "any.required": "Full Name is required" }),

      email: Joi.string().email().required().messages({
        "any.required": "Email is required",
        "string.email": "Invalid Email Address",
      }),

      phone: Joi.string().custom(phoneNumberValidator).required().messages({
        "any.required": "Phone is required",
      }),

      dateOfBirth: Joi.date().required(),

      gender: Joi.string().valid("male", "female", "ذكر", "انثي").required(),

      emergencyContact: Joi.string().custom(phoneNumberValidator).required().messages({
        "any.required": "Emergency Contact is required",
      }),


      loginType: Joi.string().optional(),

      password: Joi.string()
        .min(6)
        .when("loginType", { is: Joi.exist(), then: Joi.optional() })
        .messages({
          "string.min": "Password must be at least 6 characters",
          "any.required": "Password is required",
        }),

      confirmPassword: Joi.string()
        .valid(Joi.ref("password"))
        .when("loginType", { is: Joi.exist(), then: Joi.optional() })
        .messages({
          "any.required": "Confirm Password is required",
          "any.only": "Passwords do not match",
        }),

      notificationToken: Joi.string().optional(),
    });


    joiErrorHandler(schema, req);
    checkIfPhoneStartsWithPlus2(req);
    next();
  });

  validateUpdateUser = asyncHandler(async (req, res, next) => {
    const schema = Joi.object({
      fullName: Joi.string().optional().min(2).max(32),
      phone: Joi.string().custom(phoneNumberValidator).optional().messages({
        "string.pattern.base":
          "Phone number must start with '0' and contain exactly 11 digits",
        "any.required": "Phone number is required",
      }),
      dateOfBirth: Joi.date().optional(),
      email: Joi.string().email().optional(),
      age: Joi.number().min(0).required(),
      gender: Joi.string().valid("male", "female", "ذكر", "انثي").optional(),
      emergencyContact: Joi.string().custom(phoneNumberValidator).optional().messages({
        "any.required": "Emergency contact number is required",
      }),
      // Validate location using the defined schema
    });
    joiErrorHandler(schema, req);
    checkIfPhoneStartsWithPlus2(req);
    let { phone, email } = req.body;
    if (phone) {
      if (phone !== req.user.phone) {
        let user = await User.findOne({
          $or: [{ phone }, { unverifiedPhone: phone }],
          _id: { $ne: req.user._id },
        });
        if (user)
          return next(
            new ApiError(
              translate("Duplicated Phone Number", req.headers.lang),
              400
            )
          );
      } else
        return next(
          new ApiError(
            translate(
              "This Phone Number Has Been Verified Before",
              req.headers.lang
            ),
            400
          )
        );
    } else if (email) {
      if (email !== req.user.email) {
        let user = await User.findOne({
          $or: [{ email }, { unverifiedEmail: email }],
          _id: { $ne: req.user._id },
        });
        if (user)
          return next(
            new ApiError(translate("Duplicated Email", req.headers.lang), 400)
          );
      } else
        return next(
          new ApiError(
            translate("This Email Has Been Verified Before", req.headers.lang),
            400
          )
        );
    }
    next();
  });

  validateUserBlock = asyncHandler(async (req, res, next) => {
    let { id } = req.params;
    if (id.toString() === req.userId.toString())
      return next(
        new ApiError(
          translate("You Can't Block Yourself", req.headers.lang),
          400
        )
      );
    let user = await User.findById(id, null, { skipPopulation: true });
    if (!user)
      return next(
        new ApiError(translate("User Not Found!", req.headers.lang), 404)
      );
    next();
  });

  checkUserExistence = asyncHandler(async (req, res, next) => {
    let { id } = req.params;
    let user = await User.findById(id);
    if (!user)
      return next(
        new ApiError(translate("User Not Found!", req.headers.lang), 404)
      );
    req.requestedUser = user; // this is the intendedUser to add action on him
    next();
  });

  validateLanguageUpdate = asyncHandler(async (req, res, next) => {
    const schema = Joi.object({
      lang: Joi.string()
        .required()
        .valid(...LANGS),
    });
    joiErrorHandler(schema, req);
    next();
  });
}

module.exports = new UserValidator();
