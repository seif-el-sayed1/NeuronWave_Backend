const asyncHandler = require("express-async-handler");
const ApiError = require("../utils/ApiError");
const ApiFeatures = require("../utils/ApiFeatures");
const Appointment = require("../models/appointment.model");
const User = require("../models/user.model");
const Doctor = require("../models/doctor.model");
const Notification = require("../models/notification.model");
const { USER, APPOINTMENT_STATUS, DOCTOR } = require("../utils/constants")
const { sendNotification } = require("../utils/sendNotification");
const { translate } = require("../utils/translation");
const { generateAppointmentPDF } = require("../utils/generateReports");

function formatTimeAr(time) {
    const [hourMin, period] = time.split(" "); // ["06:00", "PM"]
    let [hour, minute] = hourMin.split(":").map(Number);

    if (period === "PM" && hour < 12) hour += 12;
    if (period === "AM" && hour === 12) hour = 0;

    const formattedHour = hour % 12 === 0 ? 12 : hour % 12;
    const arabicPeriod = period === "PM" ? "مساءً" : "صباحًا";

    return `${formattedHour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")} ${arabicPeriod}`;
}

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
        const lang = req.headers.lang || "en";

        const populatedAppointment = await Appointment.findById(appointment._id)
            .populate({
                path: "doctor",
                select: "fullName email phone medicalSpecialty lang notificationToken _id",
            });

        if (req.user.role === USER) {
            const doctor = await Doctor.findById(req.body.doctor).select("notificationToken _id lang");
            if (!doctor) {
                return next(new ApiError(translate("Doctor not found", lang), 404));
            }

            await this.#sendNotificationHelper(
                appointment,
                doctor,
                translate("You have a new appointment request", doctor.lang),
                `${req.user.fullName.split(" ")[0]} ${translate("booked a new appointment. Please accept or reject the request.", doctor.lang)}`,
                "Appointment Request"
            );
        }

        res.status(201).json({
            success: true,
            message: "Appointment created successfully",
            data: populatedAppointment
        });
    });

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
        const lang = req.headers.lang || "en";
        const appointment = await Appointment.findById(id)
            .populate("patient", "fullName notificationToken lang _id");

        if (!appointment) {
            return next(new ApiError(translate("Appointment not found", lang), 404));
        }

        if (appointment.status !== "accepted") {
            return next(
                new ApiError(
                    translate("Appointment cannot be updated unless it is accepted", lang),
                    400
                )
            );
        }

        const updatedAppointment = await Appointment.findByIdAndUpdate(
            id,
            req.body,
            { new: true }
        ).populate("patient", "fullName notificationToken lang");

        const patient = appointment.patient;
        if (!patient) {
            return next(new ApiError(translate("Patient not found", lang), 404));
        }

        let doctorFirstName = req.user.fullName.split(" ")[0];
        let body;

        if (patient.lang === "ar") {
            const timeAr = formatTimeAr(req.body.time);
            body = `د. ${doctorFirstName} أكد موعدك يوم ${req.body.date} الساعة ${timeAr}. يمكنك الآن الاطلاع على تقرير الموعد من التطبيق.`;
        } else {
            body = `Dr. ${doctorFirstName} confirmed your appointment on ${req.body.date} at ${req.body.time}. You can now view the appointment report in the app.`;
        }


        await this.#sendNotificationHelper(
            appointment,
            patient,
            patient.lang === "ar" ? "تم قبول الموعد" : "Your appointment has been accepted!",
            body,
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
        const lang = req.headers.lang || "en";
        const appointment = await Appointment.findByIdAndDelete(id);

        if (!appointment) {
            return next(new ApiError(translate('Appointment not found', lang), 404));
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
        const lang = req.headers.lang || "en";

        if (!APPOINTMENT_STATUS.includes(status)) {
            return next(
                new ApiError(
                    `Invalid status. Allowed values: ${APPOINTMENT_STATUS.join(", ")}`,
                    400
                )
            );
        }

        const appointment = await Appointment.findById(id)
            .populate("patient", "_id fullName notificationToken lang")
            .populate("doctor", "_id fullName notificationToken lang");

        if (!appointment) {
            return next(new ApiError(translate("Appointment not found", lang), 404));
        }

        if (appointment.status !== "pending") {
            return next(
                new ApiError(translate("Only pending appointments can be changed", lang), 400)
            );
        }

        if (req.user.role === USER && status !== "canceled") {
            return next(
                new ApiError(
                    translate("Patients can only change status to canceled", lang),
                    403
                )
            );
        }

        const userId = req.user._id.toString();
        if (
            userId !== appointment.patient._id.toString() &&
            userId !== appointment.doctor._id.toString()
        ) {
            return next(
                new ApiError(
                    translate("You are not allowed to change this appointment status", lang),
                    403
                )
            );
        }

        if (appointment.status === status) {
            return res.status(400).json({
                success: false,
                message: `Appointment status is already ${status}`
            });
        }

        if (status !== "rejected" && rejectionReason) {
            return next(
                new ApiError(
                    translate("Rejection reason is only allowed when status is rejected", lang),
                    400
                )
            );
        }

        if (status === "rejected" && (!rejectionReason || rejectionReason.trim() === "")) {
            return next(new ApiError(translate("Rejection reason is required", lang), 400));
        }

        appointment.status = status;

        if (status === "rejected") {
            appointment.rejectionReason = rejectionReason;
        } else {
            appointment.rejectionReason = undefined;
        }

        if (status !== "accepted") {
            if (req.user.role === DOCTOR) {

                const patient = appointment.patient;

                await this.#sendNotificationHelper(
                    appointment,
                    patient,
                    translate(`Your appointment has been ${status}!`, patient.lang),
                    `Dr.${req.user.fullName.split(" ")[0]} ${translate(`${status} your appointment`, patient.lang)} ${
                        status === "rejected" ? ` - ${translate("Reason:", patient.lang)} ${rejectionReason}` : ""
                    }.`,
                    "Appointment Status Updated"
                );

            } else {

                const doctor = appointment.doctor;

                await this.#sendNotificationHelper(
                    appointment,
                    doctor,
                    translate("Appointment has been Canceled!", doctor.lang),
                    `${req.user.fullName.split(" ")[0]} ${translate("canceled the appointment", doctor.lang)}.`,
                    "Appointment Status Updated"
                );
            }
        }

        await appointment.save();

        res.status(200).json({
            success: true,
            message: `Appointment status updated successfully to ${status}`,
            data: appointment
        });
    });

    // @desc Generate appointment report PDF
    // @route GET /appointments/:id/report
    // @access Private 
    generateAppointmentReport = asyncHandler(async (req, res, next) => {
        const { id } = req.params;

        const appointment = await Appointment.findById(id);
        if (!appointment) {
            return res.status(404).json({
                success: false,
                message: "Appointment not found"
            });
        }

        const pdfBuffer = await generateAppointmentPDF(id);

        const formattedDate = appointment.date
            ? appointment.date.toISOString().split('T')[0]
            : 'no-date';

        const formattedTime = appointment.time
            ? appointment.time.replace(/:/g, '-')
            : 'no-time';

        const fileName = `appointment-${formattedDate}-${formattedTime}.pdf`;

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader(
            'Content-Disposition',
            `attachment; filename="${fileName}"`
        );
        res.setHeader('Content-Length', pdfBuffer.length);

        res.send(pdfBuffer);
    });


    //@desc Get My Reports
    //@route GET /appointments/reports
    //@access Private
    getMyReports = asyncHandler(async (req, res, next) => {
        const apiFeatures = new ApiFeatures(
            Appointment.find({ 
                patient: req.user._id,
                status: "accepted",
                date: { $ne: null },
                time: { $ne: null }
            }).populate("doctor", "fullName"),
            req.query,
            "Appointment"
        )
            .filter()
            .sort()
            .paginate()
            .cleanResponse();

        const appointments = await apiFeatures.query;

        res.json({
            success: true,
            totalResults: appointments.length,
            pagination: {
                page: Number(req.query.page) || 1,
                limit: Number(req.query.limit) || 20,
            },
            data: appointments
        });
    });

    //@desc Get Doctor Reports
    //@route GET /appointments/doctor/reports
    //@access Private
    getDoctorReports = asyncHandler(async(req, res, next) => {
        const apiFeatures = new ApiFeatures(Appointment.find({ 
            doctor: req.user._id,
            status: "accepted",
            date: { $ne: null },
            time: { $ne: null }
        }).populate("patient", "fullName"), req.query, "Appointment")
            .filter()
            .sort()
            .paginate()
            .cleanResponse();
        const appointments = await apiFeatures.query;
        res.json({
            success: true,
            totalResults: appointments.length,
            pagination: {
                page: Number(req.query.page) || 1,
                limit: Number(req.query.limit) || 20,
            },
            data: appointments
        });
    })    


}

module.exports = new AppointmentController();