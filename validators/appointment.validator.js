const Joi = require('joi');
const asyncHandler = require("express-async-handler");
const ApiError = require("../utils/ApiError");
const joiErrorHandler = require("./joiErrorHandler");
const { objectIdValidator } = require("./validatorComponents");
const { APPOINTMENT_TYPES, USER, DOCTOR } = require("../utils/constants");
const Appointment = require("../models/appointment.model");
const User = require("../models/user.model");
const Doctor = require("../models/doctor.model");

class AppointmentValidator {

    // separate function to build Date object from date and time
    buildDateTime = (date, time) => {
        const [timePart, modifier] = time.split(" ");
        let [hours, minutes] = timePart.split(":").map(Number);

        if (modifier.toUpperCase() === "PM" && hours !== 12) {
            hours += 12;
        }

        if (modifier.toUpperCase() === "AM" && hours === 12) {
            hours = 0;
        }

        const dateTime = new Date(date);
        dateTime.setHours(hours, minutes, 0, 0);

        return dateTime;
    };

    validateCreateAppointment = asyncHandler(async (req, res, next) => {

        if (req.user.role === USER) {
            if (req.body.patient)
                return next(new ApiError("Patient not allowed", 403));

            if (req.body.date || req.body.time)
                return next(new ApiError("Date and time not allowed for patients", 403));

            req.body.patient = req.user._id;
        } else {
            if (req.body.doctor)
                return next(new ApiError("Doctor not allowed", 403));

            req.body.doctor = req.user._id;
        }

        const schema = Joi.object({
            patient: Joi.custom(objectIdValidator).required(),
            doctor: Joi.custom(objectIdValidator).required(),

            date: req.user.role === USER
                ? Joi.forbidden()
                : Joi.date().required(),

            time: req.user.role === USER
                ? Joi.forbidden()
                : Joi.string()
                    .pattern(/^(0?[1-9]|1[0-2]):[0-5][0-9]\s?(AM|PM)$/i)
                    .required(),

            type: Joi.string().valid(...APPOINTMENT_TYPES).required()
        });

        joiErrorHandler(schema, req);

        if (req.user.role !== USER) {
            const { date, time } = req.body;
            const startTime = this.buildDateTime(date, time);

            if (startTime < new Date()) {
                return next(
                    new ApiError("Appointment date and time cannot be in the past", 400)
                );
            }
        }

        const existPatient = await User.findById(req.body.patient);
        if (!existPatient) {
            return next(new ApiError("Patient not found", 404));
        }

        const existDoctor = await Doctor.findById(req.body.doctor);
        if (!existDoctor) {
            return next(new ApiError("Doctor not found", 404));
        }

        next();
    });


}

module.exports = new AppointmentValidator();
