const mongoose = require("mongoose");

const notificationSchema = mongoose.Schema({
  title: {
    type: String,
    trim: true,
    required: [true, "Notification title is required"]
  },
  body: {
    type: String,
    trim: true
  },
  case: {
    type: String,
    trim: true
  },
  info: {
    type: String,
    trim: true
  },
  global: {
    type: Boolean,
    default: false
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  seen: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  scheduleTime: {
    type: Date,
    default: Date.now
  }
});

// Indexing for performance
notificationSchema.index({ user: 1, seen: 1 });

module.exports = mongoose.model("Notification", notificationSchema);
