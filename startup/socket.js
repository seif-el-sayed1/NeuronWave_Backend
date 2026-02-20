const jwt = require("jsonwebtoken");
const socketio = require("socket.io");
const User = require("../models/user.model");
const Doctor = require("../models/doctor.model");

const SocketController = require("../controllers/socket.controller");
const { sendNotification } = require("../utils/sendNotification");
const { translate } = require("../utils/translation");

const onlineUsers = new Set();
const chatRoomUsers = {};
let io;

// Authenticate socket connection using JWT
// Supports both regular users and doctors
// Performs multiple security validations
const getUserDetails = async (socket, token) => {
  try {
    if (!token) {
      socket.emit("error", "No authentication token provided");
      return null;
    }

    const decoded = await jwt.verify(token, process.env.JWT_SECRET);

    let currentUser = await User.findById(decoded.userId);
    if (!currentUser) currentUser = await Doctor.findById(decoded.userId);

    if (!currentUser) { socket.emit("error", "User/Doctor not found"); return null; }
    if (currentUser.token !== token) { socket.emit("error", "Session expired or invalid token"); return null; }
    if (!currentUser.isActive) { socket.emit("error", "Account is deactivated"); return null; }
    if (currentUser.isBlocked) { socket.emit("error", "Account is blocked"); return null; }

    if (
      currentUser.passwordChangedAt &&
      parseInt(currentUser.passwordChangedAt.getTime() / 1000, 10) > decoded.iat
    ) {
      socket.emit("error", "Password changed — please login again");
      return null;
    }

    return currentUser;
  } catch (error) {
    socket.emit("error", "Authentication error: " + error.message);
    return null;
  }
};

// Only sent if the recipient is not currently viewing the chat
const sendMediaNotification = ({ fromUser, toUser, roomId, image, count = 1 }) => {
  if (chatRoomUsers[roomId]?.has(toUser._id.toString())) return;
  if (!toUser.notificationToken) return;

  sendNotification({
    token: toUser.notificationToken,
    title: `${translate("New message from", toUser.lang)} ${fromUser.fullName.split(" ")[0]}`,
    body: count > 1 ? `${count} photos` : "Photo",
    image,
    caseType: "chat",
    info: roomId.toString()
  });
};

module.exports = (server, app) => {
  io = socketio(server, {
    cors: { origin: "*", methods: ["GET", "POST"], credentials: true }
  });

  app.set("socketio", io);
  app.set("onlineUsers", onlineUsers);

  io.on("connection", async (socket) => {
    try {
      const token = socket.handshake.headers.authorization;
      const userData = await getUserDetails(socket, token);

      if (!userData) return;

      // Join personal room (used for direct notifications / private events)
      socket.join(userData._id.toString());

      onlineUsers.add(userData._id.toString());
      io.emit("online-users", Array.from(onlineUsers));

      // Sync delivery & read status for all existing messages on connect
      SocketController.messagesDeliveredOnConnect(io, socket, userData, chatRoomUsers);

      // Chat Events
      socket.on("typing", (data) => SocketController.startTyping(socket, userData, data));
      socket.on("stop-typing", (data) => SocketController.stopTyping(socket, userData, data));
      socket.on("message-delivered", (data) => SocketController.messageDelivered(io, socket, userData, chatRoomUsers, data));
      socket.on("join-chat", (data) => SocketController.joinChat(io, socket, userData, chatRoomUsers, data));
      socket.on("leave-chat", (data) => SocketController.leaveChat(socket, userData, chatRoomUsers, data));
      socket.on("new-message", (data) => SocketController.sendChatMessage(io, socket, userData, chatRoomUsers, data, Array.from(onlineUsers)));

      // Handle outgoing call request and notify receiver (socket or push) 
      socket.on("call-user", async ({ receiverId, roomId, callerName, callerPicture }) => {
        const isOnline = onlineUsers.has(receiverId?.toString());

        if (isOnline) {
          io.to(receiverId.toString()).emit("incoming-call", {
            callerId: userData._id.toString(),
            callerName: callerName || userData.fullName || userData.firstName,
            callerPicture: callerPicture || userData.profilePicture || "",
            roomId,
          });
        } else {
          try {
            let receiver = await User.findById(receiverId).select("notificationToken fullName lang");
            if (!receiver) receiver = await Doctor.findById(receiverId).select("notificationToken fullName lang");

            if (receiver?.notificationToken) {
              sendNotification({
                token: receiver.notificationToken,
                title: `📞 ${translate("Incoming Call", receiver)}`,
                body: `${callerName || userData.fullName || userData.firstName} is calling you`,
                caseType: "call",
                info: roomId,
              });
            }

            socket.emit("call-failed", { reason: "User is offline" });

          } catch (err) {
            console.error("Error sending call notification:", err);
            socket.emit("call-failed", { reason: "User is offline" });
          }
        }
      });

      // Notify caller that the receiver accepted the call
      socket.on("call-accepted", ({ callerId, roomId }) => {
        io.to(callerId.toString()).emit("call-accepted", {
          acceptedBy: userData._id.toString(),
          roomId,
        });
      });


      // Disconnect 
      socket.on("disconnect", () => {
        onlineUsers.delete(userData._id.toString());
        SocketController.leaveAllChats(socket, userData, chatRoomUsers);
        io.emit("online-users", Array.from(onlineUsers));
      });
    } catch (error) {
      socket.emit("error", { message: error.message });
    }
  });

  return io;
};

module.exports.chatRoomUsers = chatRoomUsers;

module.exports.getIO = () => {
  if (!io) throw new Error("Socket.io not initialized yet!");
  return io;
};

module.exports.sendMediaNotification = sendMediaNotification;