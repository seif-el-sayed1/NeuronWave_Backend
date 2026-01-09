const asyncHandler = require("express-async-handler");

// Models
const Notification = require("../models/notification.model");

// Utils
const ApiError = require("../utils/ApiError");
const ApiFeatures = require("../utils/ApiFeatures");

class NotificationController {

  /**
   * @desc    Get user notifications
   * @route   GET /notifications/user/myNotifications
   * @access  Private
   */
  getUserNotifications = asyncHandler(async (req, res, next) => {
    const now = new Date();
    const { search } = req.query;

    const baseQuery = {
        $or: [
            {
                global: true,
                createdAt: { $gte: req.user.createdAt },
                $or: [{ scheduleTime: { $lte: now } }, { scheduleTime: null }]
            },
            {
                user: req.user._id,
                createdAt: { $gte: req.user.createdAt },
                $or: [{ scheduleTime: { $lte: now } }, { scheduleTime: null }]
            }
        ]
    };

    if (search) {
        baseQuery.$and = [
            {
                $or: [
                    { title: { $regex: search, $options: "i" } },
                    { body: { $regex: search, $options: "i" } }
                ]
            }
        ];
    }

    let mongoQuery = Notification.find(baseQuery)
        .setOptions({ currentUser: req.user })
        .collation({ locale: "en", strength: 2 });

    const apiFeatures = new ApiFeatures(mongoQuery, req.query, "Notification")
        .filter()
        .sort()
        .paginate()
        .cleanResponse();

    const notifications = await apiFeatures.query;

    res.status(200).json({
        success: true,
        totalResults: notifications.length,
        pagination: {
            page: Number(req.query.page) || 1,
            limit: Number(req.query.limit) || 20,
        },
        data: notifications
    });
});


}

module.exports = new NotificationController();
