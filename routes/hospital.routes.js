const express = require("express");

const { ADMIN, SUPER_DOCTOR } = require("../utils/constants");

// Middlewares
const { protect, allowedTo } = require("../middlewares/auth.middleware");
// Classes
const HospitalController = require("../controllers/hospital.controller");
const HospitalValidator = require("../validators/hospital.validator");

// Router
const router = express.Router();

router.route("/")
    .post( 
        protect, 
        allowedTo(SUPER_DOCTOR), 
        HospitalValidator.validateCreateHospital, 
        HospitalController.createHospital
    ).get(
        HospitalController.getAllHospitals
    )

router.route("/:id")
    .patch( 
        protect, 
        allowedTo(SUPER_DOCTOR), 
        HospitalValidator.validateUpdateHospital, 
        HospitalController.updateHospital
    ).delete(
        protect, 
        allowedTo(SUPER_DOCTOR), 
        HospitalController.deleteHospital
    )

module.exports = router;