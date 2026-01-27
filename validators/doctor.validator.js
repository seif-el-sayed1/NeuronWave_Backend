const Joi = require("joi");
const asyncHandler = require("express-async-handler");
const joiErrorHandler = require("./joiErrorHandler");
const {
  phoneNumberValidator,
  objectIdValidator,
  medicalNumberValidator,
} = require("./validatorComponents");
const ApiError = require("../utils/ApiError");
const { translate } = require("../utils/translation");
const Doctor = require("../models/doctor.model");
const Hospital = require("../models/hospital.model");
const {
  GENDER_LIST_EN,
  GENDER_LIST_AR,
  LOGIN_TYPE_PLATFORM_LIST,
  LANGS,
  MEDICAL_SPECIALTIES,
} = require("../utils/constants");
const {
  checkIfPhoneStartsWithPlus2,
} = require("../middlewares/phoneNumberChecker.middleware");

/**
 * DoctorValidator class for validating doctor registration requests.
 *
 * This class contains methods for validating doctor data during the registration process using Joi and additional checks.
 */
class DoctorValidator {
  validateRegisterDoctor = asyncHandler(async (req, res, next) => {
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
        "string.pattern.base": "Invalid Phone Number",
      }),

      medicalSpecialty: Joi.string().valid(...MEDICAL_SPECIALTIES).required().messages({
        "any.required": "Medical Specialty is required",
        "array.includes": "Invalid Medical Specialty",
      }),

      medicalNumber: Joi.string().custom(medicalNumberValidator).required().messages({
        "any.required": "Medical Number is required",
      }),


      gender: Joi.string().valid("male", "female", "ذكر", "انثي").required(),
      
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

    for (let i = 0; i < req.body.hospitals?.length; i++) {
      const existHospital = await Hospital.findById(req.body.hospitals[i]);
      if (!existHospital) {
        return next(
          new ApiError(
            translate("Hospital not found", req.headers.lang),
            404
          )
        );
      }
    }

    joiErrorHandler(schema, req);
    checkIfPhoneStartsWithPlus2(req);
    next();
  });

  validateUpdateDoctor = asyncHandler(async (req, res, next) => {
    const schema = Joi.object({
      fullName: Joi.string().optional().min(2).max(32),
      phone: Joi.string().custom(phoneNumberValidator).optional().messages({
        "string.pattern.base":
          "Phone number must start with '0' and contain exactly 11 digits",
        "any.required": "Phone number is required",
      }),
      email: Joi.string().email().optional(),
      gender: Joi.string().valid("male", "female", "ذكر", "انثي").optional(),

      medicalSpecialty: Joi.valid(...MEDICAL_SPECIALTIES).optional().messages({
        "array.includes": "Invalid Medical Specialty",
      }),

      hospitals: Joi.array().items(Joi.custom(objectIdValidator)).optional(),
      
    });
    joiErrorHandler(schema, req);

    for (let i = 0; i < req.body.hospitals?.length; i++) {
      const existHospital = await Hospital.findById(req.body.hospitals[i]);
      if (!existHospital) {
        return next(
          new ApiError(
            translate("Hospital not found", req.headers.lang),
            404
          )
        );
      }
    }

    checkIfPhoneStartsWithPlus2(req);
    let { phone, email } = req.body;
    if (phone) {
      if (phone !== req.user.phone) {
        let doctor = await Doctor.findOne({
          $or: [{ phone }, { unverifiedPhone: phone }],
          _id: { $ne: req.user._id },
        });
        if (doctor)
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
        let doctor = await Doctor.findOne({
          $or: [{ email }, { unverifiedEmail: email }],
          _id: { $ne: req.user._id },
        });
        if (doctor)
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

  checkDoctorExistence = asyncHandler(async (req, res, next) => {
    let { id } = req.params;
    let doctor = await Doctor.findById(id);
    if (!doctor)
      return next(
        new ApiError(translate("User Not Found!", req.headers.lang), 404)
      );
    req.requestedDoctor = doctor; // this is the intendedUser to add action on him
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


  forgetPasswordValidator = asyncHandler(async (req, res, next) => {
      const schema = Joi.object({
        email: Joi.string().email().required()
      })
        .messages({
          "any.required": "Email must be provided"
        });
      joiErrorHandler(schema, req);
      const { email } = req.body;
      // Check Doctor
      let doctor;
      let errorMessage;
      if (email) {
        doctor = await Doctor.findOne({ email });
        errorMessage = "Invalid Email Address";
      }
      if (!doctor) return next(new ApiError(translate(errorMessage, req.headers.lang), 404));
      if (doctor.loginType !== "email")
        return next(
          new ApiError(
            `This Account Has logged in with ${doctor.loginType}, so you can't reset your password`,
            400
          )
        );
      req.requestedDoctor = doctor;
      next();
    });
  
  
    resetPasswordCodeValidator = asyncHandler(async (req, res, next) => {
      const schema = Joi.object({
        email: Joi.string().email().required(),
        code: Joi.string().required()
      }).messages({
        "any.required": "Email must be provided",
        "string.email": "Invalid Email Address"
      });
  
      joiErrorHandler(schema, req);
  
      const { email } = req.body;
      // Check Doctor
      let doctor = await Doctor.findOne({ email });
      if (!doctor) return next(new ApiError(translate("Invalid Email Address", req.headers.lang), 404));

      req.requestedDoctor = doctor;
      next();
    });
  
  
    resetPasswordValidator = asyncHandler(async (req, res, next) => {
      const schema = Joi.object({
        email: Joi.string().email().required(),
        newPassword: Joi.string().min(6).required(),
        confirmNewPassword: Joi.string().valid(Joi.ref("newPassword")).required()
      }).messages({
        "any.required": "Email must be provided",
        "string.email": "Invalid Email Address"
      });
  
      joiErrorHandler(schema, req);
  
      const { email } = req.body;
      // Check Doctor
      let doctor = await Doctor.findOne({ email });
      if (!doctor) return next(new ApiError(translate("Invalid Email Address", req.headers.lang), 404));

      // Check reset code verified field
      if (!doctor.passwordResetCodeVerified)
        return next(new ApiError(translate("Reset code is not verified", req.headers.lang), 401));
  
      req.requestedDoctor = doctor;
      next();
    });

    validateAddDoctorBySuperDoctor = asyncHandler(async(req, res, next) => {
      req.body.registerType = "bySuperDoctor"
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
          "string.pattern.base": "Invalid Phone Number",
        }),

        medicalSpecialty: Joi.string().valid(...MEDICAL_SPECIALTIES).required().messages({
          "any.required": "Medical Specialty is required",
          "array.includes": "Invalid Medical Specialty",
        }),
        medicalNumber: Joi.string().custom(medicalNumberValidator).required().messages({
          "any.required": "Medical Number is required",
        }),

        hospitals: Joi.array().items(Joi.custom(objectIdValidator)).required(),

        gender: Joi.string().valid("male", "female", "ذكر", "انثي").required(),

      })

      joiErrorHandler(schema, req);
      next();
    })


}

module.exports = new DoctorValidator();
