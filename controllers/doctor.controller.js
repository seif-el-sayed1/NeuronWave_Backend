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
            "fullName phone email createdAt role medicalSpecialty"
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

    //@desc Get My Profile
    //@route GET /api/v1/users/me
    //@access Private
    getMyProfile = asyncHandler(async (req, res, next) => {
        const user = await Doctor.findById(req.user._id)
                .select("fullName phone email profilePicture createdAt role medicalSpecialty")

        if (!user) return next(new ApiError("Doctor not found", 404));

        res.status(200).json({
            success: true,
            user,
        });
    });
    
    //@desc Update me
    //@route PUT /api/v1/users/:id
    //@access Private
    updateMe = asyncHandler(async (req, res, next) => {
        const oldUser = await Doctor.findById(req.user._id);
        if (!oldUser) return next(new ApiError("Doctor not found", 404));
        
        const user = await Doctor.findByIdAndUpdate(req.user._id, req.body, {
            new: true,
            runValidators: true,
        }).select("fullName phone email profilePicture createdAt role medicalSpecialty medicalLicenseNumber")

        if (!user) return next(new ApiError("Doctor not found", 404));

        res.status(200).json({
            success: true,
            user,
        });
    });

    //@desc Deactivate me
    //@route DELETE /api/v1/users/me
    //@access Private
    deactivateMe = asyncHandler(async (req, res, next) => {
        // Delete Doctor After 15 Days
        const oldUser = await Doctor.findById(req.user._id);
        if (!oldUser) return next(new ApiError("Doctor not found", 404));
        if (!oldUser.isActive) return next(new ApiError("Doctor is already deactivated", 400));

        const user = await Doctor.findByIdAndUpdate(
            req.user._id,
            {
                isActive: false,
                deactivatedAt: Date.now(),
                $unset: {
                    token: 1,
                    notificationToken: 1
                }
            },
        );
        res.status(200).json({
            status: 'success',
            message: "Your account has been Deleted successfully",
            user,
        });
    });
}

module.exports = new DoctorController();