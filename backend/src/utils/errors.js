export class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;

    Error.captureStackTrace(this, this.constructor);
  }
}

export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.message = err.message || 'Internal Server Error';

  // Wrong MongoDB ID error
  if (err.name === 'CastError') {
    const message = `Resource not found. Invalid: ${err.path}`;
    err.statusCode = 400;
    err.message = message;
  }

  // Duplicate key error
  if (err.code === 11000) {
    const message = `Duplicate field value entered`;
    err.statusCode = 400;
    err.message = message;
  }

  // Wrong JWT error
  if (err.name === 'JsonWebTokenError') {
    const message = `Json Web Token is invalid, try again `;
    err.statusCode = 400;
    err.message = message;
  }

  // JWT EXPIRE error
  if (err.name === 'TokenExpiredError') {
    const message = `Json Web Token is expired, try again `;
    err.statusCode = 400;
    err.message = message;
  }

  res.status(err.statusCode).json({
    success: false,
    message: err.message,
  });
};
