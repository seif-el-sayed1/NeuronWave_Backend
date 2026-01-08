const express = require("express");

// constants
const { DOCTOR } = require("../utils/constants");

// Middlewares
const { protect, allowedTo } = require("../middlewares/auth.middleware");

// classes 
const PatientsController = require("../controllers/patient.controller");
const PatientValidator = require("../validators/patient.validator");

// Router
const router = express.Router();

router.route("/")
    .post(
        protect,
        allowedTo(DOCTOR),
        PatientValidator.validateAddPatient,
        PatientsController.addPatient
    )

module.exports = router;

