const ApiFeatures = require('../utils/apiFeatures');
const asyncHandler = require('express-async-handler');
const ApiError = require('../utils/apiError');
const Doctor = require('../models/doctor.model');
const User = require('../models/user.model');
const Analysis = require('../models/analysis.model');
const Appointment = require('../models/appointment.model');

class SuperDoctorController {
    // @desc Get all Users
    // @route GET /api/v1/super-doctors/users
    // @access Private
    getAllUsers = asyncHandler(async(req, res, next) => {
        const totalUsers = await User.countDocuments({isActive: true});
        
        const apiFeatures = new ApiFeatures(User.find({isActive: true}), req.query, "User")
            .search()
            .filter()
            .sort()
            .limitFields()
            .paginate();
        
        const users = await apiFeatures.query;
        
        res.status(200).json({
            success: true,
            totalUsers: totalUsers, 
            totalResults: users.length, 
            pagination: {
                page: Number(req.query.page) || 1,
                limit: Number(req.query.limit) || 10
            },
            data: users
        });
    });

    //@desc get all doctors
    //@route GET /api/v1/super-doctors/doctors
    //@access Private
    getAllDoctors = asyncHandler(async(req, res, next) => {
        const totalDoctors = await Doctor.countDocuments({ isActive: true });

        const apiFeatures = new ApiFeatures(Doctor.find({ isActive: true }), req.query, "Doctor")
            .search()
            .filter()
            .sort()
            .limitFields()
            .paginate();
        
        const doctors = await apiFeatures.query;
        
        res.status(200).json({
            success: true,
            totalDoctors: totalDoctors,
            totalResults: doctors.length,
            pagination: {
                page: Number(req.query.page) || 1,
                limit: Number(req.query.limit) || 10
            },
            data: doctors
        });
    });

    //@desc get all Reports
    //@routes GET /api/v1/super-doctors/reports
    //@access Private
    getAllReports = asyncHandler(async(req, res, next) => {
        const appointmentsFeatures = new ApiFeatures(
            Appointment.find({ 
                status: "accepted",
                date: { $ne: null },
                time: { $ne: null }
            }).populate("doctor", "fullName").populate("patient", "fullName"),
            req.query,
            "Appointment"
        )
            .filter()
            .sort()
            .paginate()
            .cleanResponse();

        const appointments = await appointmentsFeatures.query;

        const analysisFeatures = new ApiFeatures(
            Analysis.find({ 
                status: "approved",
                consultation: { $exists: true, $ne: null }
            }).populate("doctor", "fullName").populate("patient", "fullName"),
            req.query,
            "Analysis"
        )
            .filter()
            .sort()
            .paginate()
            .cleanResponse();

        const reports = await analysisFeatures.query;

        const totalReports = await Analysis.countDocuments({ 
            patient: req.user._id,
            status: "approved",
            consultation: { $exists: true, $ne: null }
        });

        let combinedResults = [
            ...appointments.map(item => ({ ...item.toObject(), type: 'appointment' })),
            ...reports.map(item => ({ ...item.toObject(), type: 'analysis' }))
        ];

        if (req.query.type) {
            combinedResults = combinedResults.filter(item => item.type === req.query.type);
        }

        combinedResults.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        res.json({
            success: true,
            totalResults: combinedResults.length,
            totalReports: totalReports,
            pagination: {
                page: Number(req.query.page) || 1,
                limit: Number(req.query.limit) || 20,
            },
            data: combinedResults
        });
    })

    //@desc get all appointment
    //@route GET /api/v1/super-doctors/appointments
    //@access Private
    getAllAppointments = asyncHandler(async(req, res, next) => {
        const totalAppointments = await Appointment.countDocuments({ status: "pending" });
        const apiFeatures = new ApiFeatures(Appointment.find({ status: "pending" }), req.query, "Appointment")
            .filter()
            .sort()
            .paginate()
            .cleanResponse();

        const appointments = await apiFeatures.query;

        res.status(200).json({
            success: true,
            totalAppointments: totalAppointments,
            totalResults: appointments.length,
            pagination: {
                page: Number(req.query.page) || 1,
                limit: Number(req.query.limit) || 10
            },
            data: appointments
        });
    })

    //@desc get all analysis
    //@route GET /api/v1/super-doctors/analysis
    //@access Private
    getAllAnalysis = asyncHandler(async(req, res, next) => {
        const totalAnalysis = await Analysis.countDocuments({ status: "pending" });
        const apiFeatures = new ApiFeatures(Analysis.find({ status: "pending" }), req.query, "Analysis")
            .filter()
            .sort()
            .paginate()
            .cleanResponse();

        const analysis = await apiFeatures.query;

        res.status(200).json({
            success: true,
            totalAnalysis: totalAnalysis,
            totalResults: analysis.length,
            pagination: {
                page: Number(req.query.page) || 1,
                limit: Number(req.query.limit) || 10
            },
            data: analysis
        });
    })
}