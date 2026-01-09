const express = require("express");
const router = express.Router();

// Auth middlewares
const { protect, allowedTo } = require("../middlewares/auth.middleware");


// Constants
const { USER, DOCTOR } = require("../utils/constants");

// Classes
const NotificationController = require("../controllers/notification.controller");

router
  .route("/me")
  .get(protect, allowedTo(USER, DOCTOR), NotificationController.getUserNotifications);
  

  router
  .route("/mark/all/seen")
  .patch(protect, allowedTo(USER, DOCTOR), NotificationController.markAllNotificationsAsSeen);

  router
  .route("/mark/:id/seen")
  .patch(
    protect,
    allowedTo(USER, DOCTOR),
    NotificationController.markNotificationAsSeen
  );


module.exports = router;
