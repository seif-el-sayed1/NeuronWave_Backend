const Joi = require('joi');
const asyncHandler = require("express-async-handler");
const ApiError = require("../utils/ApiError");
const joiErrorHandler = require("./joiErrorHandler");
const { objectIdValidator } = require("./validatorComponents");
const { APPOINTMENT_TYPES, USER, DOCTOR } = require("../utils/constants");
const { translate } = require("../utils/translation");
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
        const lang = req.headers.lang || "en";
        if (req.user.role === USER) {
            if (req.body.patient)
                return next(new ApiError(translate("Patient not allowed", lang), 403));

            if (req.body.date || req.body.time)
                return next(new ApiError(translate("Date and time not allowed for patients", lang), 403));

            req.body.patient = req.user._id;
        } else {
            if (req.body.doctor)
                return next(new ApiError(translate("Doctor not allowed", lang), 403));

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
                    new ApiError(translate("Appointment date and time cannot be in the past", lang), 400)
                );
            }
        }

        const existPatient = await User.findById(req.body.patient);
        if (!existPatient) {
            return next(new ApiError(translate("Patient not found", lang), 404));
        }

        const existDoctor = await Doctor.findById(req.body.doctor);
        if (!existDoctor) {
            return next(new ApiError(translate("Doctor not found", lang), 404));
        }

        next();
    });

    validateUpdateAppointmentTime = asyncHandler(async (req, res, next) => {
        const lang = req.headers.lang || "en";
        const schema = Joi.object({
            date: Joi.date().optional(),
            time: Joi.string()
                .pattern(/^(0?[1-9]|1[0-2]):[0-5][0-9]\s?(AM|PM)$/i)
                .optional()
        });

        joiErrorHandler(schema, req);

        const appointmentId = req.params.id;
        const { date, time } = req.body;

        const currentAppointment = await Appointment.findById(appointmentId);
        if (!currentAppointment) {
            return next(new ApiError(translate("Appointment not found", lang), 404));
        }

        // Check if user is either the patient or the doctor of this appointment
        const userId = req.user._id.toString();
        if (
            userId !== currentAppointment.patient.toString() &&
            userId !== currentAppointment.doctor.toString()
        ) {
            return next(new ApiError(translate("You are not allowed to update this appointment", lang), 403));
        }

        const newDate = date || currentAppointment.date;
        const newTime = time || currentAppointment.time;
        const startTime = this.buildDateTime(newDate, newTime);

        if (startTime < new Date()) {
            return next(new ApiError(translate("Appointment date and time cannot be in the past", lang), 400));
        }

        next();
    });

}

module.exports = new AppointmentValidator();
