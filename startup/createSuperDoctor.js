require("colors");
const asyncHandler = require("express-async-handler");
const Doctor = require("../models/doctor.model");
const { SUPER_DOCTOR } = require("../utils/constants");

const createSuperDoctor = asyncHandler(async () => {
  const doctor = await Doctor.findOne({ isSuperDoctor: true  });
  if (!doctor) {
    const doctor = new Doctor({
      fullName: "Super Doctor",
      role: SUPER_DOCTOR,
      email: process.env.SUPER_DOCTOR_EMAIL,
      password: process.env.SUPER_DOCTOR_PASSWORD,
      isVerified: true,
      isSuperDoctor: true,
    });
    console.log("=== Super Doctor created successfully ===".green);
    await doctor.save();
  }
});

module.exports = createSuperDoctor;