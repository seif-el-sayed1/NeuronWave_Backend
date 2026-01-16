exports.SUPER_ADMIN = "superAdmin";
exports.ADMIN = "admin";
exports.USER = "user";
exports.DOCTOR = "doctor";

exports.ROLES = [exports.SUPER_ADMIN, exports.ADMIN, exports.USER, exports.DOCTOR];

exports.LOGIN_TYPE_LIST = ["apple", "google", "email", "social"];
exports.LOGIN_TYPE_PLATFORM_LIST = ["apple", "google", "social"];
exports.GENDER_LIST_EN = ["male", "female"];
exports.GENDER_LIST_AR = ["ذكر", "أنثى", "أنثي", "انثي", "انثى"];
exports.LANGS = ["en", "ar"]
exports.MEDICAL_SPECIALTIES = [
    "neurology",
    "movementDisorders",
    "generalMedicine",
    "psychiatry",
    "physicalTherapy",
]

exports.APPOINTMENT_STATUS = ['accepted', 'rejected', 'canceled', "pending"];

exports.APPOINTMENT_TYPES = ["checkup", "followUp", "emergency", "consultation"];