const express = require("express");

const { USER, DOCTOR, SUPER_DOCTOR } = require("../utils/constants");

// Middlewares
const { protect, allowedTo } = require("../middlewares/auth.middleware");

// Classes
const UserController = require("../controllers/user.controller");
const UserValidator = require("../validators/user.validator");
const GlobalValidator = require("../validators/global.validator");
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

    router
        .route("/lang")
        .patch(
            protect,
            allowedTo(USER, DOCTOR, SUPER_DOCTOR),
            GlobalValidator.updateUserLangValidator,
            UserController.updateUserLang
        );

module.exports = router;