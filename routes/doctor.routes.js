const express = require("express");

const { DOCTOR } = require("../utils/constants");

// Middlewares
const { protect, allowedTo } = require("../middlewares/auth.middleware");

// Classes
const DoctorController = require("../controllers/doctor.controller");
const DoctorValidator = require("../validators/doctor.validator");
// Router
const router = express.Router();

// User Routes
    
router.route("/")
    .get(
        protect,
        DoctorController.getAllDoctors
    )

router
    .route("/me")
    .get(
        protect,
        allowedTo(DOCTOR),
        DoctorController.getMyProfile
    )

module.exports = router;