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

  // Main endpoint to get user's chat list
  // Returns chats + last N messages + unread count + other participant info
  // Very heavy aggregation — handles users & doctors in same pipeline
  getMyChats = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const loggedUserBlockedUsers = req.user.blockedUsers || [];

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const search = req.query.search || "";
    const noOfMessages = parseInt(req.query.noOfMessages) || 10;

    // 1. Only chats where current user is participant
    const matchParticipantStage = {
      $match: { "participants.participantId": userId }
    };

    // 2. Get user documents for participants
    const lookupUsersStage = {
      $lookup: {
        from: "users",
        localField: "participants.participantId",
        foreignField: "_id",
        as: "userParticipants"
      }
    };

    // 3. Get doctor documents for participants
    const lookupDoctorsStage = {
      $lookup: {
        from: "doctors",
        localField: "participants.participantId",
        foreignField: "_id",
        as: "doctorParticipants"
      }
    };

    // 4. Re-build participants array with full populated objects (user or doctor)
    const mergeParticipantsStage = {
      $addFields: {
        participants: {
          $map: {
            input: "$participants",
            as: "p",
            in: {
              participantType: "$$p.participantType",
              participantId: {
                $cond: {
                  if: { $eq: ["$$p.participantType", "Doctor"] },
                  then: {
                    $arrayElemAt: [
                      { $filter: { input: "$doctorParticipants", as: "d", cond: { $eq: ["$$d._id", "$$p.participantId"] } } },
                      0
                    ]
                  },
                  else: {
                    $arrayElemAt: [
                      { $filter: { input: "$userParticipants", as: "u", cond: { $eq: ["$$u._id", "$$p.participantId"] } } },
                      0
                    ]
                  }
                }
              }
            }
          }
        }
      }
    };

    // 5. Add "to" field = the other person in chat (not me)
    const addToStage = {
      $addFields: {
        to: {
          $arrayElemAt: [
            { $filter: { input: "$participants", as: "p", cond: { $ne: ["$$p.participantId._id", userId] } } },
            0
          ]
        },
        isClearedByMe: { $eq: ["$clearedBy", userId] }
      }
    };

    // 6. Optional: filter by name of the other person
    const searchStage = search
      ? [{ $match: { "to.participantId.fullName": { $regex: search, $options: "i" } } }]
      : [];

    // 7. Get last N messages, respecting chat clear date if exists
    const lookupMessagesStage = {
      $lookup: {
        from: "messages",
        let: { chatId: "$_id", clearedAt: "$clearedAt", isClearedByMe: "$isClearedByMe" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$chat", "$$chatId"] },
                  {
                    $or: [
                      { $eq: ["$$isClearedByMe", false] },
                      { $gt: ["$createdAt", "$$clearedAt"] }
                    ]
                  }
                ]
              }
            }
          },
          { $sort: { createdAt: -1 } },
          { $limit: noOfMessages }
        ],
        as: "messages"
      }
    };

    const unwindStage = { $unwind: { path: "$messages", preserveNullAndEmptyArrays: true } };

    const groupStage = {
      $group: {
        _id: "$_id",
        messages: { $push: "$messages" },
        to: { $first: "$to" },
        lastMessage: {
          $first: {
            $cond: {
              if: { $isArray: "$messages" },
              then: { $arrayElemAt: ["$messages", 0] },
              else: "$messages"
            }
          }
        }
      }
    };

    // Remove chats with zero messages after filtering
    const removeEmptyChatsStage = { $match: { messages: { $ne: [] } } };

    // Calculate unread count + last message time
    const addComputedFieldsStage = {
      $addFields: {
        unreadMessagesCount: {
          $sum: {
            $map: {
              input: { $ifNull: ["$messages", []] },
              as: "msg",
              in: {
                $cond: [
                  { $and: [{ $eq: ["$$msg.isRead", false] }, { $ne: ["$$msg.sender.senderId", userId] }] },
                  1,
                  0
                ]
              }
            }
          }
        },
        lastMessageCreatedAt: { $ifNull: ["$lastMessage.createdAt", null] }
      }
    };

    // Final shape of each chat document
    const projectStage = {
      $project: {
        to: {
          _id: "$to.participantId._id",
          profilePicture: "$to.participantId.profilePicture",
          fullName: "$to.participantId.fullName",
          isActive: "$to.participantId.isActive",
          type: "$to.participantType"
        },
        messages: {
          $map: {
            input: { $ifNull: ["$messages", []] },
            as: "msg",
            in: {
              _id: "$$msg._id",
              content: "$$msg.content",
              type: "$$msg.type",
              isDelivered: "$$msg.isDelivered",
              isRead: "$$msg.isRead",
              createdAt: "$$msg.createdAt",
              isMyMsg: { $eq: ["$$msg.sender.senderId", userId] }
            }
          }
        },
        unreadMessagesCount: 1,
        lastMessageCreatedAt: 1
      }
    };

    const sortStage = { $sort: { lastMessageCreatedAt: -1 } };

    const basePipeline = [
      matchParticipantStage,
      lookupUsersStage,
      lookupDoctorsStage,
      mergeParticipantsStage,
      addToStage,
      ...searchStage,
      lookupMessagesStage,
      unwindStage,
      groupStage,
      removeEmptyChatsStage,
      addComputedFieldsStage,
      projectStage,
      sortStage
    ];

    const pipeline = [...basePipeline, { $skip: skip }, { $limit: limit }];
    const countPipeline = [...basePipeline, { $count: "totalChats" }];

    const [chats, totalCountResult] = await Promise.all([
      Chat.aggregate(pipeline),
      Chat.aggregate(countPipeline)
    ]);

    // When user opens chat list → mark messages as delivered
    await Message.updateMany(
      {
        "sender.senderId": { $ne: userId },
        chat: { $in: chats.map(c => c._id) }
      },
      { isDelivered: true }
    );

    const totalChats = totalCountResult[0]?.totalChats || 0;
    const totalPages = Math.ceil(totalChats / limit);

    res.status(200).json({
      success: true,
      pagination: { totalResults: totalChats, totalPages, page, limit },
      data: chats
    });
  });


}

module.exports = new ChatController();