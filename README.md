# Smart URL Shortener

A full-stack URL shortener with user authentication, analytics, and QR codes.

- **Frontend**: Vite + React (JavaScript), plain CSS with a Material You (Material Design 3) design system — pill buttons, tonal surfaces, organic blur shapes, Roboto typography.
- **Backend**: Node.js + Express, MongoDB (Mongoose), Redis (node-redis), JWT authentication, bcrypt, rate limiting, QR code generation.

## Project Structure

```
.
├── client/                 # React frontend (Vite)
│   ├── src/
│   │   ├── components/     # Shared UI (Layout)
│   │   ├── context/        # AuthContext (token + user state)
│   │   ├── pages/          # Login, Register, Home, UrlDetails, Redirect
│   │   ├── api.js          # API client (fetch wrappers)
│   │   ├── App.jsx         # Routes
│   │   └── index.css       # Material You design tokens + styles
│   └── vite.config.js      # Dev server (port 3000) + /api proxy → 5174
└── server/                 # Express backend
    ├── config/             # database (MongoDB), redis
    ├── controllers/        # authController, urlController
    ├── middleware/         # auth, rateLimiter
    ├── models/             # User, Url
    ├── routes/             # authRoutes, urlRoutes
    ├── utils/              # generateShortCode
    ├── app.js
    └── server.js           # Entry point
```

## Features

- User registration and login (JWT, bcrypt-hashed passwords)
- Create short URLs (nanoid short codes, 7 chars)
- List "My URLs" with pagination
- Per-URL analytics: click count, status, created date
- Edit and delete your own URLs
- QR code per short URL (generated client-side)
- Public redirect: `/:shortCode` → original URL
- Redis caching on redirect, rate limiting on sensitive routes

## Prerequisites

- Node.js 18+
- npm
- A running MongoDB instance (local or Atlas)
- A running Redis instance (local or Redis Cloud)

## Local Setup

### 1. Backend

```bash
cd server
cp .env.example .env   # or create .env with the values below
npm install
PORT=5174 npm run dev  # nodemon; use `npm start` for plain node
```

`.env`:

```env
PORT=5174
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>/<db>?...
JWT_SECRET=your-secret
REDIS_URL=redis://default:<password>@<host>:<port>
```

> The client proxies `/api` to port `5174`, so run the backend with `PORT=5174` for local development.

### 2. Frontend

```bash
cd client
npm install
npm run dev
```

The app runs at http://localhost:3000 (Vite proxies `/api` to the backend on 5174).

## API Endpoints

| Method | Endpoint                   | Auth | Description                         |
| ------ | -------------------------- | ---- | ----------------------------------- |
| POST   | `/api/auth/register`       | —    | Register a new user                 |
| POST   | `/api/auth/login`          | —    | Login, returns JWT token            |
| GET    | `/api/auth/profile`        | ✓    | Current user profile                |
| POST   | `/api/url`                 | ✓    | Create a short URL                  |
| GET    | `/api/url/my-urls`         | ✓    | List your URLs (`page`, `limit`)    |
| PUT    | `/api/url/:shortCode`      | ✓    | Update a short URL                  |
| DELETE | `/api/url/:shortCode`      | ✓    | Delete a short URL                  |
| GET    | `/api/url/:shortCode/analytics` | ✓ | Analytics for a short URL           |
| GET    | `/api/url/:shortCode/qr`   | ✓    | Stored QR code for a short URL      |
| GET    | `/api/url/:shortCode`      | —    | Redirect to the original URL        |

Authenticated endpoints require a `Authorization: Bearer <token>` header.

## Deployment

Recommended: **Vercel** (frontend) + **Render** (backend). MongoDB and Redis are assumed to be hosted (Atlas, Redis Cloud, etc.).

### Backend → Render

1. Push the repo to GitHub.
2. Render → **New → Web Service** → connect the repo.
3. **Root Directory:** `server`
4. **Build Command:** `npm install` · **Start Command:** `node server.js`
5. Add environment variables: `MONGODB_URI`, `JWT_SECRET`, `REDIS_URL`. Leave `PORT` unset (Render injects it).
6. Deploy and note the URL, e.g. `https://smart-url-backend.onrender.com`.

> MongoDB Atlas: add `0.0.0.0/0` to network access (Render IPs are dynamic). If Redis connection fails, use a TLS URL (`rediss://...`).

### Frontend → Vercel

1. Add `client/vercel.json` that proxies `/api` to your Render backend and falls back to the SPA for everything else:

   ```json
   {
     "rewrites": [
       { "source": "/api/:path*", "destination": "https://smart-url-backend.onrender.com/api/:path*" },
       { "source": "/(.*)", "destination": "/index.html" }
     ]
   }
   ```

2. Vercel → **New Project** → import the repo.
3. **Root Directory:** `client` · Framework preset: Vite · Build: `npm run build` · Output: `dist`.
4. Deploy and note the URL, e.g. `https://smart-url-shortener.vercel.app`.

Short-link redirects work through the SPA catch-all (`/:shortCode`) → `/api/url/:shortCode` rewrite → backend 302 → original site.

## Notes

- The analytics page polls the backend every 5 seconds so the click counter updates in real time.
- `server/.env` ships with `PORT=5173` by default; override it with `PORT=5174` for local development to match the frontend proxy.
