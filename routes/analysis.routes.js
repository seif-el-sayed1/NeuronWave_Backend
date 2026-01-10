const express = require("express");

// middlewares
const { protect, allowedTo } = require("../middlewares/auth.middleware");
const { USER, DOCTOR } = require("../utils/constants");
const upload = require("../middlewares/upload.middleware");

// controller
const AnalysisController = require("../controllers/analysis.controller");

// router
const router = express.Router();

router
    .route("/")
    .post(
        protect,
        allowedTo(DOCTOR),
        upload.uploadMedia,
        AnalysisController.processAnalysisByDoctor
    );

router
    .route("/request")
    .post(
        protect,
        allowedTo(USER),
        upload.uploadMedia,
        AnalysisController.requestAnalysis
    );

router
    .route("/:id/consultation")
    .patch(
        protect,
        allowedTo(DOCTOR),
        AnalysisController.writeDoctorConsultation
    );

router
    .route("/:id")
    .patch(
        protect,
        allowedTo(DOCTOR),
        upload.uploadMedia,
        AnalysisController.approvedRejectAnalysis
    );

router
    .route("/:id/doctor")
    .get(
        protect,
        allowedTo(DOCTOR),
        AnalysisController.getDoctorAnalysis
    );

router
    .route("/:id/patient")
    .get(
        protect,
        allowedTo(USER),
        AnalysisController.getPatientAnalysis
    );

module.exports = router;
