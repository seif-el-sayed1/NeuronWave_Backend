const mongoose = require("mongoose");
const { MESSAGE_TYPES } = require("../utils/constants");

const messageSchema = new mongoose.Schema(
  {
    chat: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Chat",
      default: null
    },
    sender: {
      senderId: {
        type: mongoose.Schema.Types.ObjectId,
        // Dynamic reference based on senderType (User or Doctor)
        refPath: "sender.senderType",
        validate: {
          validator: function (value) {
            // "label" messages do not require a sender
            const parentDoc = this.parent ? this.parent() : this;
            if (parentDoc.type === "label") return true;
            return value != null;
          },
          message: "Sender is required"
        }
      },
      senderType: {
        type: String,
        enum: ["User", "Doctor"] // restrict allowed models
      }
    },
    content: {
      type: String,
      trim: true,
      required: [true, "Message content is required"]
    },
    type: {
      type: String,
      enum: MESSAGE_TYPES, // centralized allowed message types
      default: "text"
    },
    isDelivered: {
      type: Boolean,
      default: false
    },
    isRead: {
      type: Boolean,
      default: false
    },
    isMyMsg: {
      type: Boolean
    }
  },
  { timestamps: true } // auto adds createdAt & updatedAt
);

// Indexes to optimize frequent queries
messageSchema.index({ chat: 1 });
messageSchema.index({ "sender.senderId": 1 });
messageSchema.index({ isDelivered: 1 });
messageSchema.index({ isRead: 1 });
messageSchema.index({ createdAt: 1 });

// Conditional auto-populate for sender on find queries
messageSchema.pre(/^find/, function (next) {
  if (this.getOptions().senderPopulation) {
    this.populate({
      path: "sender.senderId",
      select: "fullName profilePicture role"
    });
  }
  next();
});

module.exports = mongoose.model("Message", messageSchema);
