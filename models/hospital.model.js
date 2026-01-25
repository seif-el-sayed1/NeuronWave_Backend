const mongoose = require('mongoose');

const hospitalSchema = new mongoose.Schema(
  {
    hospitalName: {
      type: String,
    },
    address: String,
    phone: {
      type: String,
    },
    email: {
      type: String,
    },
    doctors: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Doctor'
    }]
  },
  { timestamps: true }
);

hospitalSchema.index(
  { phone: 1 },
  { unique: true }
);

hospitalSchema.index(
  { email: 1 },
  { unique: true }
);

module.exports = mongoose.model('Hospital', hospitalSchema);
