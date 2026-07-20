import express from 'express';
import { asyncHandler } from '../utils/errors.js';
import { validateSchema } from '../middleware/validation.js';
import { requireAuth } from '../middleware/auth.js';
import authService from '../services/auth.js';
import Joi from 'joi';

const router = express.Router();

// Register
router.post('/register', validateSchema(Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  username: Joi.string().alphanum().min(3).max(20).required(),
  full_name: Joi.string().max(100),
})), asyncHandler(async (req, res) => {
  const { email, password, username, full_name } = req.body;
  const result = await authService.signup({
    email,
    password,
    username,
    full_name,
  });
  res.status(201).json(result);
}));

// Login
router.post('/login', validateSchema(Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
})), asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const result = await authService.login(email, password);
  res.json(result);
}));

// Refresh Token
router.post('/refresh', validateSchema(Joi.object({
  refresh_token: Joi.string().required(),
})), asyncHandler(async (req, res) => {
  const { refresh_token } = req.body;
  const result = await authService.refreshToken(refresh_token);
  res.json(result);
}));

// Password Reset Request
router.post('/password-reset', validateSchema(Joi.object({
  email: Joi.string().email().required(),
})), asyncHandler(async (req, res) => {
  const { email } = req.body;
  await authService.requestPasswordReset(email);
  res.json({ message: 'Password reset email sent' });
}));

// Verify Email
router.post('/verify-email', requireAuth, asyncHandler(async (req, res) => {
  const { token } = req.body;
  await authService.verifyEmail(req.user.id, token);
  res.json({ message: 'Email verified' });
}));

// Google OAuth
router.post('/oauth/google', validateSchema(Joi.object({
  token: Joi.string().required(),
})), asyncHandler(async (req, res) => {
  const { token } = req.body;
  const result = await authService.authenticateWithGoogle(token);
  res.json(result);
}));

export { router };
