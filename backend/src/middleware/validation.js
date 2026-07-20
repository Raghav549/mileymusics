import Joi from 'joi';
import { AppError } from '../utils/errors.js';

export const validateRequest = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate({
      body: req.body,
      query: req.query,
      params: req.params,
    });

    if (error) {
      const message = error.details
        .map((detail) => detail.message)
        .join(', ');
      return next(new AppError(message, 400));
    }

    req.validated = value;
    next();
  };
};

// Alias for validateRequest - validates just the body
export const validateSchema = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body);

    if (error) {
      const message = error.details
        .map((detail) => detail.message)
        .join(', ');
      return next(new AppError(message, 400));
    }

    req.validated = value;
    next();
  };
};
