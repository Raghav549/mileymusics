import express from 'express';
import { asyncHandler } from '../utils/errors.js';
import { validateSchema } from '../middleware/validation.js';
import { requireAuth } from '../middleware/auth.js';
import userService from '../services/user.js';
import Joi from 'joi';

const router = express.Router();

// Get user profile
router.get('/:id', asyncHandler(async (req, res) => {
  const user = await userService.getUserProfile(req.params.id);
  res.json(user);
}));

// Update user profile
router.put('/:id', requireAuth, validateSchema(Joi.object({
  full_name: Joi.string().max(100),
  bio: Joi.string().max(500),
  avatar_url: Joi.string().uri(),
  cover_url: Joi.string().uri(),
  location: Joi.string().max(100),
  website: Joi.string().uri(),
})), asyncHandler(async (req, res) => {
  if (req.params.id !== req.user.id) {
    return res.status(403).json({ error: 'Cannot update other user profiles' });
  }
  const user = await userService.updateUserProfile(req.user.id, req.body);
  res.json(user);
}));

// Get user followers
router.get('/:id/followers', asyncHandler(async (req, res) => {
  const { limit = 20, offset = 0 } = req.query;
  const followers = await userService.getFollowers(req.params.id, parseInt(limit), parseInt(offset));
  res.json(followers);
}));

// Get user following
router.get('/:id/following', asyncHandler(async (req, res) => {
  const { limit = 20, offset = 0 } = req.query;
  const following = await userService.getFollowing(req.params.id, parseInt(limit), parseInt(offset));
  res.json(following);
}));

// Follow user
router.post('/:id/follow', requireAuth, asyncHandler(async (req, res) => {
  if (req.params.id === req.user.id) {
    return res.status(400).json({ error: 'Cannot follow yourself' });
  }
  await userService.followUser(req.user.id, req.params.id);
  res.json({ message: 'User followed' });
}));

// Unfollow user
router.delete('/:id/follow', requireAuth, asyncHandler(async (req, res) => {
  await userService.unfollowUser(req.user.id, req.params.id);
  res.json({ message: 'User unfollowed' });
}));

// Get user stats
router.get('/:id/stats', asyncHandler(async (req, res) => {
  const stats = await userService.getUserStats(req.params.id);
  res.json(stats);
}));

// Search users
router.get('/search', asyncHandler(async (req, res) => {
  const { q, limit = 20 } = req.query;
  if (!q) return res.status(400).json({ error: 'Search query required' });
  const users = await userService.searchUsers(q, parseInt(limit));
  res.json(users);
}));

export { router };
