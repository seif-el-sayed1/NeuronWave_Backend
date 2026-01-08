const asyncHandler = require("express-async-handler");
const ApiError = require("../utils/ApiError");
const ApiFeatures = require("../utils/ApiFeatures");
const Doctor = require("../models/doctor.model")
const Patient = require("../models/patient.model");
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

    


}

module.exports = new PatientsController();