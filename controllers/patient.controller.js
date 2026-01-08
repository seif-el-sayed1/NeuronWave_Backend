const asyncHandler = require("express-async-handler");
const ApiError = require("../utils/ApiError");
const ApiFeatures = require("../utils/ApiFeatures");
const  User = require("../models/user.model");
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
        const apiFeatures = new ApiFeatures(
            User.find({ 
                isActive: true,
            })
            .select(
                "fullName phone email lastVisit createdAt notes address dateOfBirth age gender emergencyContact medicalHistory diagnosis registerType doctor"
            )
            .sort({ lastVisit: -1, createdAt: -1 }),
            req.query,
            'User'
        )
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

        if (!req.body.notes) {
            return next(new ApiError("Notes field is required", 400));
        }

        const patient = await User.findById(req.params.id).select(
            "fullName phone email createdAt role lastVisit notes address dateOfBirth age gender emergencyContact medicalHistory diagnosis registerType address"
        );
        if (!patient) {
            return next(new ApiError("Patient not found", 404));
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
        const patient = await User.findById(req.params.id).select(
            "fullName phone email createdAt role notes address lastVisit dateOfBirth age gender emergencyContact medicalHistory diagnosis registerType address"
        );
        if (!patient) {
            return next(new ApiError("Patient not found", 404));
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

        const patient = await User.findById(req.params.id);
        if (!patient) {
            return next(new ApiError("Patient not found", 404));
        }

        if (patient.registerType === "byApp") {
            return next(new ApiError("You are not allowed to update this patient", 403));
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
            return next(new ApiError("Patient not found", 404));
        }

        if (patient.registerType === "byApp") {
            return next(new ApiError("You are not allowed to update this patient", 403));
        }

        if (patient.doctor.toString() !== req.user._id.toString()) {
            return next(new ApiError("You are not allowed to delete this patient", 403));
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