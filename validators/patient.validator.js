const Joi = require('joi');
const asyncHandler = require("express-async-handler");
const ApiError = require("../utils/ApiError");
const joiErrorHandler = require("./joiErrorHandler");
const { objectIdValidator, phoneNumberValidator } = require("./validatorComponents");
const { checkIfPhoneStartsWithPlus2 } = require("../middlewares/phoneNumberChecker.middleware");

class PatientValidator {
    validateAddPatient = asyncHandler(async (req, res, next) => {
        req.body.doctor = req.user._id;
        req.body.registerType = "byDoctor"
        const schema = Joi.object({
            doctor: Joi.custom(objectIdValidator).required(),
            fullName: Joi.string().required(),
            email: Joi.string().email().required(),
            phone: Joi.string().custom(phoneNumberValidator).required(),
            age: Joi.number().min(0).required(),
            gender: Joi.string().valid("male", "female", "ذكر", "انثي").required(),
            address: Joi.string().required(),
            emergencyContact: Joi.string().custom(phoneNumberValidator).required(),
            medicalHistory: Joi.string().required(),
            diagnosis: Joi.string().required(),
            registerType: Joi.string().required()
        });

        joiErrorHandler(schema, req,);
        checkIfPhoneStartsWithPlus2(req)


        next();
    });

    


}

module.exports = new PatientValidator();