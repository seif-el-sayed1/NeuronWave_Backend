const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");
const path = require("path");
const ApiFeatures = require("../utils/ApiFeatures");
const ApiError = require("../utils/ApiError");
const Analysis = require("../models/analysis.model");
const Doctor = require("../models/doctor.model");
const User = require("../models/user.model");
const runPythonAnalysis  = require("../utils/runPythonAnalysis");

class AnalysisController {
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

                // TODO: Send notification to the patient

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

            // TODO: Send notification to the patient

            res.json({
                success: true,
                message: "Analysis rejected",
                data: analysis
            });
        }
    });

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

        // TODO : send notification to doctor

        res.json({
            success: true,
            message: "Analysis requested successfully",
            data: analysis
        });

    })

    

}

module.exports = new AnalysisController();