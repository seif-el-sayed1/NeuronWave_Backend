const mongoose = require('mongoose');
const { APPOINTMENT_TYPES, APPOINTMENT_STATUS } = require('../utils/constants');

const appointmentSchema = new mongoose.Schema({
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
    date: {
        type: Date,
    },
    time: {
        type: String,
    },
    type: {
        type: String,
        enum: APPOINTMENT_TYPES,
        required: true
    },
    status: {
        type: String,
        enum: APPOINTMENT_STATUS,
        default: 'pending'
    },
    rejectionReason: {
        type: String,
    },
    notes: {
        type: String,
    },

}, { timestamps: true });

module.exports = mongoose.model('Appointment', appointmentSchema);