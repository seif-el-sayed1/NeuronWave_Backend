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

  // Get one specific chat + recent messages
  // Used when opening a chat screen
  getOneChat = asyncHandler(async (req, res) => {
    const noOfMessages = parseInt(req.query.noOfMessages) || 10;
    const userId = req.user._id;

    const chat = await Chat.findById(req.params.id).populate(
      "participants.participantId",
      "_id fullName profilePicture blockedUsers"
    );

    if (!chat) return res.status(404).json({ success: false, message: "Chat not found" });

    if (!chat.hasParticipant(userId)) {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    const otherParticipant = chat.getOtherParticipant(userId);
    const otherUser = otherParticipant.participantId;

    // Check block status both ways
    const blockedByMe = req.user.blockedUsers?.includes(otherUser._id) || false;
    const blockedByOther = otherUser.blockedUsers?.includes(userId) || false;

    let data = {
      _id: chat._id,
      to: {
        _id: otherUser._id,
        profilePicture: otherUser.profilePicture,
        fullName: otherUser.fullName,
        type: otherParticipant.participantType
      },
      blocked: blockedByMe || blockedByOther,
      blockedByMe,
      blockedByOther,
      messages: []
    };

    const query = { chat: req.params.id };
    // Respect clear history if user cleared this chat
    if (chat.clearedBy?.toString() === userId.toString()) {
      query.createdAt = { $gt: chat.clearedAt };
    }

    const messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(noOfMessages);

    data.messages = messages.map(msg => ({
      _id: msg._id,
      content: msg.content,
      type: msg.type,
      isMyMsg: msg.sender.senderId.toString() === userId.toString(),
      isDelivered: msg.isDelivered,
      isRead: msg.isRead,
      createdAt: msg.createdAt
    }));

    res.status(200).json({ success: true, data });
  });

  // Get paginated messages from a specific chat
  // Marks messages as read/delivered when viewed
  getChatMessages = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { _id: userId } = req.user;
    const lang = req.headers.lang || "en";

    const chat = await Chat.findById(id);
    if (!chat) {
      return res.status(404).json({ success: false, message: translate("Chat Not Found!", lang) });
    }

    if (!chat.hasParticipant(userId)) {
      return res.status(403).json({
        success: false,
        message: translate("You are not a participant in this chat", lang)
      });
    }

    const query = { chat: id };
    if (chat.clearedBy?.toString() === userId.toString()) {
      query.createdAt = { $gt: chat.clearedAt };
    }

    const apiFeatures = new ApiFeatures(
      Message.find(query)
        .select("_id sender content type isDelivered isRead createdAt updatedAt")
        .sort({ createdAt: -1 }),
      req.query,
      "Message"
    )
      .filter()
      .search();

    await apiFeatures.calculatePagination();
    apiFeatures.paginate().cleanResponse();

    const messages = await apiFeatures.query;

    // Hide sensitive sender info & adjust delivery/read status for privacy
    const transformedMessages = messages.map(message => ({
      ...message._doc,
      sender: undefined,
      isDelivered: message.sender.senderId.toString() === userId.toString() ? message.isDelivered : true,
      isRead: message.sender.senderId.toString() === userId.toString() ? message.isRead : true,
      isMyMsg: message.sender.senderId.toString() === userId.toString()
    }));

    // Mark all incoming messages as read & delivered when user opens chat
    await Message.updateMany(
      { "sender.senderId": { $ne: userId }, chat: id },
      { isDelivered: true, isRead: true }
    );

    res.status(200).json({
      success: true,
      totalResults: transformedMessages.length,
      pagination: apiFeatures.paginationResult,
      data: transformedMessages
    });
  });

  // Send multiple images/media in one request
  // Creates chat if not exists, handles first message after clear
  sendMediaMessage = asyncHandler(async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { _id: senderId } = req.user;
      const senderType = req.user.role === "doctor" ? "Doctor" : "User";
      const { receiverId, receiverType, chatId, media } = req.body;
      const lang = req.headers.lang || "en";

      let chat;
      let firstMsg = false;

      // Find or create chat
      if (chatId && !receiverId) {
        chat = await Chat.findById(chatId)
          .populate("participants.participantId", "_id fullName profilePicture lang notificationToken")
          .session(session);

        if (!chat) throw new ApiError(translate("Chat not found", lang), 404);
      } 
      else if (receiverId && !chatId) {
        chat = await Chat.findOne({
          "participants.participantId": { $all: [senderId, receiverId] }
        })
          .populate("participants.participantId", "_id fullName profilePicture lang notificationToken")
          .session(session);

        if (!chat) {
          const [newChat] = await Chat.create(
            [{
              participants: [
                { participantId: senderId, participantType: senderType },
                { participantId: receiverId, participantType: receiverType || "User" }
              ]
            }],
            { session }
          );
          chat = await Chat.findById(newChat._id)
            .populate("participants.participantId", "_id fullName profilePicture lang notificationToken")
            .session(session);
          firstMsg = true;
        }
      } 
      else {
        throw new ApiError("Please provide either chat id or receiver id", 400);
      }

      // Check if this is first message after someone cleared the chat
      if (!firstMsg && chat.clearedBy && chat.clearedAt) {
        const msgsAfterClear = await Message.find({
          chat: chat._id,
          createdAt: { $gt: chat.clearedAt }
        }).session(session);
        firstMsg = msgsAfterClear.length === 0;
      }

      // Create message documents for each media file
      const promises = media.map(fileUrl => 
        Message.create(
          [{ 
            chat: chat._id, 
            sender: { senderId, senderType }, 
            type: "image", 
            content: fileUrl 
          }],
          { session }
        )
      );

      let messages = (await Promise.all(promises)).map(arr => arr[0]);

      const otherParticipant = chat.getOtherParticipant(senderId);
      const toUser = otherParticipant.participantId;
      const io = req.app.get("socketio");

      // Emit to both users
      messages.forEach((msg, index) => {
        const isFirst = firstMsg && index === 0;

        chat.participants.forEach(participant => {
          const pId = participant.participantId._id.toString();
          const isSender = pId === senderId.toString();

          if (isFirst) {
            io.to(pId).emit("new-chat", {
              _id: chat._id,
              to: {
                _id: otherParticipant.participantId._id,
                profilePicture: otherParticipant.participantId.profilePicture || "",
                fullName: otherParticipant.participantId.fullName,
                type: otherParticipant.participantType
              },
              messages: [{
                _id: msg._id,
                content: msg.content,
                type: msg.type,
                isDelivered: msg.isDelivered,
                isRead: msg.isRead,
                isMyMsg: isSender,
                createdAt: msg.createdAt
              }],
              unreadMessagesCount: isSender ? 0 : 1,
              blocked: false
            });
          } else {
            io.to(pId).emit("message", {
              ...msg.toObject(),
              sender: undefined,
              isMyMsg: isSender
            });
          }
        });
      });

      // Send push notification if receiver has token
      if (toUser?.notificationToken) {
        sendMediaNotification({
          fromUser: req.user,
          toUser,
          roomId: chat._id.toString(),
          image: messages[0].content,
          count: messages.length
        });
      }

      await session.commitTransaction();
      session.endSession();

      res.status(201).json({
        success: true,
        chat: firstMsg ? {
          _id: chat._id,
          to: {
            _id: toUser._id,
            profilePicture: toUser.profilePicture,
            fullName: toUser.fullName,
            type: otherParticipant.participantType
          },
          messages: messages.map(m => ({ ...m.toObject(), sender: undefined, isMyMsg: true })),
          unreadMessagesCount: 0,
          blocked: false
        } : undefined,
        messages: firstMsg ? undefined : messages.map(m => ({ ...m.toObject(), sender: undefined, isMyMsg: true }))
      });
    } catch (error) {
      if (session.inTransaction()) await session.abortTransaction();
      session.endSession();
      next(error);
    }
  });

  // Clear/delete chat history logic (per user)
  // Different behavior based on who cleared before
  clearChat = asyncHandler(async (req, res, next) => {
    const { id } = req.params;
    const userId = req.user._id;
    const lang = req.headers.lang || "en";

    const session = await Chat.startSession();
    session.startTransaction();

    try {
      const chat = await Chat.findById(id).session(session);
      if (!chat) throw new ApiError(translate("Chat not found", lang), 404);

      if (!chat.hasParticipant(userId)) {
        throw new ApiError(translate("You are not a participant in this chat", lang), 403);
      }

      if (chat.clearedBy?.toString() === userId.toString()) {
        // Already cleared by me → just update timestamp
        chat.clearedAt = new Date();
        await chat.save({ session });
      } 
      else if (chat.clearedBy) {
        // Other person cleared before
        const messagesAfterOtherClear = await Message.find({
          chat: id,
          createdAt: { $gt: chat.clearedAt }
        }).session(session);

        if (messagesAfterOtherClear.length === 0) {
          // No new messages → delete chat completely
          await chat.deleteOne({ session });
          await Message.deleteMany({ chat: id }, { session });
        } else {
          // Delete old messages, set new clear for me
          await Message.deleteMany({
            chat: id,
            createdAt: { $lt: chat.clearedAt }
          }).session(session);

          chat.clearedBy = userId;
          chat.clearedAt = new Date();
          await chat.save({ session });
        }
      } 
      else {
        // First time clear → just mark for current user
        chat.clearedBy = userId;
        chat.clearedAt = new Date();
        await chat.save({ session });
      }

      await session.commitTransaction();
      session.endSession();

      res.status(200).json({ success: true, message: "Chat cleared successfully" });
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      next(error);
    }
  });
}

module.exports = new ChatController();