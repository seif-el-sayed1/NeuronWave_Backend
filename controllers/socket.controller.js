const User = require("../models/user.model");
const Doctor = require("../models/doctor.model");
const Chat = require("../models/chat.model");
const Message = require("../models/message.model");
const { translate } = require("../utils/translation");
const { sendNotification } = require("../utils/sendNotification");

class SocketController {

  joinChat = async (io, socket, userData, chatRoomUsers, { chatId }) => {
    try {
      if (!chatId) return socket.emit("error", "Chat ID is required");

      const chat = await Chat.findById(chatId);
      if (!chat || !chat.hasParticipant(userData._id)) {
        return socket.emit("error", "Chat not found or unauthorized");
      }

      socket.join(chatId.toString());

      if (!chatRoomUsers[chatId]) chatRoomUsers[chatId] = new Set();
      chatRoomUsers[chatId].add(userData._id.toString());

      await Message.updateMany(
        { 
          chat: chatId, 
          "sender.senderId": { $ne: userData._id } 
        },
        { isDelivered: true, isRead: true }
      );

      const otherParticipant = chat.getOtherParticipant(userData._id);
      if (otherParticipant) {
        io.to(otherParticipant.participantId.toString()).emit("messages-seen", {
          chatId,
          seenTime: new Date()
        });
      }
    } catch (error) {
      console.error("Error in joinChat:", error);
      socket.emit("error", "Failed to join chat");
    }
  };

  startTyping = async (socket, userData, { chatId }) => {
    try {
      if (!chatId) return socket.emit("error", "Chat ID is required");

      const chat = await Chat.findById(chatId);
      if (!chat || !chat.hasParticipant(userData._id)) {
        return socket.emit("error", "Chat not found or unauthorized");
      }

      chat.participants.forEach((participant) => {
        if (participant.participantId.toString() !== userData._id.toString()) {
          socket.to(participant.participantId.toString()).emit("typing", {
            chatId,
            userId: userData._id,
            userName: userData.fullName || userData.firstName
          });
        }
      });
    } catch (error) {
      console.error("Error in startTyping:", error);
      socket.emit("error", "Failed to send typing indicator");
    }
  };

  stopTyping = async (socket, userData, { chatId }) => {
    try {
      if (!chatId) return socket.emit("error", "Chat ID is required");

      const chat = await Chat.findById(chatId);
      if (!chat || !chat.hasParticipant(userData._id)) {
        return socket.emit("error", "Chat not found or unauthorized");
      }

      chat.participants.forEach((participant) => {
        if (participant.participantId.toString() !== userData._id.toString()) {
          socket.to(participant.participantId.toString()).emit("stop-typing", {
            chatId,
            userId: userData._id,
            userName: userData.fullName || userData.firstName
          });
        }
      });
    } catch (error) {
      console.error("Error in stopTyping:", error);
      socket.emit("error", "Failed to send stop typing indicator");
    }
  };

