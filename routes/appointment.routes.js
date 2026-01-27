const express = require("express");

const { USER, DOCTOR, SUPER_DOCTOR } = require("../utils/constants");

// Middlewares
const { protect, allowedTo } = require("../middlewares/auth.middleware");
// Classes
const AppointmentController = require("../controllers/appointment.controller");
const AppointmentValidator = require("../validators/appointment.validator");

// Router
const router = express.Router();

router.route("/")
    .post( 
        protect, 
        allowedTo(USER, DOCTOR), 
        AppointmentValidator.validateCreateAppointment, 
        AppointmentController.createAppointment
    ).get(
        protect, 
        allowedTo(USER), 
        AppointmentController.getMyAppointments
    )

router.route("/doctor")
    .get( 
        protect, 
        allowedTo(DOCTOR, SUPER_DOCTOR), 
        AppointmentController.getDoctorAppointments
    );

router.route("/doctor/reports")
    .get( 
        protect, 
        allowedTo(DOCTOR, SUPER_DOCTOR), 
        AppointmentController.getDoctorReports
    );

router.route("/reports")
    .get( 
        protect, 
        allowedTo(USER), 
        AppointmentController.getMyReports
    );

router.route("/:id/status")
    .patch(
        protect,
        allowedTo(USER, DOCTOR, SUPER_DOCTOR),
        AppointmentController.changeAppointmentStatus
    );

router
    .route("/:id/reports")
    .get(
        protect,
        allowedTo(USER, DOCTOR, SUPER_DOCTOR),
        AppointmentController.generateAppointmentReport
    )

router
    .route("/:id/payment")
    .post(
        protect,
        allowedTo(USER),
        AppointmentController.appointmentPayment
    );

router.route("/:id")
    .patch( 
        protect,
        allowedTo(DOCTOR, SUPER_DOCTOR),
        AppointmentValidator.validateUpdateAppointmentTime,
        AppointmentController.updateAppointment
    ).delete(
        protect,
        allowedTo(USER, DOCTOR, SUPER_DOCTOR),
        AppointmentController.deleteAppointment
    );


module.exports = router;