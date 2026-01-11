const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");
const path = require("path");
const ApiFeatures = require("../utils/ApiFeatures");
const ApiError = require("../utils/ApiError");
const Analysis = require("../models/analysis.model");
const Doctor = require("../models/doctor.model");
const User = require("../models/user.model"); 
const Notification = require("../models/notification.model")
const runPythonAnalysis  = require("../utils/runPythonAnalysis");
const  { sendNotification } = require("../utils/sendNotification")
const { generateAnalysisPDF } = require("../utils/generateReports");

class AnalysisController {

    #sendNotificationHelper = async (analysis, user, notificationTitle, notificationBody, caseType) => {
        let notification = {
            token: user.notificationToken,
            title: notificationTitle,
            body: notificationBody,
            case: caseType,
            info: analysis._id.toString(),  
            user: user._id
        }

        if (user.notificationToken) {
            sendNotification({
                token: user.notificationToken,
                title: notificationTitle,
                body: notificationBody,
                caseType,
                info: analysis._id.toString()
            })
            await Notification.create(notification);
        }
    }

    //@desc Process analysis by doctor
    //@route POST /api/v1/analysis
    //@access Private
    processAnalysisByDoctor = asyncHandler(async (req, res, next) => {
        const { modelType, patient } = req.body;

        if (!mongoose.Types.ObjectId.isValid(patient) || !modelType) {
            return res.status(400).json({
                message: "modelType and patient are required"
            });
        }

        if (!req.files || req.files.length === 0) {
            return res.status(400).json({
                message: "No files uploaded"
            });
        }

        const analysisResults = [];

        for (const file of req.files) {
            const filePath = file.path;
            const originalName = file.originalname;
            const isVideo = file.mimetype.startsWith('video/');

            const result = await runPythonAnalysis(
                modelType,
                filePath,
                originalName,
                isVideo
            );

            analysisResults.push({
                filePath,
                originalName,
                isVideo,
                result
            });
        }

        const analysisDoc = new Analysis({
            patient,
            doctor: req.user?._id || "system",
            type: "byDoctor",
            media: req.files.map(f => f.path),
            modelType: modelType,
            result: analysisResults.map(r => r.result),
        });

        await analysisDoc.save();

        res.json({
            success: true,
            message: "Analysis processed successfully",
            data: analysisDoc
        });
    });

    //@desc Approve or reject analysis
    //@route PATCH /api/v1/analysis/:id
    //@access Private
    approvedRejectAnalysis = asyncHandler(async (req, res, next) => {
        const { id } = req.params;
        const { status } = req.body;

        if (status !== "approved" && status !== "rejected") {
            return next(new ApiError("Invalid status", 400));
        }

        const analysis = await Analysis.findById(id);
        if (!analysis) {
            return next(new ApiError("Analysis not found", 404));
        }
        const patient = await User.findById(analysis.patient)
        if (!patient) {
            return new ApiError("Patient not found", 404)
        }

        if (analysis.status !== "pending") {
            return next(new ApiError(`Analysis is not pending, you can't ${status}`, 400));
        }

        if (analysis.status === status) {
            return next(new ApiError("Analysis already " + status, 400));
        }

        if (status === "approved") {
            try {
                const analysisResults = await Promise.all(
                    analysis.media.map(async (filePath) => {
                        const originalName = path.basename(filePath);
                        const isVideo = originalName.endsWith('.mp4');

                        const result = await runPythonAnalysis(
                            analysis.modelType,
                            filePath,
                            originalName,
                            isVideo
                        );
                        return result;
                    })
                );

                analysis.result = analysisResults;
                analysis.status = "approved";
                await analysis.save();

                await this.#sendNotificationHelper(
                    analysis,
                    patient,
                    "Analysis Status Update",
                    "Your analysis has been Approved",
                    "analysisApproved"
                )

                res.json({
                    success: true,
                    message: "Analysis approved and results stored",
                    data: analysis
                });
            } catch (err) {
                return next(new ApiError(`Failed to approve analysis: ${err.message}`, 500));
            }
        } else {
            analysis.status = "rejected";
            await analysis.save();

            await this.#sendNotificationHelper(
                analysis,
                patient,
                "Analysis Status Update",
                "Your analysis has been rejected",
                "analysisRejected"
            )

            res.json({
                success: true,
                message: "Analysis rejected",
                data: analysis
            });
        }
    });

    //@desc Request analysis
    //@route POST /api/v1/analysis/request
    //@access Private
    requestAnalysis = asyncHandler(async (req, res, next) => {
        const { doctor, modelType } = req.body;

        if (!mongoose.Types.ObjectId.isValid(doctor) || !modelType) {
            return next(new ApiError("modelType and doctor are required", 400));
        }

        const existingDoctor = await Doctor.findById(doctor);
        if (!existingDoctor) {
            return next(new ApiError("Doctor not found", 404));
        }

        if (!req.files || req.files.length === 0) {
            return next(new ApiError("No files uploaded", 400));
        }

        const analysis = new Analysis({
            patient: req.user._id,
            doctor: existingDoctor._id,
            media: req.files.map(f => f.path),
            modelType: modelType,
        });

        await analysis.save();

        await this.#sendNotificationHelper(
            analysis,
            existingDoctor,
            "New Analysis Request",
            "You have a new analysis request",
            "analysisRequested"
        )

        res.json({
            success: true,
            message: "Analysis requested successfully",
            data: analysis
        });

    })

    //@desc Write doctor consultation
    //@route POST /api/v1/analysis/:id/consultation
    //@access Private
    writeDoctorConsultation = asyncHandler(async (req, res, next) => {
        const {  id } = req.params;
        const { consultation } = req.body

        if (!mongoose.Types.ObjectId.isValid(id) || !consultation) {
            return next(new ApiError("id and consultation are required", 400));
        }

        const analysis = await Analysis.findById(id);
        if (!analysis) {
            return next(new ApiError("Analysis not found", 404));
        }

        if (analysis.status !== "approved") {
            return next(new ApiError("Analysis is not approved", 400));
        }

        analysis.consultation = consultation;
        await analysis.save();

        await this.#sendNotificationHelper(
            analysis,
            analysis.patient,
            "You have a new analysis report",
            `Dr ${req.user.fullName.split(" ")[0]} Write a consultation`,
            "analysisConsultation"
        )

        res.json({
            success: true,
            message: "Analysis consultation written successfully",
            data: analysis
        });

    })

    //@desc Get doctor analysis
    //@route GET /api/v1/analysis/:id/doctor
    //@access Private
    getDoctorAnalysis = asyncHandler(async (req, res, next) => {
        const { id } = req.params;
        const apiFeatures = new ApiFeatures(Analysis.find({ doctor: id }).populate("patient", "fullName"), req.query, "analysis")
            .filter()
            .sort()
            .paginate()
            .cleanResponse();
        const analysis = await apiFeatures.query;
        res.json({
            success: true,
            totalResults: analysis.length,
            pagination: {
                page: Number(req.query.page) || 1,
                limit: Number(req.query.limit) || 20,
            },
            data: analysis
        });


    })

    //@desc Get patient analysis
    //@route GET /api/v1/analysis/:id/patient
    //@access Private
    getPatientAnalysis = asyncHandler(async (req, res, next) => {
        const { id } = req.params;
        const apiFeatures = new ApiFeatures(Analysis.find({ patient: id }).populate("doctor", "fullName"), req.query, "analysis")
            .filter()
            .sort()
            .paginate()
            .cleanResponse();

        const analysis = await apiFeatures.query;
        res.json({
            success: true,
            totalResults: analysis.length,
            pagination: {
                page: Number(req.query.page) || 1,
                limit: Number(req.query.limit) || 20,
            },
            data: analysis
        });


    })

    //@desc Analysis Reports
    //@route GET /api/v1/analysis/:id/report
    //@access Private
    generateAnalysisReport = asyncHandler(async (req, res) => {
        const { id } = req.params;

        const pdfBuffer = await generateAnalysisPDF(id);

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
            "Content-Disposition",
            "inline; filename=neuron-wave-analysis-report.pdf"
        );

        res.send(pdfBuffer);
    });



}

module.exports = new AnalysisController();