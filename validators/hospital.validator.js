const Joi = require('joi');
const asyncHandler = require("express-async-handler");
const joiErrorHandler = require("./joiErrorHandler");
const { phoneNumberValidator } = require("./validatorComponents");

class HospitalValidator {
    validateCreateHospital = asyncHandler(async (req, res, next) => {
        const schema = Joi.object({
            hospitalName: Joi.string().min(3).max(100).required(),
            address: Joi.string().required(),
            phone: Joi.string().custom(phoneNumberValidator).required(),
            email: Joi.string().email().required(),
        });
        joiErrorHandler(schema, req);
        next();
    });
    
    validateUpdateHospital = asyncHandler(async (req, res, next) => {
        const schema = Joi.object({
            hospitalName: Joi.string().min(3).max(100),
            address: Joi.string().optional(),
            phone: Joi.string().custom(phoneNumberValidator),
            email: Joi.string().email().optional(),
        });
        joiErrorHandler(schema, req);
        next();
    });
}
module.exports = new HospitalValidator();