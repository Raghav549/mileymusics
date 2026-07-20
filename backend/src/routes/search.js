import express from 'express';
import { asyncHandler } from '../utils/errors.js';
import songService from '../services/song.js';
import userService from '../services/user.js';
import playlistService from '../services/playlist.js';

const router = express.Router();

// Global search across songs, users, and playlists
router.get('/', asyncHandler(async (req, res) => {
  const { q, type = 'all', limit = 20 } = req.query;

  if (!q) {
    return res.status(400).json({ error: 'Search query required' });
  }

  const results = {};
  const searchLimit = Math.ceil(parseInt(limit) / 3);

  if (type === 'all' || type === 'songs') {
    results.songs = await songService.searchSongs(q, searchLimit);
  }

  if (type === 'all' || type === 'users') {
    results.users = await userService.searchUsers(q, searchLimit);
  }

  if (type === 'all' || type === 'playlists') {
    results.playlists = await playlistService.searchPlaylists(q, searchLimit);
  }

  res.json(results);
}));

// Trending
router.get('/trending', asyncHandler(async (req, res) => {
  const { limit = 20 } = req.query;
  const trending = {
    songs: await songService.getTrendingSongs(parseInt(limit)),
  };
  res.json(trending);
}));

export { router };
