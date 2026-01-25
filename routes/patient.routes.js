const express = require("express");

// constants
const { DOCTOR, SUPER_DOCTOR } = require("../utils/constants");

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
    .get(
        protect,
        allowedTo(DOCTOR, SUPER_DOCTOR),
        PatientsController.getAllPatients
    )

router.route("/:id/note")
    .patch(
        protect,
        allowedTo(DOCTOR),
        PatientsController.addPatientNote
    )

router.route("/:id")
    .get(
        protect,
        allowedTo(DOCTOR),
        PatientsController.getOnePatient
    )
    .patch(
        protect,
        allowedTo(DOCTOR),
        PatientValidator.validateUpdatePatient,
        PatientsController.updatePatient
    )
    .delete(
        protect,
        allowedTo(DOCTOR),
        PatientsController.deletePatient
    )

module.exports = router;

