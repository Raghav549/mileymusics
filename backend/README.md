# MileyMusics Backend API

Production-ready Express.js backend for MileyMusics music streaming platform.

## Features

- 🔐 **Authentication**: Supabase Auth with JWT, Google OAuth, Email/Password, OTP
- 🎵 **Music Management**: Songs, Albums, Playlists with full CRUD operations
- 👥 **Social Features**: Followers, Likes, Comments, Shares
- 💬 **Messaging**: Real-time messaging with Supabase Realtime
- 🎤 **Voice Rooms**: Listening parties and voice chat rooms
- ⭐ **Engagement**: Notifications, Trending, Search, Explore
- 💳 **Payments**: Stripe integration for MiLey+ subscriptions
- 🤖 **AI**: OpenAI integration for AI song generation
- 📊 **Analytics**: Play counts, downloads, engagement metrics
- 🔍 **Search**: Full-text search with PostgreSQL
- 🛡️ **Security**: Row-Level Security (RLS), rate limiting, CORS, helmet

## Tech Stack

- **Framework**: Express.js 4.18+
- **Database**: Supabase PostgreSQL
- **Authentication**: Supabase Auth
- **Storage**: Supabase Storage
- **Realtime**: Supabase Realtime (WebSockets)
- **Payment**: Stripe
- **File Processing**: Sharp, Multer
- **Job Queue**: Bull with Redis
- **Notifications**: Firebase Cloud Messaging
- **Logging**: Winston

## Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0
- Supabase Project (free tier available at supabase.com)
- Redis (for job queue and caching)
- Firebase Project (for push notifications)
- Stripe Account (for payments)
- Google OAuth Credentials (optional, for social login)
- SMTP Server (for email notifications)

## Installation

1. **Clone the repository**
```bash
git clone <repo-url>
cd backend
```

2. **Install dependencies**
```bash
npm install
```

3. **Setup Supabase**
   - Go to supabase.com and create a new project
   - Run migrations:
     ```bash
     # Using psql
     psql -h db.xxxx.supabase.co -U postgres < migrations/001_init_schema.sql
     psql -h db.xxxx.supabase.co -U postgres < migrations/002_rls_policies.sql
     psql -h db.xxxx.supabase.co -U postgres < migrations/003_triggers.sql
     ```

4. **Configure environment variables**
   - Copy `.env.example` to `.env`
   - Fill in all required variables
   - Get Supabase credentials from Project Settings

5. **Create Storage Buckets in Supabase**
   ```sql
   -- Run in Supabase SQL Editor
   INSERT INTO storage.buckets (id, name, public)
   VALUES 
     ('avatars', 'avatars', true),
     ('covers', 'covers', true),
     ('songs', 'songs', false),
     ('thumbnails', 'thumbnails', true),
     ('videos', 'videos', false),
     ('artists', 'artists', true),
     ('channels', 'channels', true),
     ('chat', 'chat', false),
     ('voice', 'voice', false),
     ('documents', 'documents', false),
     ('temp', 'temp', false);
   ```

6. **Start the server**
```bash
npm run dev        # Development with nodemon
npm start          # Production
```

Server runs on `http://localhost:5000` by default.

## Project Structure

```
backend/
├── src/
│   ├── index.js              # Express app setup
│   ├── controllers/          # Request handlers
│   ├── routes/               # API routes
│   ├── middleware/           # Custom middleware
│   ├── services/             # Business logic
│   │   ├── supabase.js      # Supabase clients
│   │   ├── auth.js          # Authentication
│   │   ├── storage.js       # File uploads
│   │   └── ...
│   └── utils/                # Utilities
│       ├── logger.js        # Winston logger
│       └── errors.js        # Error handling
├── migrations/              # Database migrations
├── seeds/                   # Seed data
├── .env.example            # Environment template
└── package.json
```

## API Documentation

### Authentication

**POST** `/api/auth/register`
- Register a new user
- Body: `{ email, password, username, full_name }`

**POST** `/api/auth/login`
- Login with email and password
- Body: `{ email, password }`

**POST** `/api/auth/logout`
- Logout user
- Requires: `Authorization: Bearer <token>`

**POST** `/api/auth/refresh`
- Refresh access token
- Body: `{ refresh_token }`

**POST** `/api/auth/google`
- Google OAuth login
- Body: `{ google_token }`

### Users

**GET** `/api/users/:id`
- Get user profile
- Optional: `Authorization: Bearer <token>`

**PUT** `/api/users/:id`
- Update user profile
- Requires: `Authorization: Bearer <token>`

**GET** `/api/users/:id/songs`
- Get user's songs

**GET** `/api/users/:id/playlists`
- Get user's playlists

**GET** `/api/users/:id/followers`
- Get user's followers

**POST** `/api/users/:id/follow`
- Follow a user
- Requires: `Authorization: Bearer <token>`

### Songs

**GET** `/api/songs`
- Get all songs with pagination
- Query: `page, limit, genre, sort`

**GET** `/api/songs/:id`
- Get song details

**POST** `/api/songs`
- Upload a new song
- Requires: `Authorization: Bearer <token>`
- Content-Type: `multipart/form-data`

