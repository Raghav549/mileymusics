import express from 'express';
import { asyncHandler } from '../utils/errors.js';
import { validateSchema } from '../middleware/validation.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import songService from '../services/song.js';
import Joi from 'joi';

const router = express.Router();

// Get all songs with pagination
router.get('/', optionalAuth, asyncHandler(async (req, res) => {
  const { limit = 20, offset = 0, genre, mood } = req.query;
  const songs = await songService.getSongs(
    parseInt(limit),
    parseInt(offset),
    { genre, mood }
  );
  res.json(songs);
}));

// Get trending songs
router.get('/trending', asyncHandler(async (req, res) => {
  const { limit = 10 } = req.query;
  const songs = await songService.getTrendingSongs(parseInt(limit));
  res.json(songs);
}));

// Search songs
router.get('/search', asyncHandler(async (req, res) => {
  const { q, limit = 20 } = req.query;
  if (!q) return res.status(400).json({ error: 'Search query required' });
  const songs = await songService.searchSongs(q, parseInt(limit));
  res.json(songs);
}));

// Get single song
router.get('/:id', asyncHandler(async (req, res) => {
  const song = await songService.getSongById(req.params.id);
  res.json(song);
}));

// Create song (requires auth)
router.post('/', requireAuth, validateSchema(Joi.object({
  title: Joi.string().required(),
  description: Joi.string(),
  fileUrl: Joi.string().uri().required(),
  thumbnailUrl: Joi.string().uri(),
  genre: Joi.string(),
  mood: Joi.string(),
})), asyncHandler(async (req, res) => {
  const song = await songService.createSong(req.user.id, req.body);
  res.status(201).json(song);
}));

// Update song
router.put('/:id', requireAuth, asyncHandler(async (req, res) => {
  const song = await songService.updateSong(req.params.id, req.user.id, req.body);
  res.json(song);
}));

// Delete song
router.delete('/:id', requireAuth, asyncHandler(async (req, res) => {
  await songService.deleteSong(req.params.id, req.user.id);
  res.json({ message: 'Song deleted' });
}));

// Like song
router.post('/:id/like', requireAuth, asyncHandler(async (req, res) => {
  await songService.likeSong(req.params.id, req.user.id);
  res.json({ message: 'Song liked' });
}));

// Unlike song
router.delete('/:id/like', requireAuth, asyncHandler(async (req, res) => {
  await songService.unlikeSong(req.params.id, req.user.id);
  res.json({ message: 'Song unliked' });
}));

// Record play
router.post('/:id/play', asyncHandler(async (req, res) => {
  await songService.recordPlay(req.params.id, req.user?.id);
  res.json({ message: 'Play recorded' });
}));

// Get user likes
router.get('/user/likes', requireAuth, asyncHandler(async (req, res) => {
  const likes = await songService.getUserLikes(req.user.id);
  res.json(likes);
}));

export { router };
