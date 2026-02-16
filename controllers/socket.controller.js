const User = require("../models/user.model");
const Doctor = require("../models/doctor.model");
const Chat = require("../models/chat.model");
const Message = require("../models/message.model");
const { translate } = require("../utils/translation");
const { sendNotification } = require("../utils/sendNotification");

class SocketController {

  // User joins a chat room
  // - Adds user to socket room
  // - Marks incoming messages as delivered & read
  // - Notifies the other participant that messages have been seen
  joinChat = async (io, socket, userData, chatRoomUsers, { chatId }) => {
    try {
      if (!chatId) return socket.emit("error", "Chat ID is required");

      const chat = await Chat.findById(chatId);
      if (!chat || !chat.hasParticipant(userData._id)) {
        return socket.emit("error", "Chat not found or unauthorized");
      }

      // Join socket.io room
      socket.join(chatId.toString());

      // Track online users per chat room
      if (!chatRoomUsers[chatId]) chatRoomUsers[chatId] = new Set();
      chatRoomUsers[chatId].add(userData._id.toString());

      // Mark all unread incoming messages as delivered and read
      await Message.updateMany(
        { 
          chat: chatId, 
          "sender.senderId": { $ne: userData._id } 
        },
        { isDelivered: true, isRead: true }
      );

      // Notify the other person that their messages were seen
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

  // Notify the other participant that current user started typing
  startTyping = async (socket, userData, { chatId }) => {
    try {
      if (!chatId) return socket.emit("error", "Chat ID is required");

      const chat = await Chat.findById(chatId);
      if (!chat || !chat.hasParticipant(userData._id)) {
        return socket.emit("error", "Chat not found or unauthorized");
      }

      // Send typing event only to the other participant
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

  // Notify the other participant that typing has stopped
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


}

module.exports = new SocketController();