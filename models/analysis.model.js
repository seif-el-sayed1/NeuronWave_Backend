const mongoose = require("mongoose")
const analysisSchema = mongoose.Schema({
    patient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    doctor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Doctor',
        required: true
    },
    type: {
        type: String,
        enum: ["request", "byDoctor"],
        default: "request"
    },
    status: {
        type: String,
        enum: ["pending", "rejected", "approved"],
        default: "pending"
    },
    media: [String],
    modelType: {
        type: String,
        required: true
    },
    result: {
        type: [mongoose.Schema.Types.Mixed],
        default: []
    },
    consultation: {
        type: String
    }
}, { timestamps: true })
module.exports = mongoose.model("Analysis", analysisSchema)