import jwt from 'jsonwebtoken';
import { AppError } from '../utils/errors.js';

export const authenticateToken = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return next(new AppError('No token provided', 401));
    }

    const decoded = jwt.verify(token, process.env.SUPABASE_JWT_SECRET);
    req.user = {
      id: decoded.sub,
      email: decoded.email,
      aud: decoded.aud,
    };

    next();
  } catch (error) {
    return next(new AppError('Invalid or expired token', 401));
  }
};

// Alias for authenticateToken
export const requireAuth = authenticateToken;

export const optionalAuth = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (token) {
      const decoded = jwt.verify(token, process.env.SUPABASE_JWT_SECRET);
      req.user = {
        id: decoded.sub,
        email: decoded.email,
        aud: decoded.aud,
      };
    }

    next();
  } catch (error) {
    // Continue without auth if token is invalid
    next();
  }
};
