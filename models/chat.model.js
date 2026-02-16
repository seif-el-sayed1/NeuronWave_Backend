const mongoose = require("mongoose");

const participantSchema = new mongoose.Schema(
  {
    participantId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      // Dynamic reference: model is chosen based on participantType value
      refPath: "participants.participantType"
    },
    participantType: {
      type: String,
      required: true,
      enum: ["User", "Doctor"] // restricts allowed models
    }
  },
  { _id: false } // prevent subdocument _id creation
);

const chatSchema = new mongoose.Schema(
  {
    participants: {
      type: [participantSchema],
      validate: {
        // Enforce exactly 2 participants per chat
        validator: (value) => value.length === 2,
        message: "Participants array must contain exactly 2 users."
      }
    },
    clearedBy: {
      type: mongoose.Schema.Types.ObjectId
    },
    clearedAt: Date
  },
  { timestamps: true } // auto adds createdAt & updatedAt
);

// Returns participant IDs as strings
chatSchema.methods.getParticipantIds = function () {
  return this.participants.map((p) => p.participantId.toString());
};

// Handles both populated objects and raw ObjectIds
const extractId = (participantId) => {
  if (participantId && typeof participantId === "object" && participantId._id)
    return participantId._id.toString();
  return participantId?.toString();
};

// Checks if a user exists in this chat
chatSchema.methods.hasParticipant = function (userId) {
  return this.participants.some(
    (p) => extractId(p.participantId) === userId.toString()
  );
};

// Returns the other participant in a 1-to-1 chat
chatSchema.methods.getOtherParticipant = function (userId) {
  return this.participants.find(
    (p) => extractId(p.participantId) !== userId.toString()
  );
};

// Prevent duplicate chats between the same two users
chatSchema.pre("save", async function (next) {
  if (this.isNew) {
    const [p1, p2] = this.participants;

    const existingChat = await mongoose.model("Chat").findOne({
      $and: [
        { "participants.participantId": p1.participantId },
        { "participants.participantId": p2.participantId }
      ]
    });

    if (existingChat) {
      const error = new Error("Chat with these participants already exists.");
      error.statusCode = 400;
      return next(error);
    }
  }
  next();
});

module.exports = mongoose.model("Chat", chatSchema);