  sendChatMessage = async (io, socket, userData, chatRoomUsers, data, onlineUsers) => {
    try {
      let { content, chatId, otherUserId, otherUserType, type = "text" } = data;

      let firstMsg = false;
      let chat;

      if (chatId && otherUserId) {
        return socket.emit("error", "Cannot provide both chatId and otherUserId");
      }

      if (otherUserId) {
        const senderType = userData.role === "doctor" ? "Doctor" : "User";
        const receiverType = otherUserType || "User";

        if (senderType === "User" && receiverType === "User") {
          const otherUser = await User.findById(otherUserId).select("_id blockedUsers");
          if (!otherUser) return socket.emit("error", "User not found");

          if (
            userData.blockedUsers?.includes(otherUserId) ||
            otherUser.blockedUsers?.includes(userData._id)
          ) {
            return socket.emit("error", "Cannot send message — user is blocked");
          }
        }

        chat = await Chat.findOne({
          "participants.participantId": { $all: [userData._id, otherUserId] }
        });

        if (!chat) {
          chat = await Chat.create({
            participants: [
              { participantId: userData._id, participantType: senderType },
              { participantId: otherUserId, participantType: receiverType }
            ]
          });
          firstMsg = true;
        }

        socket.join(chat._id.toString());
        if (!chatRoomUsers[chat._id]) chatRoomUsers[chat._id] = new Set();
        chatRoomUsers[chat._id].add(userData._id.toString());
        chatId = chat._id.toString();
      } 
      else if (chatId) {
        chat = await Chat.findById(chatId);
        if (!chat || !chat.hasParticipant(userData._id)) {
          return socket.emit("error", "Chat not found or unauthorized");
        }
      }

      const senderType = userData.role === "doctor" ? "Doctor" : "User";

      const newMessage = await Message.create({
        chat: chatId,
        sender: { senderId: userData._id, senderType },
        content,
        type,
        isDelivered: false,
        isRead: false
      });

      const populatedChat = await Chat.findById(chatId).populate(
        "participants.participantId",
        "_id fullName profilePicture notificationToken lang"
      );

      const otherParticipantObj = populatedChat.participants.find(
        p => p.participantId._id.toString() !== userData._id.toString()
      );
      const receiverId = otherParticipantObj?.participantId._id.toString();
      const receiverIsOnline = !!(onlineUsers && receiverId && (
        typeof onlineUsers.has === "function"
          ? onlineUsers.has(receiverId)
          : Array.isArray(onlineUsers)
            ? onlineUsers.includes(receiverId)
            : false
      ));

      if (receiverIsOnline) {
        await Message.findByIdAndUpdate(newMessage._id, { isDelivered: true });
        newMessage.isDelivered = true;
      }

      for (let participant of populatedChat.participants) {
        const participantId = participant.participantId._id.toString();
        const isMe = participantId === userData._id.toString();

        if (populatedChat.clearedBy) {
          if (populatedChat.clearedBy.toString() === participantId) {
            const messagesAfterClear = await Message.find({
              chat: populatedChat._id,
              createdAt: { $gt: populatedChat.clearedAt }
            });

            firstMsg =
              messagesAfterClear.length === 0 ||
              (messagesAfterClear.length === 1 && 
               messagesAfterClear[0]._id.toString() === newMessage._id.toString());
          } else {
            firstMsg = false;
          }
        }

        const toParticipant = populatedChat.participants.find(
          p => p.participantId._id.toString() !== participantId
        );

        if (firstMsg) {
          io.to(participantId).emit("new-chat", {
            _id: chatId,
            to: {
              _id: toParticipant.participantId._id,
              profilePicture: toParticipant.participantId.profilePicture || "",
              fullName: toParticipant.participantId.fullName,
              type: toParticipant.participantType
            },
            messages: [{
              _id: newMessage._id,
              sender: {
                _id: userData._id,
                fullName: isMe ? "You" : (userData.fullName || userData.firstName)
              },
              receiver: { _id: otherParticipantObj?.participantId._id }, // ✅
              content: newMessage.content,
              type: newMessage.type,
              isDelivered: newMessage.isDelivered,
              isRead: newMessage.isRead,
              isMyMsg: isMe,
              createdAt: newMessage.createdAt
            }],
            unreadMessagesCount: isMe ? 0 : 1,
            blocked: false
          });

          if (isMe && receiverIsOnline) {
            io.to(userData._id.toString()).emit("message-delivered", {
              chatId,
              messageId: newMessage._id,
              messageTime: newMessage.createdAt
            });
          }
        } else {
          io.to(participantId).emit("message", {
            ...newMessage.toObject(),
            sender: undefined,
            receiver: { _id: otherParticipantObj?.participantId._id }, 
            isMyMsg: isMe
          });

          if (isMe && receiverIsOnline) {
            io.to(userData._id.toString()).emit("message-delivered", {
              chatId,
              messageId: newMessage._id,
              messageTime: newMessage.createdAt
            });
          }
        }
      }

      const otherParticipant = populatedChat.participants.find(
        p => p.participantId._id.toString() !== userData._id.toString()
      );

      if (
        otherParticipant?.participantId?.notificationToken &&
        (!chatRoomUsers[chatId] || !chatRoomUsers[chatId].has(otherParticipant.participantId._id.toString()))
      ) {
        sendNotification({
          token: otherParticipant.participantId.notificationToken,
          title: `${translate("New message from", otherParticipant.participantId.lang)} ${userData.fullName || userData.firstName}`,
          body: content,
          caseType: "chat",
          info: chatId.toString()
        });
      }
    } catch (error) {
      socket.emit("error", { message: error.message });
    }
  };

