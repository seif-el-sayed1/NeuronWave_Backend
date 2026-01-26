const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    appointment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Appointment"
    },
    orderCode: {
      type: String,
      required: true
    },
    amount: {
      type: Number,
      required: true
    },
    billedAmount: {
      type: Number,
      required: true
    },
    card_num: {
      type: String
    },
    cardType: {
      type: String
    },
    currency: {
      type: String
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    success: {
      type: Boolean
    },
    pending: {
      type: Boolean,
      default: true
    },
    status: {
      type: String,
      enum: ["pending", "processing", "shipped", "delivered", "cancelled"],
      default: "pending"
    },
    clientSecret: {
      type: String
    }
  },
  {
    timestamps: true
  }
);

const Payment = mongoose.model("Payment", paymentSchema);

module.exports = Payment;
