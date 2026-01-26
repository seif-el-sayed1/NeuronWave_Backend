const express = require("express");

// middlewares
const { protect, allowedTo } = require("../middlewares/auth.middleware");
const { USER, DOCTOR, SUPER_DOCTOR } = require("../utils/constants");
const upload = require("../middlewares/upload.middleware");

// controller
const AnalysisController = require("../controllers/analysis.controller");

// router
const router = express.Router();

router
    .route("/")
    .post(
        protect,
        allowedTo(DOCTOR, SUPER_DOCTOR),
        upload.uploadMedia,
        AnalysisController.processAnalysisByDoctor
    );

router
    .route("/doctor")
    .get(
        protect,
        allowedTo(DOCTOR, SUPER_DOCTOR),
        AnalysisController.getDoctorAnalysis
    );

router
    .route("/patient")
    .get(
        protect,
        allowedTo(USER),
        AnalysisController.getPatientAnalysis
    );

router
    .route("/reports")
    .get(
        protect,
        allowedTo(USER),
        AnalysisController.getMyReports
    );

router
    .route("/doctor/reports")
    .get(
        protect,
        allowedTo(DOCTOR, SUPER_DOCTOR),
        AnalysisController.getDoctorReports
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
        allowedTo(DOCTOR, SUPER_DOCTOR),
        AnalysisController.writeDoctorConsultation
    );

router
    .route("/:id")
    .patch(
        protect,
        allowedTo(DOCTOR, SUPER_DOCTOR),
        upload.uploadMedia,
        AnalysisController.approvedRejectAnalysis
    );

router
    .route("/:id/reports")
    .get(
        protect,
        allowedTo(USER, DOCTOR, SUPER_DOCTOR),
        AnalysisController.generateAnalysisReport
    )

module.exports = router;