  // Called when user connects — sync delivery/read status for all chats
  messagesDeliveredOnConnect = async (io, socket, userData, chatRoomUsers) => {
    try {
      // Find all user's chats
      const chats = await Chat.find({ "participants.participantId": userData._id });
      const chatIds = chats.map(chat => chat._id.toString());

      // Find undelivered messages sent to this user
      const messages = await Message.find({
        chat: { $in: chatIds },
        "sender.senderId": { $ne: userData._id },
        isDelivered: false,
        isRead: false
      });

      for (let message of messages) {
        if (!message?.chat) continue;

        const chatId = message.chat.toString();
        const chat = await Chat.findById(chatId);

        if (!chat || !chat.hasParticipant(userData._id)) continue;

        const updateBody = { isDelivered: true };
        // If user is currently in this chat room → also mark as read
        if (chatRoomUsers[chatId]?.has(userData._id.toString())) {
          updateBody.isRead = true;
        }

        // Update all messages up to this one
        await Message.updateMany(
          {
            chat: chatId,
            "sender.senderId": { $ne: userData._id },
            createdAt: { $lte: message.createdAt }
          },
          updateBody
        );

        const otherParticipant = chat.getOtherParticipant(userData._id);
        if (otherParticipant) {
          io.to(otherParticipant.participantId.toString()).emit("message-delivered", {
            chatId,
            messageId: message._id,
            messageTime: message.createdAt
          });

          if (chatRoomUsers[chatId]?.has(userData._id.toString())) {
            io.to(otherParticipant.participantId.toString()).emit("messages-seen", {
              chatId,
              seenTime: new Date()
            });
          }
        }
      }
    } catch (error) {
      socket.emit("error", { message: error.message });
    }
  };

  // Mark specific message (and older ones) as delivered/read
  // Usually called when client confirms delivery of a message
  messageDelivered = async (io, socket, userData, chatRoomUsers, { messageId }) => {
    try {
      const message = await Message.findById(messageId);
      if (!message) return;

      const chatId = message.chat.toString();
      const chat = await Chat.findById(chatId);

      if (!chat || !chat.hasParticipant(userData._id)) {
        return socket.emit("error", "Chat not found or unauthorized");
      }

      const updateBody = { isDelivered: true };
      if (chatRoomUsers[chatId]?.has(userData._id.toString())) {
        updateBody.isRead = true;
      }

      await Message.updateMany(
        {
          chat: chatId,
          "sender.senderId": { $ne: userData._id },
          createdAt: { $lte: message.createdAt }
        },
        updateBody
      );

      const otherParticipant = chat.getOtherParticipant(userData._id);
      if (otherParticipant) {
        io.to(otherParticipant.participantId.toString()).emit("message-delivered", {
          chatId,
          messageId: message._id,
          messageTime: message.createdAt
        });

        if (chatRoomUsers[chatId]?.has(userData._id.toString())) {
          io.to(otherParticipant.participantId.toString()).emit("messages-seen", {
            chatId,
            seenTime: new Date()
          });
        }
      }
    } catch (error) {
      socket.emit("error", { message: error.message });
    }
  };

  // User leaves a specific chat room
  leaveChat = async (socket, userData, chatRoomUsers, { chatId }) => {
    try {
      socket.leave(chatId.toString());

      if (chatRoomUsers[chatId]) {
        chatRoomUsers[chatId].delete(userData._id.toString());
        if (chatRoomUsers[chatId].size === 0) {
          delete chatRoomUsers[chatId];
        }
      }
    } catch (error) {
      socket.emit("error", { message: error.message });
    }
  };

  // Clean up — leave all chat rooms when user disconnects
  leaveAllChats = (socket, userData, chatRoomUsers) => {
    try {
      const userId = userData._id.toString();

      for (const [chatId, users] of Object.entries(chatRoomUsers)) {
        if (users.has(userId)) {
          socket.leave(chatId.toString());
          users.delete(userId);
          if (users.size === 0) {
            delete chatRoomUsers[chatId];
          }
        }
      }
    } catch (error) {
      socket.emit("error", { message: error.message });
    }
  };
}

module.exports = new SocketController();