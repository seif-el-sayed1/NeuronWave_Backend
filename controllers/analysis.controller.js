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


}

module.exports = new AnalysisController();