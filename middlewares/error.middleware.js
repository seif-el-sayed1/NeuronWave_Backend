const ApiError = require("../utils/ApiError");
const capitalizeFirstLetter = require("../utils/capitalizeFirstLetter");
const { translate } = require("../utils/translation");

const sendErrorForDev = (err, res, lang) => {
  console.log("🚀 ~ sendErrorForDev ~ err:", err);
  res.status(err.statusCode).json({
    success: err.success || false,
    message: err.message || translate("Something went wrong", lang),
    stack: err.stack
  });
};

const sendErrorForProd = (err, res, lang) => {
  if (!err.isOperational) {
    res.status(err.statusCode).json({
      success: false,
      message: translate("Something went wrong", lang)
    });
  } else {
    res.status(err.statusCode).json({
      success: err.success || false,
      message: err.message
    });
  }
};

const handleCastErrorDB = (err, lang) => {
  const invalidText = translate("Invalid", lang);
  const message = `${invalidText} ${err.path}: ${err.value}`;
  return new ApiError(message, 400);
};

const handleDuplicatedFieldsDB = (error, lang) => {
  const duplicateKey = Object.keys(error.keyPattern)[0]; 
  const alreadyUsed = translate("is already used", lang);
  
  let fieldName;
  if (duplicateKey.includes("Ar")) {
    const arabic = translate("Arabic", lang);
    fieldName = `${arabic} ${duplicateKey.slice(0, -2)}`;
  } else if (duplicateKey.includes("En")) {
    const english = translate("English", lang);
    fieldName = `${english} ${duplicateKey.slice(0, -2)}`;
  } else {
    fieldName = translate(duplicateKey, lang) || capitalizeFirstLetter(duplicateKey);
  }
  
  const errorMessage = `${fieldName} ${alreadyUsed}`;
  return new ApiError(errorMessage, 400);
};

const handleValidationError = (err, lang) => {
  const errors = Object.values(err.errors).map((el) => {
    return translate(el.message, lang);
  });
  const invalidData = translate("Invalid Input Data", lang);
  const message = `${invalidData}: ${errors.join(". ")}`;
  return new ApiError(message, 400);
};

const handleInvalidJwtSignature = (lang) => 
  new ApiError(translate("Invalid token, Please login again ...", lang), 400);

const handleJwtExpired = (lang) => 
  new ApiError(translate("Expired token, Please login again ...", lang), 400);

const globalError = (err, req, res, next) => {
  const lang = req.headers?.lang?.toLowerCase() || "en";
  
  err.success = err.success || false;
  err.statusCode = err.statusCode || 500;
  let error = { ...err };
  error.message = err.message;
  
  if (err.name === "JsonWebTokenError") error = handleInvalidJwtSignature(lang);
  if (err.name === "TokenExpiredError") error = handleJwtExpired(lang);
  if (err.code === 11000) error = handleDuplicatedFieldsDB(err, lang);
  if (err.name === "CastError") error = handleCastErrorDB(err, lang);
  if (err.name === "ValidationError") error = handleValidationError(err, lang);
  
  error.message = translate(error.message, lang);
  
  if (process.env.NODE_ENV === "development") {
    sendErrorForDev(error, res, lang);
  } else {
    sendErrorForProd(error, res, lang);
  }
};

module.exports = globalError;