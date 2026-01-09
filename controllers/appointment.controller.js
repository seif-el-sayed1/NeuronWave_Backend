const asyncHandler = require("express-async-handler");
const ApiError = require("../utils/ApiError");
const ApiFeatures = require("../utils/ApiFeatures");
const Appointment = require("../models/appointment.model");
const User = require("../models/user.model");
const Doctor = require("../models/doctor.model");
const Notification = require("../models/notification.model");
const { USER, APPOINTMENT_STATUS, DOCTOR } = require("../utils/constants")
const { sendNotification } = require("../utils/sendNotification");
class AppointmentController {

    //@desc patient create appointment
    //@route POST /appointments
    //@access Public
    createAppointment = asyncHandler(async (req, res, next) => {
        const appointment = await Appointment.create(req.body);
        res.status(201).json({
            success: true,
            message: "Appointment created successfully",
            data: appointment
        })
    })

    

     // TODO :  markAsAttended to change last visit
}

module.exports = new AppointmentController();