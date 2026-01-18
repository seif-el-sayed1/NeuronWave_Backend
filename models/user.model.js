const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const {
  USER,
  STAFF,
  LOGIN_TYPE_LIST,
} = require("../utils/constants");
const localizationSetUp = require("../utils/modelLocalizationSetUp");
const { type } = require("os");

const userSchema = mongoose.Schema(
  {
    lang: {
      type: String,
      enum: ["en", "ar"],
      default: "en"
    },
    loginType: {
      type: String,
      enum: LOGIN_TYPE_LIST,
      default: "email"
    },
    fullName: {
      type: String,
      trim: true,
      required: true,                    
    },
    role: {
      type: String,
      default: USER
    },
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Doctor"
    },
    email: {
      type: String,
      trim: true,
      lowercase: true
    },
    phone: {
      type: String,
      trim: true
    },
    dateOfBirh : {
      type: Date,
    },
    age: {
      type: Number,
      min: 0
    },
    gender: {                              
      type: String,
      enum: ["male", "female", "ذكر", "انثي"],
      lowercase: true
    },
    address: {
      type: String,
    },
    emergencyContact: {                    
      type: String,
      trim: true
    },
    medicalHistory: {
      type: String,
      trim: true
    },
    diagnosis: {
      type: String,
      trim: true
    },
    notes: {
      type: String,
    },
    lastVisit: {
      type: Date,
    },
    registerType: {
      type: String,
      enum: ["byApp", "byDoctor"],
      default: "byApp"                     
    },
    lastVisit: {
      type: Date
    },
    // Password
    password: {
      type: String,
      minLength: [6, "Too short password"],
    },
    passwordChangedAt: Date,
    passwordResetCode: String,
    passwordResetCodeExp: Date,
    passwordResetCodeVerified: Boolean,
    // Verification
    verificationCode: String,
    verificationCodeExp: Date,
    verificationCodeVerified: Boolean,
    passwordVerificationToken: String,
    passwordResetExpiresAt: Date,
    isVerified: {
      type: Boolean,
      default: false
    },
    notVerifiedTime: {
      type: Date,
      expires: "10m"
    },
    // Active
    deactivatedAt: {
      type: Date,
      expires: "15d"
    },
    isActive: {
      type: Boolean,
      default: true
    },
    isBlocked: {
      type: Boolean,
      default: false
    },
    token: String,
    tokenExpDate: Date,
    notificationToken: String,
  },
  { timestamps: true}
);

userSchema.index({ location: "2dsphere" });

userSchema.index(
  { phone: 1 },
  {
    unique: true,
    partialFilterExpression: { phone: { $exists: true } }
  }
);
userSchema.index(
  { email: 1 },
  {
    unique: true,
    partialFilterExpression: { email: { $exists: true } }
  }
);

userSchema.index({ doctor: 1 });


userSchema.methods.generateToken = async function () {
  const tokenExpDate = new Date();
  tokenExpDate.setDate(
    tokenExpDate.getDate() + parseInt(process.env.JWT_EXPIRATION.toString().slice(0, -1))
  );
  const token = jwt.sign(
    {
      userId: this._id,
      role: USER,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRATION
    }
  );
  this.token = token;
  this.tokenExpDate = tokenExpDate;
  this.updatePassword = false;

  await this.save();

  return { token, tokenExpDate };
};

userSchema.methods.comparePassword = async function (password) {
  if (this.loginType !== "email") {
    if (password) return false;
  } else return await bcrypt.compare(password, this.password);
};

userSchema.pre("save", async function (next) {
  if (!this.password) return next();
  if (!this.isModified("password")) return next();

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  this.passwordChangedAt = Date.now() - 1000;
  next();
});

userSchema.methods.generatePasswordVerificationToken = async function (session) {
  const passwordCreationToken = crypto.randomBytes(32).toString("hex");
  console.log("Generated Token:", passwordCreationToken);
  const hashedToken = crypto.createHash("sha256").update(passwordCreationToken).digest("hex");

  this.passwordVerificationToken = hashedToken;
  this.passwordResetExpiresAt = Date.now() + 10 * 60 * 1000;

  await this.save({ validateBeforeSave: false });

  return passwordCreationToken;
};

module.exports = mongoose.model("User", userSchema);