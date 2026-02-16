const express = require("express");

// Auth middlewares
const { protect, allowedTo } = require("../middlewares/auth.middleware");

// Constants
const { USER, DOCTOR } = require("../utils/constants");

// Classes
const ChatController = require("../controllers/chat.controller");

const upload = require("../middlewares/upload.middleware");

// Router
const router = express.Router();  

// Routes
router.route("/").get(protect, allowedTo(USER, DOCTOR), ChatController.getMyChats);
router.route("/users").get(protect, allowedTo(USER, DOCTOR), ChatController.getAllUsers);
router.route("/doctors").get(protect, allowedTo(USER, DOCTOR), ChatController.getAllDoctors);

router.route("/:id").get(protect, allowedTo(USER, DOCTOR), ChatController.getOneChat);

router.route("/:id/messages").get(protect, allowedTo(USER, DOCTOR), ChatController.getChatMessages);

router
  .route("/")
  .post(
    protect,
    allowedTo(USER, DOCTOR),
    upload.uploadMedia,
    ChatController.sendMediaMessage
  );

router.route("/clear/:id").patch(protect, allowedTo(USER, DOCTOR), ChatController.clearChat);

module.exports = router;