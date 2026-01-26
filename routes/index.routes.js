const appRouter = require("express").Router();
const BASE_URL = "/api/v1";
const ApiError = require("../utils/ApiError");
let userAuthRoutes = require("./userAuth.routes")
let doctorAuthRoutes = require("./doctorAuth.routes")
// let oAuthRoutes = require("./oAuth.routes")
let userRoutes = require("./user.routes")
let doctorRoutes = require("./doctor.routes")
let appointmentRoutes = require("./appointment.routes")
let patientRoutes = require("./patient.routes")
let notificationRoutes = require("./notification.routes")
let analysisRoutes = require("./analysis.routes")
let cityRoutes = require("./city.routes")
let countryRoutes = require("./country.routes")
let hospitals = require("./hospital.routes")
let superDoctorRoutes = require("./superDoctor.routes")
let paymentRoutes = require("./payment.routes")

appRouter.use(`${BASE_URL}/users/auth`, userAuthRoutes);
appRouter.use(`${BASE_URL}/doctors/auth`, doctorAuthRoutes);
// appRouter.use(`${BASE_URL}/oauth`, oAuthRoutes);
appRouter.use(`${BASE_URL}/users`, userRoutes);
appRouter.use(`${BASE_URL}/doctors`, doctorRoutes);
appRouter.use(`${BASE_URL}/appointments`, appointmentRoutes);
appRouter.use(`${BASE_URL}/patients`, patientRoutes);
appRouter.use(`${BASE_URL}/notifications`, notificationRoutes);
appRouter.use(`${BASE_URL}/analysis`, analysisRoutes);
appRouter.use(`${BASE_URL}/cities`, cityRoutes);
appRouter.use(`${BASE_URL}/countries`, countryRoutes);
appRouter.use(`${BASE_URL}/hospitals`, hospitals);
appRouter.use(`${BASE_URL}/super-doctor`, superDoctorRoutes);
appRouter.use(`${BASE_URL}/payments`, paymentRoutes);


appRouter.get("/", (req, res) => {
  res.status(200).json({
    status: true,
    message: "You're Server is up and running!"
  });
});


// Not Found Route
appRouter.use((req, res, next) => {
  next(new ApiError(`This Route (${req.originalUrl}) is not found`, 404));
});


module.exports = appRouter;
