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
    #sendNotificationHelper = async (appointment, user, notificationTitle, notificationBody, caseType) => {
        let notification = {
            token: user.notificationToken,
            title: notificationTitle,
            body: notificationBody,
            case: caseType,
            info: appointment._id.toString(),  
            user: user._id
        }

        if (user.notificationToken) {
            sendNotification({
                token: user.notificationToken,
                title: notificationTitle,
                body: notificationBody,
                caseType,
                info: appointment._id.toString()
            })
            await Notification.create(notification);
        }
    }

    //@desc patient create appointment
    //@route POST /appointments
    //@access Public
    createAppointment = asyncHandler(async (req, res, next) => {
        const appointment = await Appointment.create(req.body);

        if (req.user.role === USER) {
            const doctor = await Doctor.findById(req.body.doctor).select("notificationToken _id");
            if  (!doctor) {
                return next(new ApiError("Doctor not found", 404));
            }
            await this.#sendNotificationHelper(
                appointment,
                doctor,
                "You have a new appointment request",
                `Patient ${req.user.fullName.split(" ")[0]} booked a new appointment. Please accept or reject the request.`,
                "Appointment Request",
            )
        }

        res.status(201).json({
            success: true,
            message: "Appointment created successfully",
            data: appointment
        })
    })

    //@desc Get My Appointments
    //@route GET /appointments
    //@access Public
    getMyAppointments = asyncHandler(async (req, res, next) => {
        const apiFeatures = new ApiFeatures(Appointment.find({ patient: req.user._id })
            .populate('doctor', "fullName email phone")
            .sort({ date: 1, time: 1 }),
            req.query, 'Appointment')
            .filter()
            .paginate()
            .cleanResponse();

        // execute query
        const appointments = await apiFeatures.query;

        res.status(200).json({
            success: true,
            totalResults: appointments.length,
            pagination: {
                page: Number(req.query.page) || 1,
                limit: Number(req.query.limit) || 20,
            },
            data: appointments
        });
    })

    //@desc Get doc Appointments
    //@route GET /appointments/doctor
    //@access Public
    getDoctorAppointments = asyncHandler(async (req, res, next) => {
        const apiFeatures = new ApiFeatures(Appointment.find({ doctor: req.user._id })
            .populate('patient', "fullName email phone")
            .sort({ date: 1, time: 1 }),
            req.query, 'Appointment')
            .filter()
            .paginate()
            .cleanResponse();

        // execute query
        const appointments = await apiFeatures.query;

        res.status(200).json({
            success: true,
            totalResults: appointments.length,
            pagination: {
                page: Number(req.query.page) || 1,
                limit: Number(req.query.limit) || 20,
            },
            data: appointments
        });
    })

    // @desc update appointment by user
    // @route PATCH /appointments/:id
    // @access Public
    updateAppointment = asyncHandler(async (req, res, next) => {
        const { id } = req.params;

        const appointment = await Appointment.findById(id);
        if (!appointment) {
            return next(new ApiError('Appointment not found', 404));
        }

        if (appointment.status !== "accepted") {
            return next(new ApiError('Appointment cannot be updated unless it is accepted', 400));
        }
        const updatedAppointment = await Appointment.findByIdAndUpdate(id, req.body, { new: true });

        const patient = await User.findById(appointment.patient).select("notificationToken _id");
        if (!patient) {
            return next(new ApiError('Patient not found', 404));
        }

        await this.#sendNotificationHelper(
            appointment,
            patient,
            "Your appointment has been accepted!",
            `Dr.${req.user.fullName.split(" ")[0]} accepted your appointment scheduled on ${req.body.date} at ${req.body.time}.`,
            "Appointment Accepted"
        );

        res.status(200).json({
            success: true,
            message: "Appointment Date Booked",
            data: updatedAppointment
        });
    });

    // @desc Delete appointment by user
    // @route DELETE /appointments/:id
    // @access Public
    deleteAppointment = asyncHandler(async (req, res, next) => {
        const { id } = req.params;

        const appointment = await Appointment.findByIdAndDelete(id);

        if (!appointment) {
            return next(new ApiError('Appointment not found', 404));
        }

        res.status(200).json({
            success: true,
            message: "Appointment deleted successfully",
            data: appointment
        });
    })

    // @desc Change appointment status
    // @route PATCH /appointments/:id/status
    // @access Public
    changeAppointmentStatus = asyncHandler(async (req, res, next) => {
        const { id } = req.params;
        const { status, rejectionReason } = req.body;

        if (!APPOINTMENT_STATUS.includes(status)) {
            return next(new ApiError(`Invalid status. Allowed values: ${APPOINTMENT_STATUS.join(', ')}`, 400));
        }

        const appointment = await Appointment.findById(id);
        if (!appointment) {
            return next(new ApiError('Appointment not found', 404));
        }

        if (appointment.status !== "pending") {
            return next(new ApiError('Only pending appointments can be changed', 400));
        }
        
        if (req.user.role === USER && status !== 'canceled') {
            return next(new ApiError('Patients can only change status to canceled', 403));
        }

        const userId = req.user._id.toString();
        if (userId !== appointment.patient.toString() && userId !== appointment.doctor.toString()) {
            return next(new ApiError('You are not allowed to change this appointment status', 403));
        }

        if (appointment.status === status) {
            return res.status(400).json({
                success: false,
                message: `Appointment status is already ${status}`
            });
        }

        if (status !== "rejected" && rejectionReason) {
            return next(new ApiError("Rejection reason is only allowed when status is rejected", 400));
        }

        if (status === "rejected" && (!rejectionReason || rejectionReason.trim() === "")) {
            return next(new ApiError("Rejection reason is required", 400));
        }

        appointment.status = status;

        if (status === "rejected") {
            appointment.rejectionReason = rejectionReason;
        } else {
            appointment.rejectionReason = undefined; 
        }

        if (status !== "accepted") {
            if (req.user.role === DOCTOR) {
                const patient = await User.findById(appointment.patient).select("_id notificationToken");
                if (!patient) {
                    return next(new ApiError('Patient not found', 404));
                }
    
                await this.#sendNotificationHelper(
                    appointment,
                    patient,
                    `Your appointment has been ${status}!`,
                    `Dr.${req.user.fullName.split(" ")[0]} ${status} your appointment ${  status === "rejected" ? `- Reason: ${rejectionReason}` : ""}.`,
                    "Appointment Status Updated",
                )
            } else {
                const doctor = await Doctor.findById(appointment.doctor).select("_id notificationToken");
                if (!doctor) {
                    return next(new ApiError('Doctor not found', 404));
                }
    
                await this.#sendNotificationHelper(
                    appointment,
                    doctor,
                    `Appointment has been Canceled!`,
                    `Patient ${req.user.fullName.split(" ")[0]} canceled the appointment `,
                    "Appointment Status Updated",
                )
            }
        }            


        await appointment.save();

        res.status(200).json({
            success: true,
            message: `Appointment status updated successfully to ${status}`,
            data: appointment
        });
    });

     // TODO :  markAsAttended to change last visit
}

module.exports = new AppointmentController();