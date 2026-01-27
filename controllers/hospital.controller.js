const asyncHandler = require("express-async-handler");
const ApiError = require("../utils/ApiError");
const ApiFeatures = require("../utils/ApiFeatures");
const Hospital = require("../models/hospital.model");
const Country = require("../models/country.model");
const City = require("../models/city.model");
const { translate } = require("../utils/translation");


class HospitalController {
    //@desc Create Hospital
    //@route POST /api/v1/hospitals
    //@access Private
    createHospital = asyncHandler(async (req, res, next) => {
        const hospital = await Hospital.create(req.body);
        res.status(201).json({
            success: true,
            message: "Hospital created successfully",
            data: hospital 
        });
    });

    //@desc Get Hospitals
    //@route GET /api/v1/hospitals
    //@access Public
    getAllHospitals = asyncHandler(async (req, res, next) => {
        const totalHospitals = await Hospital.countDocuments();
        const apiFeatures = new ApiFeatures(Hospital.find(), req.query, "Hospital")
            .search()   
            .filter()
            .sort()
            .cleanResponse()
            .paginate();

        const hospitals = await apiFeatures.query;
        res.status(200).json({
            success: true,
            totalHospitals,
            totalResults: hospitals.length,
            pagination: {
                page: Number(req.query.page),
                limit: Number(req.query.limit)
            },
            data: hospitals
        });
    })

    //@desc update hospital
    //@route PATCH /api/v1/hospitals/:id
    // @access Private
    updateHospital = asyncHandler(async (req, res, next) => {
        const hospital = await Hospital.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!hospital) {
            return next(new ApiError(translate("Hospital not found", req.headers.lang), 404));
        }
        res.status(200).json({
            success: true,
            message: "Hospital updated successfully",
            data: hospital
        });
    })

    //@desc delete hospital
    //@route DELETE /api/v1/hospitals/:id
    // @access Private
    deleteHospital = asyncHandler(async (req, res, next) => {
        const hospital = await Hospital.findByIdAndDelete(req.params.id);
        if (!hospital) {
            return next(new ApiError(translate("Hospital not found", req.headers.lang), 404));
        }
        res.status(200).json({
            success: true,
            message: "Hospital deleted successfully",
            data: hospital
        });
    })

}
module.exports = new HospitalController();