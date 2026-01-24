const express = require("express");

const { USER, DOCTOR } = require("../utils/constants");

// Middlewares
const { protect, allowedTo } = require("../middlewares/auth.middleware");

// Classes
const SuperDoctorController = require("../controllers/superDoctor.controller");
// Router
const router = express.Router();

router.route("/users")
    .get(
        protect,
        allowedTo(SUPER_DOCTOR),
        SuperDoctorController.getAllUsers
    );

router.route("/doctors")
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

router.route("/analyses")
    .get(
        protect,
        allowedTo(SUPER_DOCTOR),
        SuperDoctorController.getAllAnalyses
    );

module.exports = router;