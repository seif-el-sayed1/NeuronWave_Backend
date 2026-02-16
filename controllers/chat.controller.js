const asyncHandler = require("express-async-handler");
const Message = require("../models/message.model");
const Chat = require("../models/chat.model");
const User = require("../models/user.model");
const Doctor = require("../models/doctor.model");
const ApiFeatures = require("../utils/ApiFeatures");
const ApiError = require("../utils/ApiError");
const { default: mongoose } = require("mongoose");
const { sendMediaNotification } = require("./../startup/socket");
const { translate } = require("../utils/translation");

class ChatController {

  // Returns list of all users (except current logged-in user) to start new chat
  // Supports search, filter, pagination via ApiFeatures
  getAllUsers = asyncHandler(async (req, res) => {
    const apiFeatures = new ApiFeatures(
      User.find({ _id: { $ne: req.user._id } }).select(
        "_id fullName profilePicture isActive email"
      ),
      req.query,
      "User"
    )
      .search()
      .filter()
      .paginate()
      .cleanResponse();

    const users = await apiFeatures.query;

    res.json({
      success: true,
      totalResults: users.length,
      pagination: {
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 20
      },
      data: users
    });
  });

  // Similar to getAllUsers but for doctors
  // Excludes current user (if doctor is logged in)
  getAllDoctors = asyncHandler(async (req, res) => {
    const apiFeatures = new ApiFeatures(
      Doctor.find({ _id: { $ne: req.user._id } }).select("_id fullName email profilePicture isActive"),
      req.query,
      "Doctor"
    )
      .search()
      .filter()
      .paginate()
      .cleanResponse();

    const doctors = await apiFeatures.query;

    res.json({
      success: true,
      totalResults: doctors.length,
      pagination: {
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 20
      },
      data: doctors
    });
  });

  
}

module.exports = new ChatController();