const asyncHandler = require("express-async-handler");
const ApiFeatures = require("../utils/ApiFeatures");
const ApiError = require("../utils/ApiError");
const Doctor = require("../models/doctor.model");

class DoctorController {
    
    //@desc Get all Doctors
    //@route GET /api/v1/doctors
    //@access Public
    getAllDoctors = asyncHandler(async (req, res, next) => {
        const apiFeatures = new ApiFeatures(Doctor.find({isActive: true}) .select(
            "fullName phone email createdAt role medicalSpecialty medicalLicenseNumber hospital"
        ), req.query, 'Doctor')
            .search()
            .filter()
            .paginate()
            .cleanResponse();

        const doctors = await apiFeatures.query;

        res.status(200).json({
            success: true,
            totalResults: doctors.length,
            pagination: {
                page: Number(req.query.page) || 1,
                limit: Number(req.query.limit) || 20,
            },
            data: doctors
        });
    });

    
}

module.exports = new DoctorController();