const ApiFeatures = require('../utils/ApiFeatures');
const asyncHandler = require('express-async-handler');
const ApiError = require('../utils/ApiError');
const Doctor = require('../models/doctor.model');
const User = require('../models/user.model');
const Analysis = require('../models/analysis.model');
const Appointment = require('../models/appointment.model');
const Hospital = require('../models/hospital.model');
const { translate } = require('../utils/translate');

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
            .cleanResponse()
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

        const apiFeatures = new ApiFeatures(Doctor.find({ isActive: true, role: {$ne: "superDoctor"} }), req.query, "Doctor")
            .search()
            .filter()
            .sort()
            .cleanResponse()
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
            }).populate("patient", "fullName").populate("doctor", "fullName"),
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
            }).populate("patient", "fullName").populate("doctor", "fullName"),
            req.query,
            "Analysis"
        )
            .filter()
            .sort()
            .paginate()
            .cleanResponse();

        const reports = await analysisFeatures.query;

        const totalAnalysisReports = await Analysis.countDocuments({ 
            status: "approved",
            consultation: { $exists: true, $ne: null }
        });
        console.log("totalAnalysisReports:", totalAnalysisReports);
        const totalAppointmentsReports = await Appointment.countDocuments({ 
            status: "accepted",
            date: { $ne: null },
            time: { $ne: null }
        });
        console.log("totalAppointmentsReports:", totalAppointmentsReports);
        const totalReports = totalAnalysisReports + totalAppointmentsReports;

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
        const apiFeatures = new ApiFeatures(Appointment.find({ status: "pending" }).populate("patient", "fullName").populate("doctor", "fullName"), req.query, "Appointment")
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
        const apiFeatures = new ApiFeatures(Analysis.find({ status: "pending" }).populate("patient", "fullName").populate("doctor", "fullName"), req.query, "Analysis")
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

    //@desc add doctor
    //@route POST /api/v1/super-doctors/doctors
    //@access Private
    addDoctor = asyncHandler(async(req, res, next) => {
        const doctor = await Doctor.create({
            ...req.body
        });

        const hospitalChecks = req.body.hospitals.map(async (ele) => {
            const existHospital = await Hospital.findById(ele);
            if (!existHospital) {
                throw new ApiError(translate("Hospital not found", req.headers.lang), 404);
            }
            
            existHospital.doctors.push(doctor._id);
            await existHospital.save();
            
            return existHospital;
        });

        await Promise.all(hospitalChecks);

        res.status(201).json({
            success: true,
            message: "Doctor created successfully",
            data: doctor
        });
    });

    //@desc update doctor
    //@route PUT /api/v1/super-doctors/doctors/:id
    //@access Private
    updateDoctor = asyncHandler(async(req, res, next) => {
        const doctor = await Doctor.findByIdAndUpdate(
            req.params.id,
            {
                ...req.body
            },
            { new: true, runValidators: true }
        );
        
        if (!doctor) {
            return next(new ApiError(translate("Doctor not found", req.headers.lang), 404));
        }

        res.status(200).json({
            success: true,
            message: "Doctor updated successfully",
            data: doctor
        });
    })

    //@desc delete doctor
    //@route DELETE /api/v1/super-doctors/doctors/:id
    //@access Private
    deleteDoctor = asyncHandler(async(req, res, next) => {
        const doctor = await Doctor.findByIdAndDelete(req.params.id);

        if (!doctor) {
            return next(new ApiError(translate("Doctor not found", req.headers.lang), 404));
        }

        res.status(200).json({
            success: true,
            message: "Doctor deleted successfully",
            data: doctor
        });
    })

    //@desc update user
    //@route PATCH /api/v1/super-doctors/users/:id
    //@access Private
    updateUser = asyncHandler(async(req, res, next) => {
        const user = await User.findByIdAndUpdate(
            req.params.id,
            {
                ...req.body
            },
            { new: true, runValidators: true }
        );

        if (!user) {
            return next(new ApiError(translate("User not found", req.headers.lang), 404));
        }

        res.status(200).json({
            success: true,
            message: "User updated successfully",
            data: user
        });
    })

    //@desc delete user
    //@route DELETE /api/v1/super-doctors/users/:id
    //@access Private
    deleteUser = asyncHandler(async(req, res, next) => {
        const user = await User.findByIdAndDelete(req.params.id);

        if (!user) {
            return next(new ApiError(translate("User not found", req.headers.lang), 404));
        }
        res.status(200).json({
            success: true,
            message: "User deleted successfully",
            data: user
        });
    })

    //@desc block doctor
    //@route PATCH /api/v1/super-doctors/doctors/:id/block
    //@access Private
    blockDoctor = asyncHandler(async(req, res, next) => {
        const doctor = await Doctor.findByIdAndUpdate(
            req.params.id,
            { isBlocked: true },
            { new: true, runValidators: true }
        );

        if (!doctor) {
            return next(new ApiError(translate("Doctor not found", req.headers.lang), 404));
        }

        res.status(200).json({
            success: true,
            message: "Doctor blocked successfully",
            data: doctor
        });
    })

    //@desc unblock doctor
    //@route PATCH /api/v1/super-doctors/doctors/:id/unblock
    //@access Private
    unblockDoctor = asyncHandler(async(req, res, next) => {
        const doctor = await Doctor.findByIdAndUpdate(
            req.params.id,
            { isBlocked: false },
            { new: true, runValidators: true }
        );

        if (!doctor) {
            return next(new ApiError(translate("Doctor not found", req.headers.lang), 404));
        }

        res.status(200).json({
            success: true,
            message: "Doctor unblocked successfully",
            data: doctor
        });
    })


    //@desc block user
    //@route PATCH /api/v1/super-doctors/users/:id/block
    //@access Private
    blockUser = asyncHandler(async(req, res, next) => {
        const user = await User.findByIdAndUpdate(
            req.params.id,
            { isBlocked: true },
            { new: true, runValidators: true }
        );

        if (!user) {
            return next(new ApiError(translate("User not found", req.headers.lang), 404));
        }

        res.status(200).json({
            success: true,
            message: "User blocked successfully",
            data: user
        });
    })

    //@desc unblock user
    //@route PATCH /api/v1/super-doctors/users/:id/unblock
    //@access Private
    unblockUser = asyncHandler(async(req, res, next) => {
        const user = await User.findByIdAndUpdate(
            req.params.id,
            { isBlocked: false },
            { new: true, runValidators: true }
        );

        if (!user) {
            return next(new ApiError(translate("User not found", req.headers.lang), 404));
        }

        res.status(200).json({
            success: true,
            message: "User unblocked successfully",
            data: user
        });
    })

}
module.exports = new SuperDoctorController();