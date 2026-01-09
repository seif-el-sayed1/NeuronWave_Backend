const appRouter = require("express").Router();
const BASE_URL = "/api/v1";

const ApiError = require("../utils/ApiError");
let userAuthRoutes = require("./userAuth.routes")
let doctorAuthRoutes = require("./doctorAuth.routes")
let userRoutes = require("./user.routes")
let doctorRoutes = require("./doctor.routes")
let appointmentRoutes = require("./appointment.routes")
let patientRoutes = require("./patient.routes")
let notificationRoutes = require("./notification.routes")

appRouter.use(`${BASE_URL}/users/auth`, userAuthRoutes);
appRouter.use(`${BASE_URL}/doctors/auth`, doctorAuthRoutes);
appRouter.use(`${BASE_URL}/users`, userRoutes);
appRouter.use(`${BASE_URL}/doctors`, doctorRoutes);
appRouter.use(`${BASE_URL}/appointments`, appointmentRoutes);
appRouter.use(`${BASE_URL}/patients`, patientRoutes);
appRouter.use(`${BASE_URL}/notifications`, notificationRoutes);


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
