// Roles
exports.SUPER_DOCTOR = "superDoctor";
exports.ADMIN = "admin";
exports.USER = "user";
exports.DOCTOR = "doctor";

exports.ROLES = [exports.SUPER_DOCTOR, exports.ADMIN, exports.USER, exports.DOCTOR];

// OAuth Providers
const OAUTH_PROVIDERS = {
  EMAIL: "email",
  GOOGLE: "google",
  FACEBOOK: "facebook",
  GITHUB: "github",
  APPLE: "apple",
  TWITTER: "TWITTER",
};
exports.OAUTH_PROVIDERS = OAUTH_PROVIDERS;

exports.LOGIN_TYPE_LIST = Object.values(OAUTH_PROVIDERS);

exports.LOGIN_TYPE_PLATFORM_LIST = ["apple", "google", "social"];
exports.GENDER_LIST_EN = ["male", "female"];
exports.GENDER_LIST_AR = ["ذكر", "أنثى", "أنثي", "انثي", "انثى"];
exports.LANGS = ["en", "ar"];
exports.MEDICAL_SPECIALTIES = [
    "neurology",
    "movementDisorders",
    "generalMedicine",
    "psychiatry",
    "physicalTherapy",
];
exports.APPOINTMENT_STATUS = ['accepted', 'rejected', 'canceled', "pending"];
exports.APPOINTMENT_TYPES = ["checkup", "followUp", "emergency", "consultation"];