const asyncHandler = require("express-async-handler");
const ApiError = require("../utils/ApiError");
const ApiFeatures = require("../utils/ApiFeatures");
const  User = require("../models/user.model");
const { translate } = require("../utils/translation");
class PatientsController {

    //@desc add Patients
    //@route POST /patients
    //@access Public
    addPatient =asyncHandler(async (req, res, next) => {
        const patient = await User.create(req.body);

        res.status(201).json({
            success: true,
            message: "Patient created successfully",
            data: patient
        })
    })

    //@desc get Doctor Patients
    //@route GET /patients
    //@access Public
    getAllPatients = asyncHandler(async (req, res, next) => {
        const baseQuery = User.find({ isActive: true })
            .select(
                "fullName phone email lastVisit createdAt notes address age gender emergencyContact medicalHistory diagnosis registerType doctor"
            ).populate("doctor", "fullName")
            .sort({ lastVisit: -1, createdAt: -1 }); 

        const apiFeatures = new ApiFeatures(baseQuery, req.query, 'User')
            .search()
            .filter()
            .cleanResponse()
            .paginate();

        const patients = await apiFeatures.query;

        res.status(200).json({
            success: true,
            totalResults: patients.length,
            pagination: {
                page: Number(req.query.page) || 1,
                limit: Number(req.query.limit) || 20,
            },
            data: patients
        });
    });

    //@desc Add Patient Note
    //@route PATCH /patients/:id/note
    //@access Public
    addPatientNote = asyncHandler(async (req, res, next) => {
        const lang = req.headers.lang || "en";
        if (!req.body.notes) {
            return next(new ApiError(translate("Notes field is required", lang), 400));
        }

        const patient = await User.findById(req.params.id).select(
            "fullName phone email createdAt role lastVisit notes address age gender emergencyContact medicalHistory diagnosis registerType address"
        );
        if (!patient) {
            return next(new ApiError(translate("Patient not found", lang), 404));
        }

        patient.notes = req.body.notes;
        await patient.save();

        res.status(200).json({
            success: true,
            message: "Patient note added successfully",
            data: patient
        });
    });

    //@desc get one Patient
    //@route GET /patients/:id
    //@access Public
    getOnePatient = asyncHandler(async (req, res, next) => {
        const lang = req.headers.lang || "en";
        const patient = await User.findById(req.params.id).select(
            "fullName phone email createdAt role notes address lastVisit age gender emergencyContact medicalHistory diagnosis registerType address"
        );
        if (!patient) {
            return next(new ApiError(translate("Patient not found", lang), 404));
        }
        res.status(200).json({
            success: true,
            data: patient
        });
    });

    //@desc Update Patient
    //@route PATCH /patients/:id
    //@access Public
    updatePatient = asyncHandler(async (req, res, next) => {
        const lang = req.headers.lang || "en";
        const patient = await User.findById(req.params.id);
        if (!patient) {
            return next(new ApiError(translate("Patient not found", lang), 404));
        }

        if (patient.registerType === "byApp") {
            return next(new ApiError(translate("You are not allowed to update this patient", lang), 403));
        }

        Object.assign(patient, req.body);
        await patient.save();

        res.status(200).json({
            success: true,
            message: "Patient updated successfully",
            data: patient
        });
    });

    //@desc Delete Patient
    //@route DELETE /patients/:id
    //@access Public
    deletePatient = asyncHandler(async (req, res, next) => {

        const patient = await User.findById(req.params.id);
        if (!patient) {
            return next(new ApiError(translate("Patient not found", lang), 404));
        }

        if (patient.registerType === "byApp") {
            return next(new ApiError(translate("You are not allowed to delete this patient", lang), 403));
        }

        await patient.deleteOne();

        res.status(200).json({
            success: true,
            message: "Patient deleted successfully",
            data: patient
        });
    });


}

module.exports = new PatientsController();