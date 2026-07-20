# MileyMusics 🎵

A fully independent, production-ready music streaming platform with Supabase backend and Express API.

**Migrated from Whacka platform** — now complete with standalone backend, database, and authentication!

## Features ✨

- 🎵 **Music Streaming**: Upload, discover, and share music
- 👥 **Social**: Follow artists, like songs, comments, playlists
- 💬 **Messaging**: Real-time direct messages
- 🎤 **Voice Rooms**: Listening parties and live sessions
- 💳 **Payments**: Stripe integration for MiLey+ subscriptions
- 🤖 **AI Generation**: OpenAI-powered song creation
- 🔐 **Auth**: Supabase Auth with email/password and Google OAuth
- 🌐 **Real-time**: Supabase Realtime for live updates
- 📱 **Push Notifications**: Firebase Cloud Messaging
- 🎨 **Responsive UI**: Beautiful Tailwind CSS design

## Project Structure

```
mileymusics/
├── src/                          # Frontend React application
│   ├── components/              # Reusable UI components
│   ├── pages/                   # Page components
│   ├── hooks/                   # Custom React hooks
│   ├── context/                 # React Context providers
│   ├── lib/                     # Client SDK implementations
│   │   ├── auth.js             # Supabase Auth
│   │   ├── db.js               # Backend API client
│   │   ├── storage.js          # Supabase Storage
│   │   ├── realtime.js         # Real-time subscriptions
│   │   ├── messaging.js        # Messaging API
│   │   └── ...                 # Other services
│   ├── App.jsx                  # Main app component
│   └── main.jsx                 # Entry point
├── backend/                      # Express.js REST API
│   ├── src/
│   │   ├── index.js            # Express server
│   │   ├── controllers/        # Request handlers
│   │   ├── routes/             # API routes
│   │   ├── services/           # Business logic
│   │   │   ├── auth.js         # Authentication
│   │   │   ├── user.js         # User management
│   │   │   ├── song.js         # Song management
│   │   │   ├── playlist.js     # Playlist management
│   │   │   ├── media.js        # Storage & messaging
│   │   │   ├── content.js      # Comments & search
│   │   │   └── subscription.js # Payments
│   │   ├── middleware/         # Express middleware
│   │   └── utils/              # Utilities
│   ├── migrations/              # Database migrations
│   ├── seeds/                   # Seed data
│   └── package.json
├── package.json                 # Frontend dependencies
├── vite.config.js              # Vite configuration
├── tailwind.config.js          # Tailwind configuration
└── .env.example                # Environment template
```

## Quick Start

### Prerequisites
- Node.js >= 18.0.0
- Supabase account (free at supabase.com)
- PostgreSQL (via Supabase)
- Redis (for job queue)

### Frontend Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your Supabase credentials
   ```

3. **Run development server**
   ```bash
   npm run dev
   ```

### Backend Setup

1. **Navigate to backend**
   ```bash
   cd backend
   npm install
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

3. **Setup database**
   ```bash
   # Run migrations in Supabase SQL Editor
   psql -h db.project.supabase.co -U postgres < migrations/001_init_schema.sql
   psql -h db.project.supabase.co -U postgres < migrations/002_rls_policies.sql
   psql -h db.project.supabase.co -U postgres < migrations/003_triggers.sql
   ```

4. **Start server**
   ```bash
   npm run dev      # Development
   npm start        # Production
   ```

## Deployment

### Frontend (Vercel/Netlify)
- Connect repository
- Set environment variables
- Deploy with `npm run build`

### Backend (Railway/Render/Fly.io)
- Set environment variables
- Database: Use Supabase PostgreSQL
- Cache: Use Redis addon
- Deploy with `npm start`

## API Documentation

### Base URL
- Development: `http://localhost:5000`
- Production: `https://api.mileymusics.com`

### Authentication
All authenticated endpoints require:
```
Authorization: Bearer {access_token}
```

### Key Endpoints

**Songs**
- `GET /api/songs` - List songs
- `POST /api/songs` - Create song
- `GET /api/songs/:id` - Get song
- `POST /api/songs/:id/like` - Like song
- `POST /api/songs/:id/play` - Record play

**Playlists**
- `GET /api/playlists` - List playlists
- `POST /api/playlists` - Create playlist
- `POST /api/playlists/:id/songs` - Add song

**Users**
- `GET /api/users/:id` - Get profile
- `PUT /api/users/:id` - Update profile
- `POST /api/users/:id/follow` - Follow user

**Search**
- `GET /api/search?q=query&type=all` - Search

See [backend/README.md](./backend/README.md) for complete API documentation.

## Configuration

### Environment Variables

**Frontend (.env.local)**
```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyxx...
VITE_BACKEND_URL=http://localhost:5000
```

**Backend (.env)**
```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=eyxx...
SUPABASE_SERVICE_KEY=eyxx...
SUPABASE_JWT_SECRET=xxxx
PORT=5000
STRIPE_SECRET_KEY=sk_test_xxxx
OPENAI_API_KEY=sk-xxxx
```

## Technology Stack

- **Frontend**: React 18, Vite, Tailwind CSS, Supabase JS
- **Backend**: Express.js, Supabase, PostgreSQL
- **Auth**: Supabase Auth, JWT
- **Database**: PostgreSQL with Row-Level Security
- **Storage**: Supabase Storage, Multer
- **Real-time**: Supabase Realtime (WebSockets)
- **Payments**: Stripe
- **AI**: OpenAI
- **Notifications**: Firebase Cloud Messaging
- **Logging**: Winston

## Development

### Build Frontend
```bash
npm run build
npm run preview
```

### Test Backend
```bash
cd backend
npm test
npm run test:watch
```

### Lint
```bash
npm run lint
```

## Database

### Migrations
All database schema is version-controlled in `backend/migrations/`:
- `001_init_schema.sql` - Core tables and indexes
- `002_rls_policies.sql` - Row-Level Security policies
- `003_triggers.sql` - Automated triggers and functions

### Connection
- Host: `{PROJECT}.supabase.co`
- Port: `5432`
- Database: `postgres`
- User: `postgres`

## API Documentation

### Postman Collection
Import `backend/MileyMusics-API.postman_collection.json` into Postman for interactive API testing.

## Performance

- Database indexes on frequently queried columns
- Connection pooling with Supabase
- Redis caching for frequently accessed data
- Pagination with 20 items per page default
- Full-text search on songs
- CDN for uploaded files

## Security

- ✅ Row-Level Security (RLS) policies
- ✅ JWT token validation
- ✅ CORS enabled and configurable
- ✅ Rate limiting (100 requests per 15 minutes)
- ✅ Helmet.js for HTTP headers
- ✅ Environment variables for secrets
- ✅ HTTPS/TLS in production

## Troubleshooting

### Frontend Issues
- Clear node_modules and package-lock.json
- Check environment variables are set
- Verify Supabase credentials are correct

### Backend Issues
- Check database migrations are applied
- Verify PostgreSQL connection
- Check environment variables
- Review error logs in `logs/` directory

### Database Issues
- Check Row-Level Security policies
- Verify JWT secret matches
- Check user ID is UUID format

## Contributing

1. Create feature branch
2. Make changes
3. Test thoroughly
4. Submit pull request

## License

MIT - See LICENSE file

## Support

For issues, questions, or feature requests:
- GitHub Issues: [Project Issues](https://github.com/Raghav549/mileymusics/issues)
- Documentation: [Full Docs](./docs/)
- API Docs: [Backend README](./backend/README.md)
