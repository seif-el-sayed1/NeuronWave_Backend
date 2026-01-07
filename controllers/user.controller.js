const asyncHandler = require("express-async-handler");
const ApiError = require("../utils/ApiError");
const User = require("../models/user.model");

class UserController {
    //@desc Get My Profile
    //@route GET /api/v1/users/me
    //@access Private
    getMyProfile = asyncHandler(async (req, res, next) => {
        const user = await User.findById(req.user._id)
                .select("fullName phone email  createdAt role dateOfBirth emergencyContact medicalId");

        if (!user) return next(new ApiError("User not found", 404));

        res.status(200).json({
            success: true,
            user,
        });
    });
    
    //@desc Update me
    //@route PUT /api/v1/users/:id
    //@access Private
    updateMe = asyncHandler(async (req, res, next) => {
        const oldUser = await User.findById(req.user._id);
        if (!oldUser) return next(new ApiError("User not found", 404));
        
        const user = await User.findByIdAndUpdate(req.user._id, req.body, {
            new: true,
            runValidators: true,
        }).select("fullName phone email  createdAt role dateOfBirth emergencyContact medicalId");
        if (!user) return next(new ApiError("User not found", 404));

        res.status(200).json({
            success: true,
            user,
        });
    });

    
}

module.exports = new UserController();