const express = require("express");

const { USER } = require("../utils/constants");

// Middlewares
const { protect, allowedTo } = require("../middlewares/auth.middleware");

// Classes
const UserController = require("../controllers/user.controller");
const UserValidator = require("../validators/user.validator");
// Router
const router = express.Router();

// User Routes
router
    .route("/me")
    .get(
        protect,
        allowedTo(USER),
        UserController.getMyProfile
    ).patch(
        protect,
        allowedTo(USER),
        UserValidator.validateUpdateUser,
        UserController.updateMe
    ).delete(
        protect,
        allowedTo(USER),
        UserController.deactivateMe
    )

module.exports = router;