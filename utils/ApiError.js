class ApiError extends Error {
    constructor(message, statusCode = 500) {
        super(message);
        this.isOperational = true;
        this.statusCode = statusCode;
        this.success = statusCode >= 200 && statusCode < 400;
        Error.captureStackTrace(this, this.constructor);
    }
}

module.exports = ApiError;
