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

    


}

module.exports = new PatientsController();