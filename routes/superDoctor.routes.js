const express = require("express");
const { SUPER_DOCTOR } = require("../utils/constants");

// Middlewares
const { protect, allowedTo } = require("../middlewares/auth.middleware");

// Classes
const SuperDoctorController = require("../controllers/superDoctor.controller");
const UserValidator = require("../validators/user.validator");
const DoctorValidator = require("../validators/doctor.validator");
// Router
const router = express.Router();

router.route("/users")
    .get(
        protect,
        allowedTo(SUPER_DOCTOR),
        SuperDoctorController.getAllUsers
    );

router.route("/doctors")
    .post(
        protect,
        allowedTo(SUPER_DOCTOR),
        DoctorValidator.validateAddDoctorBySuperDoctor,
        SuperDoctorController.addDoctor
    )
    .get(
        protect,
        allowedTo(SUPER_DOCTOR),
        SuperDoctorController.getAllDoctors
    );

router.route("/reports")
    .get(
        protect,
        allowedTo(SUPER_DOCTOR),
        SuperDoctorController.getAllReports
    );

router.route("/appointments")
    .get(
        protect,
        allowedTo(SUPER_DOCTOR),
        SuperDoctorController.getAllAppointments
    );

router.route("/analysis")
    .get(
        protect,
        allowedTo(SUPER_DOCTOR),
        SuperDoctorController.getAllAnalysis
    );

router.route("/doctors/:id")
    .patch(
        protect,
        allowedTo(SUPER_DOCTOR),
        DoctorValidator.validateUpdateDoctor,
        SuperDoctorController.updateDoctor
    ).delete(
        protect,
        allowedTo(SUPER_DOCTOR),
        SuperDoctorController.deleteDoctor
    );

router.route("/users/:id")
    .patch(
        protect,
        allowedTo(SUPER_DOCTOR),
        UserValidator.validateUpdateUser,
        SuperDoctorController.updateUser
    ).delete(
        protect,
        allowedTo(SUPER_DOCTOR),
        SuperDoctorController.deleteUser
    );

module.exports = router;