**PUT** `/api/songs/:id`
- Update song details
- Requires: `Authorization: Bearer <token>`

**DELETE** `/api/songs/:id`
- Delete a song
- Requires: `Authorization: Bearer <token>`

**POST** `/api/songs/:id/like`
- Like a song
- Requires: `Authorization: Bearer <token>`

**DELETE** `/api/songs/:id/like`
- Unlike a song
- Requires: `Authorization: Bearer <token>`

**POST** `/api/songs/:id/play`
- Record a play
- Optional: `Authorization: Bearer <token>`

**POST** `/api/songs/:id/download`
- Download a song
- Requires: `Authorization: Bearer <token>`

### Playlists

**GET** `/api/playlists`
- Get user's playlists
- Requires: `Authorization: Bearer <token>`

**POST** `/api/playlists`
- Create a new playlist
- Requires: `Authorization: Bearer <token>`

**GET** `/api/playlists/:id`
- Get playlist details

**PUT** `/api/playlists/:id`
- Update playlist
- Requires: `Authorization: Bearer <token>`

**DELETE** `/api/playlists/:id`
- Delete playlist
- Requires: `Authorization: Bearer <token>`

**POST** `/api/playlists/:id/songs`
- Add song to playlist
- Requires: `Authorization: Bearer <token>`

**DELETE** `/api/playlists/:id/songs/:songId`
- Remove song from playlist
- Requires: `Authorization: Bearer <token>`

### Search

**GET** `/api/search`
- Search songs, albums, artists, playlists
- Query: `q, type (songs|albums|artists|playlists|users), limit`

### Notifications

**GET** `/api/notifications`
- Get user's notifications
- Requires: `Authorization: Bearer <token>`

**PUT** `/api/notifications/:id/read`
- Mark notification as read
- Requires: `Authorization: Bearer <token>`

### Messaging

**GET** `/api/messaging/conversations`
- Get user's conversations
- Requires: `Authorization: Bearer <token>`

**GET** `/api/messaging/conversations/:userId`
- Get conversation with specific user
- Requires: `Authorization: Bearer <token>`

**POST** `/api/messaging/messages`
- Send a message
- Requires: `Authorization: Bearer <token>`

### Rooms (Listening Parties)

**GET** `/api/rooms`
- Get active rooms
- Query: `type, limit`

**POST** `/api/rooms`
- Create a new room
- Requires: `Authorization: Bearer <token>`

**POST** `/api/rooms/:id/join`
- Join a room
- Requires: `Authorization: Bearer <token>`

**POST** `/api/rooms/:id/leave`
- Leave a room
- Requires: `Authorization: Bearer <token>`

### Payments

**GET** `/api/payments/subscription`
- Get current subscription
- Requires: `Authorization: Bearer <token>`

**POST** `/api/payments/subscribe`
- Create subscription
- Requires: `Authorization: Bearer <token>`
- Body: `{ tier }`

**POST** `/api/payments/webhook/stripe`
- Stripe webhook (public)

## Deployment

### Railway/Render

1. Connect GitHub repository
2. Set environment variables from `.env`
3. Configure build command: `npm install`
4. Configure start command: `npm start`
5. Add PostgreSQL addon (auto-detected from SUPABASE_URL)
6. Add Redis addon for job queue
7. Deploy

### Docker

```bash
docker build -t mileymusics-backend .
docker run -p 5000:5000 --env-file .env mileymusics-backend
```

### Vercel (with Serverless Functions)

Use `/api` routes with Vercel functions for serverless deployment.

## Development

### Running Tests
```bash
npm test
npm run test:watch
```

### Linting
```bash
npm run lint
```

### Database Migrations
```bash
# Create new migration
npm run migrate

# Seed database
npm run seed
```

## Rate Limiting

- Default: 100 requests per 15 minutes
- Configurable via `RATE_LIMIT_*` environment variables
- Rate limit errors return HTTP 429

## Error Handling

All errors follow this format:
```json
{
  "success": false,
  "message": "Error description"
}
```

## Security

- ✅ CORS enabled and configurable
- ✅ Helmet.js for HTTP headers
- ✅ Rate limiting with rate-limiter-flexible
- ✅ JWT token validation
- ✅ Row-Level Security (RLS) policies
- ✅ Input validation with Joi
- ✅ HTTPS/TLS in production
- ✅ Environment variables for sensitive data

## Performance

- Database indexes on all frequently queried columns
- Connection pooling with Supabase
- Redis caching for frequently accessed data
- Pagination support (20 items per page default)
- Full-text search on songs table
- CDN for uploaded files via Supabase Storage

## Troubleshooting

### Port already in use
```bash
lsof -i :5000
kill -9 <PID>
```

### Database connection errors
- Check SUPABASE_URL and keys in `.env`
- Ensure Supabase project is active
- Check network connectivity

### File upload issues
- Check Supabase Storage bucket permissions
- Verify file size limits
- Check allowed file formats

### Missing migrations
- Ensure all .sql files in `migrations/` are applied
- Check Supabase SQL Editor for errors

## Contributing

1. Create a feature branch
2. Make your changes
3. Run tests and lint
4. Submit a pull request

## License

MIT

## Support

For issues and questions, please create an issue in the GitHub repository.
