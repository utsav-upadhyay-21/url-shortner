# Smart URL Shortener — Complete Project DESCS
### Documentation · Explanation · Study Guide (Line-by-Line Edition)

> Written for absolute beginners who want to reach **interview-ready**.
> Every file is explained **line by line, in plain English**, with "why" for every decision.
> Stack: **Frontend** = Vite + React · **Backend** = Node.js + Express · **Database** = MongoDB (Mongoose) · **Cache** = Redis · **Auth** = JWT

---

## HOW TO READ THIS DOCUMENT

- **🟦 CODE BLOCK** → the actual file content (with line numbers).
- **👉 After each line/block** → explanation in plain English.
- **💡 Tip / 🚨 Gotcha** → special notes for interviews.
- If you are a complete beginner: read Phase 1 → Phase 4 → Phase 5. Then come back for Phases 6–13.
- If you are preparing for interviews: Phase 10–13 are your revision material.

---

# PHASE 1: PROJECT OVERVIEW

## 1.1 What is this project?

A **URL shortener** — a website like Bitly.

- You have a long, ugly link:
  `https://www.someblog.com/2026/08/how-to-cook-the-perfect-pasta-in-10-minutes-with-five-ingredients`
- You paste it into the app.
- The app gives you a tiny link: `https://yourdomain.com/aB3xY9z`
- Anyone who opens that tiny link **automatically lands on the long link**.
- The person who created the link can see **how many people clicked it** and get a **QR code** to share.

## 1.2 What real-world problem does it solve?

1. **Long URLs are hard to share** — they break in SMS/WhatsApp/tweets, and nobody can type them by hand.
2. **They are ugly in print** — a business card can't fit a 200-character URL, but `domain.com/xyz` fits.
3. **No tracking** — a company can't tell if a marketing link worked without a counter. This app counts clicks.
4. **Physical sharing** — the QR code lets someone scan the link off a poster or product.

## 1.3 Who uses it?

| User type | What they can do |
|-----------|------------------|
| **Guest / visitor** | Open a short link → get redirected. No account needed. |
| **Registered user** | Create short links, see click analytics, edit/delete their links, get QR codes. |
| **Admin (future)** | The `role` field exists (`user`/`admin`) but no admin features are built yet. |

## 1.4 Overall workflow (the big picture)

```
┌────────────┐     ┌───────────────┐     ┌──────────────────┐
│  Register  │ ──► │  Login → JWT  │ ──► │ Create short URL │
└────────────┘     └───────────────┘     └────────┬─────────┘
                                                   │ nanoid(7) code
                                                   │ QR code
                                                   ▼
                                          Share link anywhere
                                                   │
                                                   ▼
                                          Someone clicks it
                                                   │
                        ┌──────────────────────────┘
                        ▼
              Server checks Redis cache
                  ├─ HIT  → redirect (fast)
                  └─ MISS → MongoDB → cache it → redirect
                        ▼
                 Click counter +1
                        ▼
              Owner sees updated analytics (polls every 5s)
```

## 1.5 Two-minute interview explanation (memorize this)

> "I built a full-stack URL shortener, similar to Bitly, with user accounts, click analytics, and QR code generation. The frontend is a React app built with Vite, styled with a Material Design look. The backend is a Node.js Express REST API. Data lives in MongoDB with Mongoose, and Redis is used as a caching layer for the redirect path. Authentication uses JWT tokens, and passwords are stored as bcrypt hashes. When a user creates a link, the server generates a 7-character nanoid code, saves it, and returns the short URL plus a QR code. When someone clicks the short URL, the server first checks Redis — if the code is cached, we redirect immediately and skip the database; otherwise we query MongoDB, store the result in Redis, and redirect with a 302. Every click atomically increments a counter so owners see live analytics, and the frontend polls the server every five seconds to keep the count fresh. I also added rate limiting on login, registration, and URL creation to block abuse, and ownership checks so users can only edit or delete their own links. I deployed the frontend on Vercel and the backend on Render."

---

# PHASE 2: ARCHITECTURE (High-Level Design / HLD)

## 2.1 Component table

| Component | Technology | Why it exists |
|-----------|-----------|---------------|
| **Frontend (UI)** | Vite + React 18, React Router, plain CSS | Renders login, register, home, analytics screens |
| **Backend (API)** | Node.js + Express 5 | Handles every request: auth, URL CRUD, redirects |
| **Database** | MongoDB + Mongoose ODM | Persist users and URLs permanently |
| **Cache** | Redis (node-redis) | Fast redirect lookups; saves MongoDB from read pressure |
| **QR codes** | `qrcode` npm package | Generate a scannable image per short link |
| **Authentication** | `jsonwebtoken` (JWT) + `bcrypt` | Stateless login + secure password hashing |
| **Rate limiting** | `express-rate-limit` | Stops brute-force login and API abuse |
| **Deployment** | Vercel (frontend) + Render (backend) | Free-ish hosting for the SPA and API |

## 2.2 ASCII architecture diagram

```
                          ┌───────────────────────────────┐
                          │   BROWSER (React SPA)         │
                          │   Login / Register / Home     │
                          │   UrlDetails / Redirect       │
                          └───────────────┬───────────────┘
                                          │  /api/*  requests
                                          │  (Vite proxy in dev,
                                          │   Vercel rewrite in prod)
                                          ▼
                               ┌─────────────────────┐
                               │  EXPRESS API        │
                               │  app.js → routes    │
                               └──────┬──────────────┘
                                      │
                ┌─────────────────────┼──────────────────────┐
                ▼                     ▼                      ▼
        ┌──────────────┐      ┌──────────────┐      ┌──────────────┐
        │ authRoutes   │      │  urlRoutes    │      │  MIDDLEWARE  │
        │ /register    │      │  POST /       │      │  auth (JWT)  │
        │ /login       │      │  GET my-urls  │      │  rateLimiter │
        │ /profile     │      │  PUT/DELETE   │      └──────────────┘
        └──────┬───────┘      │  analytics/qr │
               │              │  GET /:code   │
               ▼              └──┬──────┬─────┘
        ┌──────────────┐         │      │
        │  CONTROLLERS │         ▼      ▼
        │ auth + url   │    ┌────────┐ ┌──────────┐
        │  ────────    │    │ REDIS  │ │ QRCODE   │
        │  MODELS      │    │ cache  │ │ (pkg)    │
        │  User, Url   │    └────────┘ └──────────┘
        └──────┬───────┘
               ▼
        ┌──────────────┐
        │   MONGODB    │
        └──────────────┘
```

## 2.3 Why each component exists (one-line answers)

- **Express** → the standard Node web framework; its middleware model lets us bolt on auth and rate limits per-route.
- **MongoDB** → JSON-shaped documents match our API output; no schema migration pain; easy to scale.
- **Redis** → the redirect is the hottest path; a Redis read is sub-millisecond vs a Mongo query, so caching there absorbs traffic spikes.
- **JWT** → stateless auth: any server instance can verify a token using the shared secret (perfect for horizontal scaling).
- **bcrypt** → salted + expensive hashing so stolen password hashes can't be cracked easily.
- **Rate limiting** → login endpoints are brute-force targets; the limiter throttles them.
- **qrcode** → lets short links live in the physical world (posters, cards).

---

# PHASE 3: END-TO-END FLOW (Step by step)

## 3.1 Flow A — User registers

```
1. User types name, email, password on /register
2. React onSubmit → api.register({name, email, password})
3. fetch POST → Vite proxy → Express → /api/auth/register
4. registerLimiter (10/hour) passes
5. authController.register runs:
     a. checks all fields present            → else 400
     b. User.findOne({email}) duplicate check → else 409
     c. bcrypt.hash(password, 10)
     d. User.create({name, email, password: hash})
6. Respond 201 { success, message, user:{id,name,email} }
7. React shows success → navigates to /login
```

## 3.2 Flow B — User logs in

```
1. User enters email + password on /login
2. api.login({email, password}) → POST /api/auth/login
3. loginLimiter (10/15min) passes
4. authController.login:
     a. fields present?                      → else 400
     b. User.findOne({email})                → else 401 (same message)
     c. bcrypt.compare(password, hash)       → else 401
     d. jwt.sign({id,email,role}, SECRET, {expiresIn:"7d"})
5. Respond 200 { success, token, user }
6. AuthContext.login() stores token+user in localStorage
7. React navigates to "/" (Home)
```

## 3.3 Flow C — User creates a short URL

```
1. User pastes long URL on Home and clicks "Shorten"
2. api.createUrl(originalUrl, token) → POST /api/url  (+ Bearer token)
3. auth middleware verifies JWT → req.user = decoded
4. createUrlLimiter (100/min) passes
5. urlController.createShortUrl:
     a. originalUrl present?        → else 400
     b. validator.isURL check       → else 400
     c. generateShortCode() = nanoid(7) → e.g. "aB3xY9z"
     d. Url.create({originalUrl, shortCode, createdBy:user.id})
     e. QRCode.toDataURL(shortUrl) → data URL string
     f. url.qrCode = qrData; url.save()
6. Respond 201 { success, data:{originalUrl, shortCode, shortUrl, qrCode} }
7. Home reloads "My URLs" list → new link appears
```

## 3.4 Flow D — Someone clicks the short link (the HOT path)

```
1. Browser visits  https://host/aB3xY9z
2. React Router matches "/:shortCode" → renders <Redirect/>
3. Redirect.jsx → window.location.replace("/api/url/aB3xY9z")
4. (dev) Vite proxy / (prod) Vercel rewrite → Express GET /api/url/aB3xY9z
5. redirectLimiter (1000/min) passes
6. urlController.redirectUrl:
     a. redisClient.get("aB3xY9z")
     b. CACHE HIT → JSON.parse → Url.updateOne({$inc:{clicks:1}})
                     → res.redirect(originalUrl)   [302]
     c. CACHE MISS → Url.findOne({shortCode})
                      → 404 if missing
                      → 403 if !isActive
                      → 410 if expired
                    → redisClient.set(code, {originalUrl})
                    → Url.updateOne({$inc:{clicks:1}})
                    → res.redirect(originalUrl)    [302]
7. Browser follows 302 → lands on the original website
```

## 3.5 Flow E — View / edit / delete

```
View     GET  /api/url/:code/analytics → ownership check → {clicks, status, dates}
         (UrlDetails polls every 5s so the counter looks "live")

Edit     PUT  /api/url/:code → find → 404 → owner check → 403
         → validate → save → redisClient.del(code) [invalidate cache] → 200

Delete   DELETE /api/url/:code → find → 404 → owner check → 403
         → findOneAndDelete → redisClient.del(code) → 200
```

---

# PHASE 4: FOLDER STRUCTURE & DEPENDENCY MAP

## 4.1 Full tree

```
url-shortner/
├── README.md                      # Setup guide + API table + deployment steps
│
├── client/                        # ════ FRONTEND (React + Vite) ════
│   ├── index.html                 # HTML shell; Vite injects React here
│   ├── vite.config.js             # Dev config: port 3000, /api proxy → 5174
│   ├── vercel.json                # Prod config: /api → Render, else index.html
│   ├── .env                       # VITE_API_URL (points to Render backend)
│   ├── package.json               # List of frontend dependencies + scripts
│   └── src/
│       ├── main.jsx               # React entry point (renders the app)
│       ├── App.jsx                # Route table + protected routes
│       ├── api.js                 # All fetch() calls live here (1 wrapper)
│       ├── index.css              # All styles (Material You theme)
│       ├── context/
│       │   └── AuthContext.jsx    # Global auth state (token, user, login, logout)
│       ├── components/
│       │   └── Layout.jsx         # Shared header + logout button wrapper
│       └── pages/
│           ├── Home.jsx           # Create form + "My URLs" list
│           ├── Login.jsx          # Sign-in form
│           ├── Register.jsx       # Sign-up form
│           ├── UrlDetails.jsx     # Analytics, edit, delete, QR code
│           └── Redirect.jsx       # Catch-all: /:shortCode → backend redirect
│
└── server/                        # ════ BACKEND (Express) ════
    ├── server.js                  # Entry point: connects DB+Redis, starts server
    ├── app.js                     # Express app: CORS, JSON, mounts routes
    ├── .env                       # ⚠️ SECRETS (see security warning)
    ├── package.json               # Backend dependencies + scripts
    ├── config/
    │   ├── database.js            # Mongoose → MongoDB connection
    │   └── redis.js               # Redis client singleton
    ├── middleware/
    │   ├── auth.js                # Verifies JWT → req.user
    │   ├── rateLimiter.js         # Login/register/create/redirect limits
    │   └── errorHandler.js        # (EMPTY — placeholder, not used)
    ├── models/
    │   ├── User.js                # Mongoose schema for users
    │   └── Url.js                 # Mongoose schema for short URLs
    ├── controllers/
    │   ├── authController.js      # register, login, profile logic
    │   └── urlController.js       # create/redirect/list/update/delete/analytics/qr
    ├── routes/
    │   ├── authRoutes.js          # Maps /api/auth/* URLs to handlers
    │   └── urlRoutes.js           # Maps /api/url/* URLs to handlers
    └── utils/
        ├── generateShortCode.js   # nanoid(7) helper
        └── validateUrl.js         # (EMPTY — placeholder, not used)
```

## 4.2 Dependency map (who imports whom)

```
server.js
  ├─ app.js
  │    ├─ routes/authRoutes.js → authController.js → models/User.js
  │    │                         + middleware/auth.js, rateLimiter.js
  │    └─ routes/urlRoutes.js  → urlController.js → models/Url.js
  │                              + utils/generateShortCode.js
  │                              + config/redis.js
  ├─ config/database.js
  └─ config/redis.js

client/src/main.jsx
  ├─ context/AuthContext.jsx
  └─ App.jsx → pages/* + context/AuthContext.jsx
pages/* → components/Layout.jsx, context/AuthContext.jsx, api.js
api.js → backend API endpoints
```

## 4.3 Purpose of each folder & what breaks if removed

| Folder | Purpose | If removed |
|--------|---------|------------|
| `server/config/` | Centralize infra wiring (Mongo, Redis) | Server can't boot; connection code duplicated |
| `server/middleware/` | Cross-cutting logic (auth, limits) | Every route re-implements JWT checks → auth breaks |
| `server/models/` | Define DB schemas | No data shape → garbage/corrupt data |
| `server/controllers/` | Business logic for each request | Routes become huge unreadable handlers |
| `server/routes/` | URL → handler mapping | No HTTP API at all |
| `server/utils/` | Small pure helper functions | Short-code logic scattered in controllers |
| `client/src/context/` | Global auth state | Token managed per-page → state sync bugs |
| `client/src/components/` | Reusable UI shell | Header/logout duplicated on every page |
| `client/src/pages/` | Screen components | Nothing renders |
| `client/src/api.js` | Single HTTP gateway | Every page re-implements fetch + errors |

---

# PHASE 5: FILE-BY-FILE, LINE-BY-LINE EXPLANATION

> How to read this section: each code line is explained under it. Read the whole file first (top to bottom), then read the explanations. "Line numbers" match the actual files.

## ══════════════ SERVER SIDE ══════════════

## 5.1 `server/server.js` — the entry point

**Purpose**: Boots the application. Connects to MongoDB and Redis FIRST, and only after both succeed starts accepting HTTP requests.

**When it runs**: whenever you run `npm start` or `npm run dev` inside the `server/` folder.

**Who calls it**: npm / Node directly (`node server.js`).

```js
 1  require("dotenv").config();
```

👉 **Line 1**: Loads the `.env` file into `process.env`. `dotenv` reads a file named `.env` in the current folder and copies its contents (`PORT=5174`, `MONGODB_URI=...`, etc.) into Node's `process.env` object. From now on we can read them as `process.env.MONGODB_URI`. Without this line, all the environment variables would be `undefined`.

```js
 2
 3  const app = require("./app");
```

👉 **Line 3**: Loads the Express application from `app.js`. Notice `./app` (no `.js`) — Node automatically appends `.js`. `app` is the fully-configured Express server object (routes, middleware, everything).

```js
 4
 5  const connectDatabase = require("./config/database");
```

👉 **Line 5**: Loads the `connectDatabase` function from `config/database.js`. That file exports one function, and here we grab it into a variable so we can call it below.

```js
 6
 7  const redisClient = require("./config/redis");
```

👉 **Line 7**: Loads the Redis client from `config/redis.js`. This is a **singleton** — a single shared connection that every other file (`urlController.js`) also imports, so there's only ONE Redis connection for the whole app.

```js
 8
 9  const PORT = process.env.PORT || 5000;
```

👉 **Line 9**: The port the server will listen on. If `.env` has `PORT=5174`, it uses 5174. If `PORT` is missing, the fallback is `5000`. `||` means "use the left side if it is truthy, otherwise use the right side." (Render, in production, injects its own `PORT`.)

```js
10
11  async function startServer(){
12
13      try{
```

👉 **Lines 11–13**: Declares an `async` function (because we need to `await` network connections) and starts a `try` block — if anything inside throws an error, it jumps to `catch`.

```js
14
15          await connectDatabase();
```

👉 **Line 15**: Connects to MongoDB. We `await` — the server **pauses here** until the connection either succeeds or throws. We deliberately block startup on the DB so we never run "half-connected."

```js
16
17          await redisClient.connect();
```

👉 **Line 17**: Connects to Redis. Again we `await`. Redis is critical for the redirect hot-path, so we want it up before serving traffic.

```js
18
19          console.log("Redis Connected");
```

👉 **Line 19**: Logs a confirmation message to the terminal (the console). Useful for debugging — you can see the server booted in order.

```js
20
21          app.listen(PORT,()=>{
22
23              console.log(`Server running on port ${PORT}`);
24
25          });
```

👉 **Lines 21–25**: `app.listen(PORT, callback)` tells Express to start listening for HTTP requests on that port. The callback runs **after** the server is listening and prints a friendly message. Note the backtick template literal `${PORT}` — it inserts the variable's value into the string.

```js
26
27      }
28
29      catch(error){
30
31          console.error(error);
32
33          process.exit(1);
34
35      }
36
37  }
```

👉 **Lines 27–35**: The `catch` block runs if `connectDatabase()` or `redisClient.connect()` fails. It prints the error and calls `process.exit(1)` — the `1` means "exit with an error code." This makes the process crash loudly rather than running without a database. If this app runs under Docker/Render, the orchestrator will see the crash and restart it.

```js
38
39  startServer();
```

👉 **Line 39**: Actually runs the function. This is the moment the server starts. Everything above was just *definition*; this line *executes*.

### 💡 Interview tip for `server.js`
- **Fail-fast design**: the app refuses to start unless both Mongo and Redis connect. You can contrast this with a "start anyway and retry" design — both are valid; this one is simpler and safer for a demo.
- `process.exit(1)` is how you signal a non-zero (failed) exit to the OS/orchestrator.

---

## 5.2 `server/app.js` — the Express application

**Purpose**: Creates and configures the Express app, adds global middleware (CORS, JSON body parsing), and mounts the route modules. It does NOT start listening — that's `server.js`'s job. Separating them makes testing easier (tests can import `app` without opening a port).

```js
 1  const express = require("express");
```

👉 **Line 1**: Imports the Express library.

```js
 2  const cors = require("cors");
```

👉 **Line 2**: Imports CORS (Cross-Origin Resource Sharing). By default, browsers block a website at `localhost:3000` from calling an API at `localhost:5174` (different "origin" = different port). CORS middleware tells the browser "this API is OK to call from other origins."

```js
 3
 4  const app = express();
```

👉 **Line 4**: Calls the `express()` factory function → creates the `app` object we configure below.

```js
 5
 6  app.use(cors());
```

👉 **Line 6**: Mounts the CORS middleware globally on EVERY request. `cors()` with no arguments means "allow all origins" (`Access-Control-Allow-Origin: *`). 🚨 For production you should pass an object like `cors({ origin: "https://your-site.com" })` to lock it down. This is a known improvement.

```js
 7  app.use(express.json());
```

👉 **Line 7**: Middleware that reads the request body, and if it's JSON (`Content-Type: application/json`), parses it into a JavaScript object and attaches it to `req.body`. Without this, `req.body` would be `undefined` and every POST would break.

```js
 8
 9  const authRoutes = require("./routes/authRoutes");
10
11  const urlRoutes = require("./routes/urlRoutes");
```

👉 **Lines 9–11**: Imports the two route modules (they each export an Express `Router`).

```js
12
13  app.use("/api/auth", authRoutes);
```

👉 **Line 13**: Mounts all auth routes under the `/api/auth` prefix. Any request like `/api/auth/register` or `/api/auth/login` gets forwarded to the `authRoutes` router, which then matches the rest of the path.

```js
14
15  app.use("/api/url", urlRoutes);
```

👉 **Line 15**: Same for URL routes — everything starting with `/api/url` goes to the `urlRoutes` router.

```js
16
17  app.get("/", (req, res) => {
18
19      res.json({
20
21          success: true,
22
23          message: "Smart URL Shortener API"
24
25      });
26
27  });
```

👉 **Lines 17–27**: A simple **health check** route. Visiting the root URL (`http://localhost:5174/`) returns a small JSON object so you can quickly verify the API is alive. `res.json(...)` sends a JSON response.

```js
28
29  module.exports = app;
```

👉 **Line 29**: Exports the configured `app` so `server.js` can import it. `module.exports` is how Node.js shares code between files.

### 💡 Interview tip for `app.js`
- Middleware order matters: `cors()` and `express.json()` run on every request **before** they reach routes.
- The root route is your "ping" endpoint — a good pattern for uptime monitoring.
- `helmet` is installed in package.json but **never used** here — a real security gap to mention (helmet sets safe HTTP headers).

---

## 5.3 `server/config/database.js` — MongoDB connection

**Purpose**: A single reusable function that connects Mongoose to MongoDB and logs success or crashes the app on failure.

```js
 1  const mongoose = require("mongoose");
```

👉 **Line 1**: Imports Mongoose — the ODM (Object Document Mapper). It lets us talk to MongoDB using JavaScript objects + schemas instead of raw MongoDB syntax.

```js
 2
 3  const connectDatabase = async () => {
```

👉 **Line 3**: Declares an `async` arrow function. `async` means we can use `await` inside.

```js
 4
 5      try {
 6
 7          await mongoose.connect(process.env.MONGODB_URI);
```

👉 **Lines 5–7**: Inside a `try`. `mongoose.connect(URL)` opens a connection pool to MongoDB. We read the connection string from `process.env.MONGODB_URI` (loaded by dotenv in `server.js`). The connection string contains the server address, database name, and credentials. We `await` it — this line only finishes when connected (or fails).

```js
 8
 9          console.log("MongoDB Connected");
```

👉 **Line 9**: Success message to the console.

```js
10
11      }
12
13      catch(error){
14
15          console.error("MongoDB Connection Failed");
16
17          console.error(error.message);
18
19          process.exit(1);
20
21      }
22
23  };
```

👉 **Lines 11–21**: If connecting fails, print a clear message + the actual error, then `process.exit(1)` — crash. No point running an API with no database.

```js
24
25  module.exports = connectDatabase;
```

👉 **Line 25**: Exports the function so `server.js` can import and call it.

### 💡 Why a separate file?
Single Responsibility: `server.js` doesn't need to know *how* to connect to Mongo — it just calls `connectDatabase()`. Any future code can also import this (e.g., a seed script).

---

## 5.4 `server/config/redis.js` — Redis client

**Purpose**: Creates ONE shared Redis client (a singleton) and attaches an error listener. Every file that needs Redis imports this same client.

```js
 1  const { createClient } = require("redis");
```

👉 **Line 1**: Imports `createClient` from the `redis` package (node-redis v6). This is the factory that creates a Redis client.

```js
 2
 3  const redisClient = createClient({
 4
 5      url: process.env.REDIS_URL
 6
 7  });
```

👉 **Lines 3–7**: Creates the client and configures it with the connection URL from the environment. No actual connection happens yet — connecting is explicit (`redisClient.connect()` in `server.js`).

```js
 8
 9  redisClient.on("error",(err)=>{
10
11      console.error("Redis Error:",err);
12
13  });
```

👉 **Lines 9–13**: Attaches an **error handler**. If Redis goes down *after* startup, the client emits an `"error"` event. Without a listener, an unhandled event would **crash the whole Node process**. Here we just log it — so the API keeps running and falls back to MongoDB queries for redirects. This is deliberate graceful degradation.

```js
14
15  module.exports = redisClient;
```

👉 **Line 15**: Exports the shared client.

### 💡 Interview tip
Compare this to `database.js`: DB failure = crash (fatal), Redis failure = log only (non-fatal). That asymmetry is a design decision: Mongo holds the source of truth; Redis is only a performance accelerator, so its loss shouldn't kill the app.

---

## 5.5 `server/models/User.js` — the User schema

**Purpose**: Defines the shape of a `users` document in MongoDB, plus validation rules.

```js
 1  const mongoose = require("mongoose");
 2
 3  const userSchema = new mongoose.Schema({
```

👉 **Lines 1–3**: Import Mongoose, then create a new Schema object. A schema is a *blueprint* — it tells Mongoose what fields a user document can have and what types they are.

```js
 4
 5      name:{
 6
 7          type:String,
 8
 9          required:true,
10
11          trim:true
12
13      },
```

👉 **Lines 5–13**: `name` field.
- `type: String` → must be a string.
- `required: true` → every user MUST have a name; Mongo/Mongoose will reject documents without it.
- `trim: true` → Mongoose removes leading/trailing whitespace automatically (so `"  John  "` becomes `"John"`).

```js
14
15      email:{
16
17          type:String,
18
19          required:true,
20
21          unique:true,
22
23          lowercase:true
24
25      },
```

👉 **Lines 15–25**: `email` field.
- `unique: true` → creates a **unique index** in MongoDB. Two users cannot have the same email. This is enforced at the database level (even if application code forgets to check).
- `lowercase: true` → automatically lowercases the value on save, so `John@Gmail.com` becomes `john@gmail.com`. Prevents duplicate accounts that differ only by case.

```js
26
27      password:{
28
29          type:String,
30
31          required:true
32
33      },
```

👉 **Lines 27–33**: `password` field. ⚠️ IMPORTANT: this stores the **bcrypt hash**, never the plain password. (The controller hashes before saving.)

```js
34
35      role:{
36
37          type:String,
38
39          enum:["user","admin"],
40
41          default:"user"
42
43      }
44
45  },{
46
47      timestamps:true
48
49  });
```

👉 **Lines 35–49**:
- `role` → string that must be one of `"user"` or `"admin"` (`enum` = "allowed values"). Defaults to `"user"`. It's the hook for future admin features.
- `timestamps: true` → Mongoose **automatically adds** `createdAt` and `updatedAt` fields and manages them for you. Zero manual code.

```js
50
51  module.exports = mongoose.model("User",userSchema);
```

👉 **Line 51**: Compiles the schema into a **model** named `"User"`. A model is the object you actually use to query/insert: `User.create(...)`, `User.findOne(...)`. MongoDB collection name becomes `users` (Mongoose pluralizes by default).

### 💡 Interview tip
- `unique: true` = an index, not just validation. It's what makes `User.findOne({email})` fast in `authController`.
- Never return the `password` field in API responses (controllers intentionally strip it).

---

## 5.6 `server/models/Url.js` — the Url schema

**Purpose**: Defines the shape of a short-link document.

```js
 1  const mongoose = require("mongoose");
 2
 3  const urlSchema = new mongoose.Schema({
 4
 5      originalUrl: {
 6          type: String,
 7          required: true
 8      },
```

👉 **Lines 5–8**: `originalUrl` — the long URL the user pasted. Required.

```js
 9
10      shortCode: {
11          type: String,
12          required: true,
13          unique: true
14      },
```

👉 **Lines 10–14**: `shortCode` — the random 7-character code (e.g., `aB3xY9z`).
- `required: true` → every URL must have one.
- `unique: true` → creates a unique index; **this is the key that makes redirect lookup fast and collision-free at the DB level**.

```js
15
16      clicks: {
17          type: Number,
18          default: 0
19      },
```

👉 **Lines 16–19**: `clicks` — how many times the short link was opened. Starts at `0` (the default). It's incremented with `$inc` during redirects.

```js
20
21      createdBy: {
22          type: mongoose.Schema.Types.ObjectId,
23          ref: "User",
24          required: true
25      },
```

👉 **Lines 21–25**: `createdBy` — who created this link.
- Type is `ObjectId` → it stores the `_id` of a user document.
- `ref: "User"` → tells Mongoose which model this ID refers to. This is a **foreign key / relationship** (MongoDB doesn't have real FK constraints, so this is a "logical" link).
- `required: true` → every URL must belong to a user.

```js
26
27      isActive: {
28          type: Boolean,
29          default: true
30      },
```

👉 **Lines 27–30**: `isActive` — soft on/off switch. Default `true`. The redirect function refuses to redirect inactive links (403). Enables "disable a link" without deleting it.

```js
31
32      expiresAt: {
33          type: Date,
34          default: null
35      },
```

👉 **Lines 32–35**: `expiresAt` — optional expiry date. Default `null` = never expires. The redirect checks it: past expiry → 410 Gone.

```js
36
37      qrCode: {
38          type: String,
39          default: null
40      }
41
42  }, {
43      timestamps: true
44  });
```

👉 **Lines 37–44**:
- `qrCode` → stores the QR code image as a **data URL string** (e.g., `data:image/png;base64,iVBOR...`). Generated once at creation, saved here.
- `timestamps: true` → auto `createdAt` / `updatedAt`.

```js
45
46  module.exports = mongoose.model("Url", urlSchema);
```

👉 **Line 46**: Compiles the model. Collection name: `urls`.

### 💡 Relationship mental model
```
User (1)  ─── owns ───►  many Url (N)
                       createdBy = User._id
```
The "N" side (Url) stores the "1" side's ID. This is a classic **one-to-many** relationship implemented with a reference.

---

## 5.7 `server/controllers/authController.js` — register / login / profile

**Purpose**: Contains the business logic for authentication. Controllers receive `(req, res)`, do the work, and respond with HTTP status codes + JSON.

**Files that call it**: `routes/authRoutes.js`. **Files it depends on**: `models/User.js`, plus `bcrypt` and `jsonwebtoken`.

### 5.7a The `register` function (lines 5–101)

```js
 1  const bcrypt = require("bcrypt");
```

👉 **Line 1**: Imports bcrypt. It provides `hash()` (to encrypt passwords) and `compare()` (to check a password against a hash). bcrypt is a deliberately slow, salted hashing algorithm designed for passwords.

```js
 2  const jwt = require("jsonwebtoken");
```

👉 **Line 2**: Imports jsonwebtoken, which creates (`sign`) and verifies (`verify`) JWTs.

```js
 3  const User = require("../models/User");
```

👉 **Line 3**: Imports the User model so we can query/insert users. Note `../` — from `controllers/` we go up one folder to the `server/` root, then into `models/`.

```js
 4
 5  const register = async(req,res)=>{
```

👉 **Line 5**: Declares the `register` controller. `async` because it awaits DB + bcrypt calls. `req` = incoming request object, `res` = outgoing response object.

```js
 6
 7      try{
```

👉 **Line 7**: Everything inside `try` — any thrown error jumps to `catch` (line 91).

```js
 8
 9          const{
10
11              name,
12
13              email,
14
15              password
16
17          }=req.body;
```

👉 **Lines 9–17**: **Destructuring** — pulls `name`, `email`, `password` out of `req.body` (which was parsed by `express.json()` in app.js). This is just shorthand for `const name = req.body.name;` etc.

```js
18
19          if(
20
21              !name ||
22
23              !email ||
24

25              !password
26
27          ){
28
29              return res.status(400).json({
30
31                  message:"All fields are required"
32
33              });
34
35          }
```

👉 **Lines 19–35**: Validation. `!name` means "name is falsy" (missing, empty string, `undefined`...). If ANY field is missing → respond with HTTP **400 Bad Request** and a JSON message. The `return` is crucial — it stops the function right here, so the code below never runs.

```js
36
37          const existingUser = await User.findOne({
38
39              email
40
41          });
```

👉 **Lines 37–41**: Queries MongoDB: "is there a user with this email?" `User.findOne({ email })` returns the first matching document, or `null` if none. `await` waits for the database to answer.

```js
42
43          if(existingUser){
44
45              return res.status(409).json({
46
47                  message:"Email already exists"
48
49              });
50
51          }
```

👉 **Lines 43–51**: If a user already exists → HTTP **409 Conflict** ("you're trying to create something that already exists"). The unique index in the schema would also block this, but we check first so we can return a *friendly* message instead of a DB error.

```js
52
53          const hashedPassword = await bcrypt.hash(
54
55              password,
56
57              10
58
59          );
```

👉 **Lines 53–59**: `bcrypt.hash(password, 10)` — the `10` is the **cost factor** (how many rounds of hashing, = 2¹⁰ iterations). Higher cost = slower = harder for attackers to brute-force, but slower for users too. `10` is a reasonable default. bcrypt also adds a random **salt** internally, so two users with the same password get different hashes.

```js
60
61          const user = await User.create({
62
63              name,
64
65              email,
66
67              password:hashedPassword
68
69          });
```

👉 **Lines 61–69**: Creates the user document in MongoDB. Notice we store `hashedPassword`, NOT the raw password. `User.create()` is a Mongoose convenience = `new User(...) + save()`.

```js
70
71          res.status(201).json({
72
73              success:true,
74
75              message:"User Registered",
76
77              user:{
78
79                  id:user._id,
80
81                  name:user.name,
82
83                  email:user.email
84
85              }
86
87          });
```

👉 **Lines 71–87**: Responds **201 Created** with a success object. Notice what we send: only `id`, `name`, `email`. **We deliberately do NOT send the password hash** — that would leak sensitive data.

```js
88
89      }
90
91      catch(error){
92
93          res.status(500).json({
94

95              message:error.message
96
97          });
98
99      }
100
101  };
```

👉 **Lines 89–101**: If anything above throws (e.g., DB timeout, duplicate-key race condition), we respond **500 Internal Server Error** with the error message. `error.message` leaks internals in dev — in production you'd want a generic message + logged details.

### 5.7b The `login` function (lines 102–220)

```js
102  const login = async(req,res)=>{
103
104      try{
105
106          const{
107
108              email,
109
110              password
111
112          }=req.body;
```

👉 **Lines 102–112**: Same pattern — extract `email` and `password` from the request body.

```js
113
114          if(
115
116              !email ||
117
118              !password
119
120          ){
121
122              return res.status(400).json({
123
124                  message:"Email and Password are required"
125
126              });
127
128          }
```

👉 **Lines 114–128**: Basic presence check → 400 if either is missing.

```js
129
130          const user = await User.findOne({
131
132              email
133
134          });
135
136          if(!user){
137
138              return res.status(401).json({
139
140                  message:"Invalid Email or Password"
141
142              });
143
144          }
```

👉 **Lines 130–144**: Find the user by email. If not found → **401 Unauthorized** with the message **"Invalid Email or Password"**. 🚨 Deliberate: this exact message is ALSO used for wrong passwords (see below) so an attacker can't tell whether an email exists (prevents **user enumeration**).

```js
145
146          const isMatch = await bcrypt.compare(
147
148              password,
149
150              user.password
151
152          );
```

👉 **Lines 146–152**: `bcrypt.compare(plainPassword, storedHash)` — bcrypt re-hashes the input with the stored salt and compares. Returns `true` or `false`. Because of the built-in salt, we never compare plaintext directly.

```js
153
154          if(!isMatch){
155
156              return res.status(401).json({
157
158                  message:"Invalid Email or Password"
159
160              });
161
162          }
```

👉 **Lines 154–162**: Wrong password → **same 401 message**. (Anti-enumeration, as explained above.)

```js
163
164          const token = jwt.sign(
165
166              {
167
168                  id:user._id,
169
170                  email:user.email,
171
172                  role:user.role
173
174              },
175
176              process.env.JWT_SECRET,
177
178              {
179
180                  expiresIn:"7d"
181
182              }
183
184          );
```

👉 **Lines 164–184**: Creates the JWT.
- **Payload** (first arg): `{ id, email, role }` — data we want available later. `id` is critical (used for ownership checks).
- **Secret** (second arg): `process.env.JWT_SECRET` — the key used to sign. Only servers that know the secret can create or verify tokens.
- **Options** (third arg): `expiresIn: "7d"` — token auto-expires after 7 days.

The result is a string like `eyJhbGciOi...` with three dot-separated parts (header.payload.signature).

```js
185
186          res.status(200).json({
187
188              success:true,
189
190              message:"Login Successful",
191
192              token,
193
194              user:{
195
196                  id:user._id,
197
198                  name:user.name,
199
200                  email:user.email,
201
202                  role:user.role
203
204              }
205
206          });
```

👉 **Lines 186–206**: **200 OK** with the token and the user object (again, NO password hash). The frontend stores this token and sends it with every authenticated request.

```js
207
208      }
209
210      catch(error){
211
212          res.status(500).json({
213
214              message:error.message
215
216          });
217
218      }
219
220  };
```

👉 **Lines 208–220**: Generic 500 catch-all, same pattern as register.

### 5.7c The `profile` function (lines 221–231)

```js
221  const profile = async(req,res)=>{
222
223      res.status(200).json({
224
225          success:true,
226
227          user:req.user
228
229      });
230
231  };
```

👉 **Lines 221–231**: The simplest controller. It doesn't touch the database at all — it just returns `req.user`, which was **already populated by the `auth` middleware** (that middleware verified the JWT and decoded its payload onto `req.user`). No need for `try/catch` because nothing can throw here.

```js
232  module.exports={
233
234      register,
235
236      login,
237
238      profile
239
240  };
```

👉 **Lines 232–240**: Exports all three functions so the routes can use them.

### 💡 Interview questions for `authController.js`
1. **Q: Why hash passwords with bcrypt instead of sha256?** → bcrypt is slow + salted by design. SHA-256 is fast, so an attacker can try billions of guesses/sec and identical passwords produce identical hashes. bcrypt's cost factor and salt defeat both problems.
2. **Q: Why the same 401 message for missing user and wrong password?** → prevents user enumeration (an attacker probing which emails are registered).
3. **Q: What's inside the JWT?** → `{id, email, role}` signed with `JWT_SECRET`, expires in 7 days. The client must never be trusted to create tokens — only the server can sign.
4. **Q: Why not send the password hash back in responses?** → leaks data that could be used for offline attacks.
5. **Q: Where does `req.user` in `profile` come from?** → the `auth` middleware sets it after `jwt.verify`.

---

## 5.8 `server/controllers/urlController.js` — all URL logic (521 lines)

**Purpose**: The heart of the app — creating short URLs, redirecting, listing, updating, deleting, analytics, QR. This is the file to know inside-out.

**Imports** (lines 1–9):

```js
 1  const validator = require("validator");
```

👉 **Line 1**: The `validator` package provides ready-made checks, notably `validator.isURL(url)`.

```js
 2
 3  const Url = require("../models/Url");
```

👉 **Line 3**: The Url model.

```js
 4
 5  const generateShortCode = require("../utils/generateShortCode");
```

👉 **Line 5**: Our helper that returns `nanoid(7)`.

```js
 6
 7  const redisClient = require("../config/redis");
```

👉 **Line 7**: The shared Redis client (same singleton from `config/redis.js`).

```js
 8
 9  const QRCode = require("qrcode");
```

👉 **Line 9**: The QR code library. `QRCode.toDataURL(text)` produces a `data:image/png;base64,...` string.

### 5.8a `createShortUrl` (lines 11–88)

```js
11  const createShortUrl = async (req, res) => {
12
13      try {
14
15          const { originalUrl } = req.body;
```

👉 **Lines 11–15**: Extract `originalUrl` from the request body.

```js
16
17          if (!originalUrl) {
18
19              return res.status(400).json({
20                  message: "URL is required"
21              });
22
23          }
```

👉 **Lines 17–23**: Presence check → 400.

```js
24
25          if (!validator.isURL(originalUrl)) {
26
27              return res.status(400).json({
28                  message: "Invalid URL"
29              });
30
31          }
```

👉 **Lines 25–31**: Format check → `validator.isURL` makes sure it's actually a URL (protocol + host). Returns **400 Invalid URL** if not. This prevents garbage data from entering the DB.

```js
32
33          const shortCode = generateShortCode();
```

👉 **Line 33**: Generates the random 7-character code, e.g., `aB3xY9z`.

```js
34
35          const url = await Url.create({
36
37              originalUrl,
38
39              shortCode,
40
41              createdBy: req.user.id
42
43          });
```

👉 **Lines 35–43**: Inserts the URL document. `req.user.id` is the logged-in user's ID (set by the `auth` middleware from the JWT). This links the URL to its owner. `clicks`, `isActive`, `qrCode` use their schema defaults.

```js
44
45          // Create Short URL
46          const shortUrl = `http://localhost:5173/${url.shortCode}`;
```

👉 **Lines 45–46**: Builds the shareable short URL. 🚨 **KNOWN BUG**: the host is **hardcoded** to `http://localhost:5173` — in production the app runs on a different domain, so short URLs generated here are wrong. The correct approach is to build from `req.get("host")` or an env variable. The frontend actually computes its own correct short URL, so this mostly matters for the QR code generated below.

```js
47
48          // Generate QR Code
49          const qrCode = await QRCode.toDataURL(shortUrl);
```

👉 **Lines 48–49**: Generates the QR code image (as a data URL) that encodes the short URL. `await` because generating the PNG takes CPU time.

```js
50
51          // Save QR Code in MongoDB
52          url.qrCode = qrCode;
53
54          await url.save();
```

👉 **Lines 51–54**: Attaches the QR string to the document we already created, then `save()` persists the change. (This is a second DB round-trip — an optimization opportunity: generate the QR before `Url.create` to write once.)

```js
55
56          res.status(201).json({
57
58              success: true,
59
60              message: "Short URL Created",
61
62              data: {
63
64                  originalUrl: url.originalUrl,
65
66                  shortCode: url.shortCode,
67
68                  shortUrl,
69
70                  qrCode: url.qrCode
71
72              }
73
74          });
75
76      }
77
78      catch (error) {
79
80          res.status(500).json({
81
82              message: error.message
83
84          });
85
86      }
87
88  };
```

👉 **Lines 56–88**: **201 Created** response with the full result. 🚨 Note: there is no **collision retry** — if `nanoid` ever produced an existing code, the unique index would throw a duplicate-key error and this becomes a 500. In practice collisions are astronomically rare.

### 5.8b `getMyUrls` (lines 89–141) — pagination

```js
89  const getMyUrls = async (req, res) => {
90
91      try {
92
93          const userId = req.user.id;
```

👉 **Lines 89–93**: Grab the logged-in user's ID from the JWT payload.

```js
94
95          // Read page and limit from URL
96          const page = Number(req.query.page) || 1;
97          const limit = Number(req.query.limit) || 10;
```

👉 **Lines 95–97**: Reads pagination parameters from the query string (`/api/url/my-urls?page=2&limit=20`). `Number()` converts the string "2" → 2. If missing/NaN, fall back to defaults: page 1, limit 10. `NaN || 1` → 1 because `NaN` is falsy.

```js
98
99          // Calculate how many documents to skip
100          const skip = (page - 1) * limit;
```

👉 **Lines 99–100**: Skip logic. Page 1 → skip 0. Page 2 with limit 10 → skip 10 (start from the 11th document).

```js
101
102          // Count total URLs
103          const totalUrls = await Url.countDocuments({
104              createdBy: userId
105          });
```

👉 **Lines 102–105**: Counts how many URLs this user owns. Needed to compute total pages for the pagination UI.

```js
106
107          // Fetch paginated URLs
108          const urls = await Url.find({
109              createdBy: userId
110          })
111          .sort({
112              createdAt: -1
113          })
114          .skip(skip)
115          .limit(limit);
```

👉 **Lines 108–115**: The actual query — a chained Mongoose query:
- `find({createdBy})` → only this user's URLs.
- `.sort({createdAt: -1})` → newest first (`-1` = descending).
- `.skip(skip)` → jump past already-viewed pages.
- `.limit(limit)` → return at most `limit` documents.

```js
116
117          res.status(200).json({
118
119              success: true,
120
121              currentPage: page,
122
123              pageSize: limit,
124
125              totalUrls,
126
127              totalPages: Math.ceil(totalUrls / limit),
128
129              data: urls
130
131          });
132
133      } catch (error) {
134
135          res.status(500).json({
136              message: error.message
137          });
138
139      }
140
141  };
```

👉 **Lines 117–141**: **200 OK** with all the pagination metadata plus the page of URLs. `Math.ceil` rounds up: 42 URLs / 10 = 4.2 → 5 pages.

💡 **Scale note**: `skip`-based pagination gets slow on deep pages (Mongo still scans the skipped docs). The scalable alternative is **cursor/keyset pagination** using `createdAt < lastCreatedAt`.

### 5.8c `updateUrl` (lines 142–224)

```js
142  const updateUrl = async(req,res)=>{
143
144  try{
145
146  const { shortCode } = req.params;
147
148  const { originalUrl } = req.body;
```

👉 **Lines 142–148**: Extract the `shortCode` from the URL **path parameter** (`/api/url/:shortCode` → `req.params.shortCode`) and the new URL from the body.

```js
149
150  const url = await Url.findOne({ shortCode });
151
152  if(!url){
153
154  return res.status(404).json({
155
156  message:"URL not found"
157
158  });
159
160  }
```

👉 **Lines 150–160**: Find the document by its short code. If missing → **404 Not Found**.

```js
161
162  if(
163
164  url.createdBy.toString()
165
166  !==
167
168  req.user.id
169
170  ){
171
172  return res.status(403).json({
173
174  message:"Unauthorized"
175
176  });
177
178  }
```

👉 **Lines 162–178**: **OWNERSHIP CHECK** — the most important security check in this file.
- `url.createdBy` is stored as an `ObjectId`; `.toString()` converts it to a string.
- `req.user.id` is a string from the JWT payload.
- Compare them: if they differ, this user doesn't own the link → **403 Forbidden**.

This prevents user A from editing user B's links.

```js
179
180  if(
181
182  !validator.isURL(originalUrl)
183
184  ){
185
186  return res.status(400).json({
187
188  message:"Invalid URL"
189
190  });
191
192  }
```

👉 **Lines 180–192**: Validate the new URL → 400 if invalid.

```js
193
194  url.originalUrl = originalUrl;
195
196
197  await url.save();
```

👉 **Lines 194–197**: Update the field on the in-memory document and persist with `save()`.

```js
198
199  // Remove old cache
200  await redisClient.del(url.shortCode);
```

👉 **Lines 199–200**: ⭐ **Cache invalidation**. The redirect path caches `shortCode → originalUrl` in Redis. If we didn't delete this key, users would keep getting the OLD URL until the cache was manually cleared. Deleting it forces the next redirect to re-read from MongoDB and re-cache.

```js
201
202  res.status(200).json({
203
204  success:true,
205
206  message:"URL Updated",
207
208  data:url
209  });
210
211  }
212
213  catch(error){
214
215  res.status(500).json({
216
217  message:error.message
218
219  });
220  }
221
222  };
```

👉 **Lines 202–222**: **200 OK** with the updated document, plus the catch-all 500.

### 5.8d `deleteUrl` (lines 226–285)

```js
226  const deleteUrl = async(req,res)=>{
227
228  try{
229
230  const { shortCode } = req.params;
231
232  const url = await Url.findOne({ shortCode });
233
234  if(!url){
235
236  return res.status(404).json({
237
238  message:"URL not found"
239
240  });
241
242  }
243
244  if(
245
246  url.createdBy.toString()
247
248  !==
249
250  req.user.id
251
252  ){
253
254  return res.status(403).json({
255
256  message:"Unauthorized"
257
258  });
259
260  }
261
262  await Url.findOneAndDelete({
263      shortCode
264  });
265
266  await redisClient.del(url.shortCode);
267
268  res.status(200).json({
269      success: true,
270      message: "URL Deleted"
271  });
272
273  }
274
275  catch(error){
276
277  res.status(500).json({
278
279  message:error.message
280
281  });
282
283  }
284
285  };
```

👉 **Lines 226–285**: Same pattern as update: find → 404 → ownership → 403 → **delete from Mongo** (`findOneAndDelete`) → **delete from Redis cache** → 200. The find-first-then-delete lets us (a) check ownership and (b) know the code to purge from cache.

### 5.8e `getAnalytics` (lines 287–369)

```js
287  const getAnalytics = async(req,res)=>{
288
289      try{
290
291          const { shortCode } = req.params;
292
293          const url = await Url.findOne({
294
295              shortCode
296
297          });
298
299          if(!url){
300
301              return res.status(404).json({
302
303                  message:"URL not found"
304
305              });
306
307          }
308
309          if(
310
311              url.createdBy.toString()
312
313              !==
314
315              req.user.id
316
317          ){
318
319              return res.status(403).json({
320
321                  message:"Unauthorized"
322
323              });
324
325          }
```

👉 **Lines 287–325**: Find by code → 404 → ownership check → 403. (This exact 3-step dance repeats in several functions — a candidate to extract into a shared helper.)

```js
326
327          const status = url.isActive
328
329              ? "Active"
330
331              : "Inactive";
```

👉 **Lines 327–331**: Ternary: if `isActive` is true → `"Active"`, else → `"Inactive"`. Converts a boolean into a display string for the UI.

```js
332
333          res.status(200).json({
334
335              success:true,
336
337              data:{
338
339                  originalUrl:url.originalUrl,
340
341                  shortCode:url.shortCode,
342
343                  clicks:url.clicks,
344
345                  status,
346
347                  expiresAt:url.expiresAt,
348

349                  createdAt:url.createdAt,
350
351                  updatedAt:url.updatedAt
352
353              }
354
355          });
356
357      }
358
359      catch(error){
360
361          res.status(500).json({
362
363              message:error.message
364
365          });
366
367      }
368
369  };
```

👉 **Lines 333–369**: **200 OK** with all analytics data the frontend's detail page displays. Note `expiresAt` and dates are included but not the QR (kept in a separate endpoint).

### 5.8f `getQrCode` (lines 370–428)

```js
370  const getQrCode = async (req, res) => {
371
372      try {
373
374          const { shortCode } = req.params;
375
376          const url = await Url.findOne({
377
378              shortCode
379
380          });
381
382          if (!url) {
383
384              return res.status(404).json({
385
386                  message: "URL not found"
387
388              });
389
390          }
391
392          if (url.createdBy.toString() !== req.user.id) {
393
394              return res.status(403).json({
395
396                  message: "Unauthorized"
397
398              });
399
400          }
401
402          res.status(200).json({
403
404              success: true,
405
406              data: {
407
408                  shortCode: url.shortCode,
409
410                  qrCode: url.qrCode
411
412              }
413
414          });
415
416      }
417
418      catch (error) {
419
420          res.status(500).json({
421
422              message: error.message
423
424          });
425
426      }
427
428  };
```

👉 **Lines 370–428**: find → 404 → ownership → 403 → return the **stored** QR data URL. 💡 Note: the frontend **regenerates the QR client-side** and never calls this endpoint — so this is effectively unused/dead code. Good talking point for "what would you clean up?"

### 5.8g `redirectUrl` (lines 430–503) — ⭐ THE MOST IMPORTANT FUNCTION

```js
430  const redirectUrl = async (req, res) => {
431
432      try {
433
434          const { shortCode } = req.params;
```

👉 **Lines 430–434**: Extract the short code from the URL. This function runs for EVERY click on EVERY short link — it's the performance-critical path.

```js
435
436          const cached = await redisClient.get(shortCode);
```

👉 **Line 436**: Ask Redis: "do we have this code cached?" `get` returns the string value or `null` if missing. **Cache-aside pattern step 1: check the cache first.**

```js
437
438          if (cached) {
439
440              const cachedUrl = JSON.parse(cached);
```

👉 **Lines 438–440**: **CACHE HIT** (Redis returned something). `cached` is a JSON string, so we parse it back into an object: `{ originalUrl: "https://..." }`.

```js
441
442              await Url.updateOne(
443
444                  { shortCode },
445

446                  { $inc: { clicks: 1 } }
447
448              );
```

👉 **Lines 442–448**: Increment the click counter. `updateOne(filter, update)` with `{ $inc: { clicks: 1 } }` tells MongoDB "add 1 to `clicks`." `$inc` is **atomic** — even with thousands of concurrent clicks, no increment is lost (no read-modify-write race).

```js
449
450              return res.redirect(cachedUrl.originalUrl);
451
452          }
```

👉 **Line 450**: Send a **302 redirect** straight to the cached original URL. The browser follows it to the destination site. `return` exits — we never touch MongoDB for the actual URL lookup. **This is the speed win.**

🚨 **Gotcha**: on a cache hit we skip the `isActive` and `expiresAt` checks — so a link deactivated or expired AFTER caching could still redirect until the cache is invalidated. Adding a TTL to the cache would bound this staleness.

```js
453
454          const url = await Url.findOne({
455
456              shortCode
457
458          });
459
460          if (!url) {
461
462              return res.status(404).json({
463                  message: "URL not found"
464              });
465
466          }
```

👉 **Lines 454–466**: **CACHE MISS** → query MongoDB. If the code doesn't exist → **404**.

```js
467
468          if (!url.isActive) {
469
470              return res.status(403).json({
471
472                  message: "URL is inactive"
473              });
474
475          }
```

👉 **Lines 468–475**: If the owner deactivated the link → **403 Forbidden**.

```js
476
477          if (url.expiresAt && new Date(url.expiresAt) < new Date()) {
478
479              return res.status(410).json({
480
481                  message: "URL has expired"
482              });
483
484          }
```

👉 **Lines 477–484**: Expiry check. `new Date()` = now. If `expiresAt` exists and is in the past → **410 Gone** (resource used to exist but is now permanently unavailable).

```js
485
486          await redisClient.set(
487
488              shortCode,
489
490              JSON.stringify({
491
492                  originalUrl: url.originalUrl
493
494              })
495
496          );
```

👉 **Lines 486–496**: **Cache-aside step 2: store the result in the cache** so future hits are fast. We store only what redirects need (`originalUrl`), as JSON. 🚨 No TTL is set here — the entry lives until someone calls `del` on update/delete. A `set(..., { EX: 3600 })` would add automatic expiry.

```js
497
498          await Url.updateOne(
499
500              { shortCode },
501
502              { $inc: { clicks: 1 } }
503
504          );
505
506          res.redirect(url.originalUrl);
507
508      }
509
510      catch (error) {
511
512          res.status(500).json({
513
514              message: error.message
515
516          });
517
518      }
519
520  };
```

👉 **Lines 498–520**: Same `$inc` for clicks, then `res.redirect(url.originalUrl)` — Express sends a **302** with a `Location` header; the browser automatically follows it.

### ⭐ Why 302 and not 301? (interview favorite)
- **301 = Permanent**: browsers and CDNs cache the redirect FOREVER. If the owner edits the destination, users still get the old one.
- **302 = Temporary**: the redirect is re-checked on every visit, so edits take effect immediately.
- This app uses 302 — correct for URLs that can be edited.

```js
505
506  module.exports = {
507
508      createShortUrl,
509
510      redirectUrl,
511
512      getMyUrls,
513
514      updateUrl,
515
516      deleteUrl,
517
518      getAnalytics,
519
520      getQrCode
521
522  };
```

👉 **Lines 506–522**: Exports all seven controller functions for the routes.

### 💡 Interview questions for `urlController.js`
1. **Describe the redirect flow with and without cache.** → see 3.4. Hot path = Redis read + atomic `$inc` + 302.
2. **How is ownership enforced?** → `url.createdBy.toString() === req.user.id`, else 403. `req.user.id` comes from the server-signed JWT, so it can't be forged.
3. **Why delete the Redis key on update/delete?** → stale cache would keep serving the old destination. Manual invalidation keeps cache-aside consistent.
4. **What does `$inc` guarantee?** → atomic increment at the DB level — concurrent clicks can't lose updates.
5. **What happens on a nanoid collision?** → unique index throws → caught as a 500. Production fix: retry with a new code.
6. **What would you optimize?** → (a) generate QR before `create` to save one write; (b) derive `shortUrl` from request host, not hardcoded localhost; (c) add TTL to Redis; (d) batch click increments via Redis `INCR`.

---

## 5.9 `server/middleware/auth.js` — JWT verification

**Purpose**: Protects routes. Verifies the `Authorization: Bearer <token>` header and attaches the decoded user to `req.user`. Runs BETWEEN the route matching and the controller — this is the "middle" in middleware.

```js
 1  const jwt = require("jsonwebtoken");
```

👉 **Line 1**: Import jsonwebtoken for `verify`.

```js
 2
 3  const auth = (req,res,next)=>{
```

👉 **Line 3**: Middleware signature is `(req, res, next)`. `next` is the callback you call when done — it passes control to the NEXT middleware or the route handler. Call `next()` → "continue"; don't call it → "stop here, I already sent a response."

```js
 4
 5      try{
 6
 7          const authHeader = req.headers.authorization;
```

👉 **Lines 5–7**: Read the `Authorization` header. For a token request it looks like: `Authorization: Bearer eyJhbGciOi...`. If the client sent no header, this is `undefined`.

```js
 8
 9          if(!authHeader){
10
11              return res.status(401).json({
12
13                  message:"Access Denied. No Token Provided."
14
15              });
16
17          }
```

👉 **Lines 9–17**: No header at all → **401**. Note: here `return res.status(401)...` both sends the response AND exits (no `next()` called).

```js
18
19          const token = authHeader.split(" ")[1];
```

👉 **Line 19**: Splits the header on spaces: `["Bearer", "eyJhbGciOi..."]` and takes index `[1]` — the actual token. (Index `[0]` is the word "Bearer".)

```js
20
21          const decoded = jwt.verify(
22
23              token,
24
25              process.env.JWT_SECRET
26
27          );
```

👉 **Lines 21–27**: `jwt.verify(token, secret)`:
- Checks the **signature** (only tokens signed with our secret pass).
- Checks the **expiration** (`expiresIn:"7d"` from login).
- If valid → returns the decoded payload `{ id, email, role, iat, exp }`.
- If invalid/expired/tampered → **throws an error**, which jumps to `catch`.

```js
28
29          req.user = decoded;
30
31          next();
32
33      }
34
35      catch(error){
36
37          res.status(401).json({
38
39              message:"Invalid Token"
40
41          });
42
43      }
44
45  };
```

👉 **Lines 29–45**:
- Line 29: Attach the payload to `req.user` — now every downstream handler can read `req.user.id`, `req.user.email`, `req.user.role`.
- Line 31: `next()` → proceed to the controller.
- Lines 35–43: Any verify failure (bad token, expired token, malformed header) → **401 Invalid Token**.

```js
46
47  module.exports = auth;
```

👉 **Line 47**: Export so routes can mount it: `router.get("/profile", auth, profile)`.

### 💡 Interview tip
- This is **stateless authentication** — no session stored anywhere. Any server replica can verify a token with the shared secret, which is what makes horizontal scaling easy.
- The try/catch turns *all* failure modes into a single generic 401 — no information leakage about why it failed.

---

## 5.10 `server/middleware/rateLimiter.js` — anti-abuse throttling

**Purpose**: Creates four rate limiters using `express-rate-limit`. Each one limits how many requests a client can make within a time window.

```js
 1  const rateLimit = require("express-rate-limit");
```

👉 **Line 1**: Import the library. `rateLimit(options)` returns a middleware function.

```js
 2
 3  // Login Limiter Rate Limiting
 4  const loginLimiter = rateLimit({
 5      windowMs: 15 * 60 * 1000, // 15 minutes
 6      max: 10,
 7      message: {
 8          success: false,
 9          message: "Too many login attempts. Please try again after 15 minutes."
10      },
11      standardHeaders: true,
12      legacyHeaders: false
13  });
```

👉 **Lines 3–13**: Login limiter.
- `windowMs: 15 * 60 * 1000` → the window is 15 minutes (15 × 60 seconds × 1000 ms).
- `max: 10` → only **10 login attempts** allowed per 15 minutes per client.
- `message` → JSON body sent when the limit is exceeded.
- `standardHeaders: true` → sends modern `RateLimit-*` HTTP headers (spec-compliant).
- `legacyHeaders: false` → don't send the old `X-RateLimit-*` headers.

Brute-forcing passwords is stopped here: after 10 tries, the attacker is locked out for 15 minutes.

```js
14
15  // Register Limiter Rate Limiting
16  const registerLimiter = rateLimit({
17      windowMs: 60 * 60 * 1000, // 1 hour
18      max: 10,
19      message: {
20          success: false,
21          message: "Too many registration attempts. Please try again later."
22      }
23  });
```

👉 **Lines 16–23**: Register limiter — 10 registrations per hour. Stops bots from mass-creating accounts.

```js
24
25  // URL Creation Limiter
26  const createUrlLimiter = rateLimit({
27      windowMs: 60 * 1000, // 1 minute
28      max: 100,
29      message: {
30          success: false,
31          message: "Too many URLs created. Please slow down."
32      }
33  });
```

👉 **Lines 26–33**: URL creation — 100 per minute. Stops spammers from flooding the DB.

```js
34
35  // Redirect Limiter
36  const redirectLimiter = rateLimit({
37      windowMs: 60 * 1000, // 1 minute
38      max: 1000,
39      message: {
40          success: false,
41          message: "Too many requests."
42      }
43  });
```

👉 **Lines 36–43**: Redirect limiter — 1000 redirects per minute. The public redirect endpoint (no auth) is the most exposed, so it needs a cap against crawler/DoS abuse. Generous enough for real users.

```js
44
45  module.exports = {
46      loginLimiter,
47      registerLimiter,
48      createUrlLimiter,
49      redirectLimiter
50  };
```

👉 **Lines 45–50**: Export all four so the route files can attach them.

### 🚨 Big interview gotcha — in-memory storage
`express-rate-limit` by default stores counters **in the server's memory**. Implications:
- One counter per process (fine for a single instance).
- Counters reset when the server restarts.
- With multiple instances behind a load balancer, each instance has its OWN counter → someone could hit each instance up to `max` times.
- **Fix at scale**: use a shared store (e.g., the Redis-backed store) + set `trust proxy` so real client IPs are seen behind the proxy.

---

## 5.11 `server/middleware/errorHandler.js` — EMPTY placeholder

```js
(0 lines — file exists but is completely empty)
```

👉 This file was created but never filled in and **never imported anywhere**. Express's built-in default error handler is used instead, which returns an HTML page for errors — not ideal for an API. **Improvement**: implement a JSON error-handling middleware with signature `(err, req, res, next)` and register it at the end of `app.js`.

---

## 5.12 `server/utils/generateShortCode.js` — the short code generator

**Purpose**: Generates a random, URL-safe short code for new links. This is the "short" in "URL shortener."

```js
 1  const { nanoid } = require("nanoid");
```

👉 **Line 1**: Import `nanoid` — a tiny, fast library for random IDs.

```js
 2
 3  const generateShortCode = () => {
 4
 5      return nanoid(7);
 6
 7  };
```

👉 **Lines 3–7**: `nanoid(7)` returns a 7-character random string using a URL-safe alphabet (upper/lowercase letters + digits, no confusing `I/l/O/0`-style issues... actually nanoid's default alphabet avoids some). Example: `aB3xY9z`.

**Why 7 characters?** The math:
- nanoid's default alphabet has 64 characters.
- 64⁷ ≈ **4.4 trillion** possible codes.
- Collision probability is negligible at any realistic scale.
- Each code costs O(1) — no database round-trip needed (unlike checking a counter or querying first).

```js
 8
 9  module.exports = generateShortCode;
```

👉 **Line 9**: Export the function.

### 💡 Interview tip
Compare with alternatives: sequential base-62 counter (guessable, needs shared counter infra), hashing the URL (deterministic but collisions need handling, long codes). nanoid = simple + fast + unguessable.

---

## 5.13 `server/utils/validateUrl.js` — EMPTY placeholder

```js
(0 lines — file exists but is completely empty)
```

👉 Planned as a URL-validation helper, but never used. URL validation actually lives inline in `urlController.js` via `validator.isURL()`. 🚨 Duplication opportunity: the controller could import this util instead — worth mentioning as cleanup.

---

## 5.14 `server/routes/authRoutes.js` — auth URL routing

**Purpose**: Maps HTTP requests under `/api/auth/*` to the right controller + middleware.

```js
 1  const express = require("express");
 2  const router = express.Router();
```

👉 **Lines 1–2**: `express.Router()` creates a mini-app for a group of routes. It can be mounted under a prefix in `app.js`.

```js
 3
 4  const {
 5      register,
 6      login,
 7      profile
 8  } = require("../controllers/authController");
```

👉 **Lines 4–8**: Import the three controller functions.

```js
 9
10  const {
11      loginLimiter,
12      registerLimiter
13  } = require("../middleware/rateLimiter");
```

👉 **Lines 10–13**: Import the relevant rate limiters.

```js
14
15  const auth = require("../middleware/auth");
```

👉 **Line 15**: Import the JWT auth middleware.

```js
16
17  router.post(
18      "/register",
19      registerLimiter,
20      register
21  );
```

👉 **Lines 17–21**: `POST /api/auth/register`:
1. First `registerLimiter` runs (10/hour).
2. Then the `register` controller runs.
Middleware run **in order** — this is Express's pipeline model.

```js
22
23  router.post(
24      "/login",
25      loginLimiter,
26      login
27  );
```

👉 **Lines 23–27**: `POST /api/auth/login` → loginLimiter → login controller.

```js
28
29  router.get("/profile", auth, profile);
```

👉 **Line 29**: `GET /api/auth/profile` → `auth` middleware (verifies JWT) → `profile` controller. Note the chain: the middleware runs first and attaches `req.user`, which the controller then returns.

```js
30
31  module.exports = router;
```

👉 **Line 31**: Export the router so `app.js` can mount it under `/api/auth`.

---

## 5.15 `server/routes/urlRoutes.js` — URL routing

**Purpose**: Maps all `/api/url/*` routes. Shows the middleware-pipeline pattern clearly.

```js
 1  const express = require("express");
 2
 3  const router = express.Router();
```

👉 **Lines 1–3**: Create the router.

```js
 4
 5  const auth = require("../middleware/auth");
 6  const {
 7
 8      createShortUrl,
 9
10      redirectUrl,
11
12      getMyUrls,
13
14      updateUrl,
15
16      deleteUrl,
17
18      getAnalytics,
19
20      getQrCode
21
22  } = require("../controllers/urlController");
```

👉 **Lines 5–22**: Import auth middleware + all seven controllers.

```js
23
24  const {
25      createUrlLimiter,
26      redirectLimiter
27  } = require("../middleware/rateLimiter");
```

👉 **Lines 24–27**: Import the two relevant limiters.

```js
28
29  router.post(
30      "/",
31      auth,
32      createUrlLimiter,
33      createShortUrl
34  );
```

👉 **Lines 29–34**: `POST /api/url` → **auth → createUrlLimiter → createShortUrl**. Order matters: check identity first (auth), then throttle (limiter), then do the work. The pipeline: if auth fails, the limiter never runs.

```js
35
36  router.get("/my-urls", auth, getMyUrls);
```

👉 **Line 36**: `GET /api/url/my-urls` → auth → getMyUrls. 💡 Route-order note: `/my-urls` is defined BEFORE `/:shortCode` below. Express matches in order, so this specific path must not be captured by the `:shortCode` parameter route.

```js
37
38  router.put("/:shortCode", auth, updateUrl);
```

👉 **Line 38**: `PUT /api/url/:shortCode` → auth → updateUrl. `:shortCode` is a **path parameter** — its value lands in `req.params.shortCode`.

```js
39
40  router.delete("/:shortCode", auth, deleteUrl);
```

👉 **Line 40**: `DELETE /api/url/:shortCode` → auth → deleteUrl.

```js
41
42  router.get("/:shortCode/analytics", auth, getAnalytics);
```

👉 **Line 42**: `GET /api/url/:shortCode/analytics` → auth → getAnalytics. Note: a more specific path like this must come before or coexist carefully with `/my-urls` ordering — Express matches exact segments, and since `/my-urls` is a single segment it can't conflict with the two-segment analytics path.

```js
43
44  router.get("/:shortCode/qr", auth, getQrCode);
```

👉 **Line 44**: `GET /api/url/:shortCode/qr` → auth → getQrCode.

```js
45
46  router.get(
47      "/:shortCode",
48      redirectLimiter,
49      redirectUrl
50  );
```

👉 **Lines 46–50**: `GET /api/url/:shortCode` → redirectLimiter → redirectUrl. This is the **PUBLIC** route — **no `auth` middleware**, because anyone (even a non-logged-in visitor) must be able to follow a short link. This is the most-called endpoint in the whole app.

```js
51
52  module.exports = router;
```

👉 **Line 52**: Export the router.

### 💡 Route-pipeline mental model
```
request → [route match] → [middleware 1: auth] → [middleware 2: limiter] → [controller] → response
```
Each stage either calls `next()` (continue) or sends a response (stop).

---

## 5.16 `server/package.json` — backend dependencies & scripts

```js
{
  "name": "server",
  "version": "1.0.0",
  "main": "server.js",
```

👉 Project name, version, and the entry file (`node server.js` runs this).

```js
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
```

👉 `npm start` = production run. `npm run dev` = run with **nodemon**, which watches files and auto-restarts on every save (developer convenience).

```js
  "dependencies": {
    "bcrypt": "^6.0.0",        // password hashing
    "cors": "^2.8.6",          // cross-origin policy
    "dotenv": "^17.4.2",       // loads .env
    "express": "^5.2.1",       // web framework
    "express-rate-limit": "^8.6.1", // rate limiting
    "jsonwebtoken": "^9.0.3",  // JWT sign/verify
    "mongoose": "^9.9.1",      // MongoDB ODM
    "nanoid": "^6.0.0",        // short code generator
    "qrcode": "^1.5.4",        // QR image generation
    "redis": "^6.2.0",         // Redis client
    "validator": "^13.15.35",  // URL validation
    // Also installed but UNUSED: helmet (security headers), morgan (logging)
  },
  "devDependencies": {
    "nodemon": "^3.1.14"
  }
}
```

👉 **Key insight for interviews**: the dependency list tells you the app's capabilities at a glance. Note `helmet` and `morgan` are present but never wired in `app.js` — easy "improvements" talking points.

---

## 5.17 `server/.env` — environment secrets ⚠️

```js
PORT=5174
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>/<db>?...
JWT_SECRET=your-secret
REDIS_URL=redis://default:<password>@<host>:<port>
```

👉 This file holds configuration secrets: the MongoDB connection string (contains a real username + password), the JWT signing secret, and the Redis URL (contains a password).

### 🚨🚨 CRITICAL SECURITY WARNING
- This file contains **REAL, LIVE credentials** and it is **committed to the git repository**.
- Anyone with repo access can: connect to and wipe your MongoDB, read user data, forge JWT tokens (log in as anyone), and access your Redis.
- **Immediate fixes**:
  1. Rotate ALL credentials (Atlas, Redis Cloud) and change `JWT_SECRET`.
  2. `git rm --cached server/.env` then add `server/.env` to `.gitignore`.
  3. Optionally purge history with `git filter-repo`.
  4. Commit a `.env.example` with placeholders instead.
- This is a top talking point in interviews — "I learned the hard way that secrets must never be committed."

---

## ══════════════ CLIENT SIDE ══════════════

> The client is a **React SPA** (Single-Page Application). "SPA" means: the browser loads ONE HTML page, and JavaScript swaps the content in and out — no full page reloads for navigation.

## 5.18 `client/index.html` — the HTML shell

```html
 1  <!doctype html>
 2  <html lang="en">
```

👉 **Lines 1–2**: Declares this is an HTML5 document with English content.

```html
 3    <head>
 4      <meta charset="UTF-8" />
 5      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
```

👉 **Lines 4–5**: `charset=UTF-8` → correct text encoding. `viewport` meta → the page scales properly on phones.

```html
 6      <title>Smart URL Shortener</title>
```

👉 **Line 6**: The browser tab title.

```html
 7      <link rel="preconnect" href="https://fonts.googleapis.com" />
 8      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
 9      <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap" rel="stylesheet" />
```

👉 **Lines 7–9**: Loads the **Roboto** font from Google Fonts. `preconnect` tells the browser to open the connection early (faster). This is the "typography" part of the Material Design theme.

```html
10    </head>
11    <body>
12      <div id="root"></div>
```

👉 **Line 12**: An empty `<div>` with `id="root"`. **This is where React will inject the entire app.** Notice the HTML body is nearly empty — the real content is rendered by JavaScript.

```html
13      <script type="module" src="/src/main.jsx"></script>
14    </body>
15  </html>
```

👉 **Line 13**: Loads the JavaScript entry point `/src/main.jsx`. `type="module"` means it uses modern ES modules (import/export syntax). Vite processes this and bundles everything.

### 💡 How Vite/React fit together
- Dev: Vite serves this HTML + transpiles `.jsx` on the fly.
- Build: Vite bundles all React components into static files and injects them into this shell.
- The `#root` div is the contract between the HTML and React.

---

## 5.19 `client/vite.config.js` — dev server + proxy

```js
 1  import { defineConfig } from "vite";
 2  import react from "@vitejs/plugin-react";
```

👉 **Lines 1–2**: Imports Vite's config helper and the React plugin (adds JSX support / fast refresh).

```js
 3
 4  export default defineConfig({
 5    plugins: [react()],
```

👉 **Lines 4–5**: Tells Vite to use the React plugin.

```js
 6    server: {
 7      port: 3000,
 8      proxy: {
 9        "/api": "http://localhost:5174"
10      }
11    }
12  });
```

👉 **Lines 6–11**: Dev server settings:
- `port: 3000` → the frontend runs at `http://localhost:3000`.
- `proxy: { "/api": "http://localhost:5174" }` → ⭐ any request to the frontend starting with `/api` is forwarded to the backend at `localhost:5174`.

**Why the proxy?** In the browser, `fetch("/api/url")` is a **relative** URL → goes to `localhost:3000/api/url` → Vite forwards it to the backend. This avoids **CORS errors** in development and lets the frontend code use clean relative paths instead of hardcoding the backend URL.

---

## 5.20 `client/vercel.json` — production routing

```json
1  {
2    "rewrites": [
3      {
4        "source": "/api/:path*",
5        "destination": "https://url-shortner-3k6y.onrender.com/api/:path*"
6      },
7      {
8        "source": "/(.*)",
9        "destination": "/index.html"
10      }
11    ]
12  }
```

👉 **Lines 2–6**: On Vercel (production), requests to `/api/*` are **rewritten** (proxied) to the Render-hosted backend. This mirrors the dev proxy — same `/api` contract, different mechanism.

👉 **Lines 7–10**: ⭐ **SPA fallback**: any OTHER path (`/(.*)`) serves `index.html`. This is essential for client-side routing — when a user opens `https://yourdomain.com/aB3xY9z` directly, Vercel returns the React app (not a 404), and React Router takes over and matches `/:shortCode`.

### 💡 Interview tip
Same-origin proxying in both dev and prod means the frontend code never needs to know where the API actually lives. The `:path*` wildcard passes the rest of the URL through.

---

## 5.21 `client/.env` — frontend environment

```js
VITE_API_URL=https://url-shortner-3k6y.onrender.com/api
```

👉 Vite exposes env vars that start with `VITE_` to the frontend code via `import.meta.env.VITE_API_URL`. It points at the deployed backend's `/api` base. Used in `api.js` as the base URL for fetch calls.

### 💡 Note
`import.meta.env.VITE_API_URL` is baked into the JS bundle at **build time**. That's why the README mentions overriding it for local dev (the dev proxy usually makes it unnecessary, since relative `/api` paths work through the proxy).

---

## 5.22 `client/package.json` — frontend dependencies

```js
{
  "name": "client",
  "private": true,
  "type": "module",            // ES modules by default
  "scripts": {
    "dev": "vite",             // dev server
    "build": "vite build",     // production bundle
    "preview": "vite preview"  // preview the built bundle
  },
  "dependencies": {
    "qrcode": "^1.5.4",          // client-side QR generation
    "react": "^18.3.1",          // UI library
    "react-dom": "^18.3.1",      // renders React to the DOM
    "react-router-dom": "^6.26.2" // client-side routing
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.1", // JSX support for Vite
    "vite": "^5.4.8"
  }
}
```

👉 Key: `react-router-dom` gives us `<Routes>/<Route>` for SPA navigation. The `qrcode` package on the client means QR generation doesn't need to hit the server (the frontend regenerates the QR itself in UrlDetails).

---

## 5.23 `client/src/main.jsx` — React entry point

**Purpose**: Mounts React into the HTML. Establishes the provider hierarchy.

```jsx
 1  import React from "react";
 2  import ReactDOM from "react-dom/client";
```

👉 **Lines 1–2**: Import React and ReactDOM (the renderer).

```jsx
 3  import { BrowserRouter } from "react-router-dom";
 4  import App from "./App.jsx";
 5  import { AuthProvider } from "./context/AuthContext.jsx";
 6  import "./index.css";
```

👉 **Lines 3–6**:
- `BrowserRouter` → enables client-side routing using the browser's URL history API.
- `App` → the component tree root.
- `AuthProvider` → the global auth context.
- `./index.css` → imports the stylesheet (Vite bundles it).

```jsx
 7
 8  ReactDOM.createRoot(document.getElementById("root")).render(
 9    <React.StrictMode>
10      <BrowserRouter>
11        <AuthProvider>
12          <App />
13        </AuthProvider>
14      </BrowserRouter>
15    </React.StrictMode>
16  );
```

👉 **Lines 8–16**:
- `createRoot(document.getElementById("root"))` → finds the empty `<div id="root">` from index.html and takes control of it (React 18's modern API).
- `.render(<...>)` → renders the component tree inside it.

**The nesting order (outer → inner):**
```
StrictMode (dev helper that double-invokes effects to catch bugs)
  └─ BrowserRouter (routing)
       └─ AuthProvider (provides useAuth to EVERYTHING below)
            └─ App (the route table)
```

Because `AuthProvider` wraps `App`, every page component can call `useAuth()` and read the token/user.

---

## 5.24 `client/src/App.jsx` — the route table + guards

**Purpose**: Defines which component renders for each URL, and which routes are protected.

```jsx
 1  import { Routes, Route, Navigate } from "react-router-dom";
 2  import { useAuth } from "./context/AuthContext.jsx";
 3  import Home from "./pages/Home.jsx";
 4  import Login from "./pages/Login.jsx";
 5  import Register from "./pages/Register.jsx";
 6  import UrlDetails from "./pages/UrlDetails.jsx";
 7  import Redirect from "./pages/Redirect.jsx";
```

👉 **Lines 1–7**: Import routing utilities, the auth hook, and all five page components.

```jsx
 8
 9  function RequireAuth({ children }) {
10    const { token } = useAuth();
11    if (!token) return <Navigate to="/login" replace />;
12    return children;
13  }
```

👉 **Lines 9–13**: A **route guard** component (protects private pages).
- Reads `token` from the auth context.
- If there's **no token** → render `<Navigate to="/login" replace />` which instantly redirects the user to the login page. `replace` swaps the history entry (Back button won't return to the guarded page).
- If there IS a token → render the protected children.

```jsx
14
15  function RedirectIfAuthed({ children }) {
16    const { token } = useAuth();
17    if (token) return <Navigate to="/" replace />;
18    return children;
19  }
```

👉 **Lines 15–19**: The **opposite guard** (for auth pages). If the user is ALREADY logged in and visits `/login` or `/register`, bounce them to the home page. Prevents seeing login screens you don't need.

```jsx
20
21  export default function App() {
22    return (
23      <Routes>
```

👉 **Lines 21–23**: The main component returns the `<Routes>` block (React Router v6).

```jsx
24        <Route
25          path="/login"
26          element={
27            <RedirectIfAuthed>
28              <Login />
29            </RedirectIfAuthed>
30          }
31        />
```

👉 **Lines 24–31**: `/login` → guarded by `RedirectIfAuthed` → renders `<Login/>`. Already logged in? Bounced to `/`.

```jsx
32        <Route
33          path="/register"
34          element={
35            <RedirectIfAuthed>
36              <Register />
37            </RedirectIfAuthed>
38          }
39        />
```

👉 **Lines 32–39**: `/register`, same guard pattern.

```jsx
40        <Route
41          path="/url/:shortCode"
42          element={
43            <RequireAuth>
44              <UrlDetails />
45            </RequireAuth>
46          }
47        />
```

👉 **Lines 40–47**: `/url/:shortCode` → the analytics detail page → wrapped in `RequireAuth` (must be logged in). `:shortCode` is the route parameter; the page reads it via `useParams()`.

```jsx
48        <Route
49          path="/"
50          element={
51            <RequireAuth>
52              <Home />
53            </RequireAuth>
54          }
55        />
```

👉 **Lines 48–55**: Home page at `/` → also protected.

```jsx
56        <Route path="/:shortCode" element={<Redirect />} />
57      </Routes>
58    );
59  }
```

👉 **Lines 56–59**: ⭐ The **catch-all route**: ANY one-segment path like `/aB3xY9z` renders `<Redirect/>`, which forwards to the backend. This is how public short links work inside the SPA.

### 🚨 Guard reality check (interview gold)
These guards are **UI convenience only**. They check `token` *presence*, not validity. A tampered/expired token still renders the page — the real security is the backend's `auth` middleware, which returns 401 for bad tokens. Always protect data on the SERVER, never rely on the client.

### 💡 Route-matching note
`/:shortCode` is very broad — it would also match `/login` and `/register` if React Router saw it first, but React Router v6 ranks routes by specificity, and the explicit paths win.

---

## 5.25 `client/src/api.js` — the single HTTP gateway

**Purpose**: Every backend call goes through this one wrapper. Centralizes headers, error handling, and the base URL.

```js
 1  const API = import.meta.env.VITE_API_URL;
```

👉 **Line 1**: Reads the base API URL from the Vite env var (e.g., `https://url-shortner-3k6y.onrender.com/api`). In dev this could be set to `http://localhost:5174/api` if you're not using the proxy.

```js
 2
 3  async function request(path, { method = "GET", body, token } = {}) {
```

👉 **Line 3**: The core `request` function.
- `path` → e.g. `/url/my-urls`.
- Second argument is a **destructured options object** with defaults: `method = "GET"`, `body` optional, `token` optional.
- The `= {}` default means you can call `request("/url")` with no options at all.
- `async` → returns a Promise; callers `await` it.

```js
 4    const headers = {};
 5    if (body) headers["Content-Type"] = "application/json";
 6    if (token) headers["Authorization"] = `Bearer ${token}`;
```

👉 **Lines 4–6**: Build the request headers.
- Only set `Content-Type: application/json` when there's a body.
- Only attach `Authorization: Bearer <token>` when a token is passed. This is where the JWT rides on every authenticated request.

```js
 7
 8    const res = await fetch(`${API}${path}`, {
 9      method,
10      headers,
11      body: body ? JSON.stringify(body) : undefined
12    });
```

👉 **Lines 8–12**: The actual `fetch` call.
- URL = `API + path` (e.g., `.../api` + `/url`).
- `body` is converted to a JSON **string** (fetch can't send objects directly).
- If no body, `undefined` (so no body is sent).

```js
13
14    const data = await res.json().catch(() => null);
```

👉 **Line 14**: Parse the response as JSON. `.catch(() => null)` → if the response isn't JSON (e.g., an HTML error page), don't crash — just use `null`.

```js
15
16    if (!res.ok) {
17      const error = new Error(data?.message || "Something went wrong");
18      error.status = res.status;
19      throw error;
20    }
```

👉 **Lines 16–20**: ⭐ Error normalization.
- `res.ok` is `true` only for 2xx status codes.
- If not OK → create an `Error` whose message is the backend's `message` field (e.g., "Invalid Email or Password"), attach the HTTP status as `.status`, and **throw** it.
- The calling component catches it and shows `e.message`. This is why every page displays friendly backend messages.

```js
21
22    return data;
23  }
```

👉 **Lines 22**: On success, return the parsed JSON (e.g., `{ token, user }`).

```js
24
25  export const api = {
26    register: (payload) => request("/auth/register", { method: "POST", body: payload }),
27    login: (payload) => request("/auth/login", { method: "POST", body: payload }),
28    createUrl: (originalUrl, token) =>
29      request("/url", { method: "POST", body: { originalUrl }, token }),
30    myUrls: (token) => request("/url/my-urls", { token }),
31    analytics: (shortCode, token) => request(`/url/${shortCode}/analytics`, { token }),
32    updateUrl: (shortCode, originalUrl, token) =>
33      request(`/url/${shortCode}`, { method: "PUT", body: { originalUrl }, token }),
34    deleteUrl: (shortCode, token) =>
35      request(`/url/${shortCode}`, { method: "DELETE", token })
36  };
```

👉 **Lines 25–36**: Thin, descriptive wrappers — each named function maps to one endpoint. Note the pattern: `token` is always the last argument, and each wrapper builds the right path/method/body. Components call `api.createUrl(url, token)` and never touch raw `fetch`.

### 💡 Interview tip
Centralizing HTTP = consistent error shape + a single place to add features like auto-refresh tokens, retry logic, or a 401 → redirect-to-login interceptor.

---

## 5.26 `client/src/context/AuthContext.jsx` — global auth state

**Purpose**: Holds the JWT token and user object, persists them to `localStorage`, and exposes `login`/`logout` to every component.

```jsx
 1  import { createContext, useContext, useState } from "react";
```

👉 **Line 1**: Import React hooks/utilities:
- `createContext` → makes a context object that can share data.
- `useContext` → lets components read that context.
- `useState` → local component state.

```jsx
 2
 3  const AuthContext = createContext(null);
```

👉 **Line 3**: Creates the context with a default value of `null`. Any component under `<AuthProvider>` can read it.

```jsx
 4
 5  const TOKEN_KEY = "token";
 6  const USER_KEY = "user";
```

👉 **Lines 5–6**: localStorage keys. The token is stored under the key `"token"`, the user object under `"user"`.

```jsx
 7
 8  export function AuthProvider({ children }) {
 9    const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
```

👉 **Lines 8–9**: Token state, initialized **lazily** from localStorage. The initializer function runs only ONCE (on first render): `localStorage.getItem("token")` returns the saved token string or `null` if the user isn't logged in. This is what makes the page "remember" you after refresh.

```jsx
10    const [user, setUser] = useState(() => {
11      try {
12        return JSON.parse(localStorage.getItem(USER_KEY));
13      } catch {
14        return null;
15      }
16    });
```

👉 **Lines 10–16**: User state, also lazy. We `JSON.parse` the stored string back into an object. The `try/catch` guards against corrupted JSON in storage (e.g., someone hand-edited localStorage) → falls back to `null`.

```jsx
17
18    const login = ({ token, user }) => {
19      localStorage.setItem(TOKEN_KEY, token);
20      localStorage.setItem(USER_KEY, JSON.stringify(user));
21      setToken(token);
22      setUser(user);
23    };
```

👉 **Lines 18–23**: The `login` function (called from the Login page with the API response `{token, user}`):
- Saves the token string to localStorage.
- Saves the user as a JSON string.
- Updates React state (which re-renders the whole app with the new auth).

**Two sources of truth**: localStorage (survives refresh) + React state (drives the UI). Keeping both in sync is exactly what this function does.

```jsx
24
25    const logout = () => {
26      localStorage.removeItem(TOKEN_KEY);
27      localStorage.removeItem(USER_KEY);
28      setToken(null);
29      setUser(null);
30    };
```

👉 **Lines 25–30**: `logout` — removes both keys and clears state. Any component (e.g., Layout's Logout button) can call it.

```jsx
31
32    return (
33      <AuthContext.Provider value={{ token, user, login, logout }}>
34        {children}
35      </AuthContext.Provider>
36    );
37  }
```

👉 **Lines 32–37**: Wraps all children in the Provider, making `{ token, user, login, logout }` available to every descendant.

```jsx
38
39  export function useAuth() {
40    return useContext(AuthContext);
41  }
```

👉 **Lines 39–41**: ⭐ The hook. Any component calls `const { token, user, login, logout } = useAuth()` and gets the whole auth API. This is the clean Consumer pattern — components never touch the context object directly.

### 💡 Interview question — token storage tradeoff
**Q: Why localStorage? What's the risk?** → Simplicity and persistence across refresh. Risk: **XSS** — if an attacker injects JavaScript, they can read `localStorage.getItem("token")` and steal the session. The safer alternative is an **HttpOnly cookie** (JS can't read it) but then you must handle CSRF. This is a classic security tradeoff every interviewer loves.

---

## 5.27 `client/src/components/Layout.jsx` — shared page shell

**Purpose**: Renders the header (brand, user name, logout) and wraps page content. Used by Home and UrlDetails.

```jsx
 1  import { Link } from "react-router-dom";
 2  import { useAuth } from "../context/AuthContext.jsx";
```

👉 **Lines 1–2**: `Link` for client-side navigation; `useAuth` for user + logout.

```jsx
 3
 4  export default function Layout({ children }) {
 5    const { user, logout } = useAuth();
```

👉 **Lines 4–5**: `children` = whatever page content is placed inside `<Layout>...</Layout>`. Reads `user` and `logout`.

```jsx
 6
 7    return (
 8      <>
 9        <header className="header">
10          <div className="page header-inner">
11            <Link to="/" className="brand">
12              Smart URL
13            </Link>
```

👉 **Lines 8–13**: A fragment `<>...</>` (React's invisible wrapper). Header bar with the brand — clicking it uses `<Link>` (client-side navigation, no page reload) to go home.

```jsx
14            <div className="header-actions">
15              {user && <span className="header-user">{user.name}</span>}
16              <button className="btn btn-ghost btn-sm" onClick={logout}>
17                Logout
18              </button>
19            </div>
20          </div>
21        </header>
22        <main className="page">{children}</main>
23      </>
24    );
25  }
```

👉 **Lines 14–25**:
- Line 15: `{user && ...}` → conditional rendering — only show the user's name if `user` exists.
- Lines 16–18: Logout button → calls `logout()` (clears localStorage + state → app re-renders → guards redirect to /login).
- Line 22: `<main>{children}</main>` → the actual page content is rendered here.

### 💡 Interview tip
`{user && <span>}` demonstrates **conditional rendering** — a core React pattern. `logout` here is instant client-side; the JWT remains technically valid until expiry (no server blacklist) — a tradeoff of stateless auth.

---

## 5.28 `client/src/pages/Home.jsx` — create URLs + list "My URLs"

**Purpose**: The main dashboard. Form to shorten a new URL on top, list of the user's URLs below.

```jsx
 1  import { useEffect, useState } from "react";
 2  import { useNavigate } from "react-router-dom";
 3  import Layout from "../components/Layout.jsx";
 4  import { useAuth } from "../context/AuthContext.jsx";
 5  import { api } from "../api.js";
```

👉 **Lines 1–5**: React hooks, navigation, the shared Layout, auth, and the API gateway.

```jsx
 6
 7  export default function Home() {
 8    const { token, user } = useAuth();
 9    const navigate = useNavigate();
10    const [urls, setUrls] = useState([]);
11    const [originalUrl, setOriginalUrl] = useState("");
12    const [error, setError] = useState("");
13    const [loading, setLoading] = useState(false);
```

👉 **Lines 7–13**: Component state:
- `token, user` → from context (token for API calls, user for the greeting).
- `navigate` → programmatic navigation (to go to detail pages).
- `urls` → the list fetched from the API.
- `originalUrl` → controlled input value.
- `error` → error message to show.
- `loading` → disables the button while submitting.

```jsx
14
15    const loadUrls = async () => {
16      try {
17        const data = await api.myUrls(token);
18        setUrls(data.data || []);
19      } catch (e) {
20        setError(e.message);
21      }
22    };
```

👉 **Lines 15–22**: Fetches the user's URLs. `api.myUrls(token)` → GET `/api/url/my-urls`. The response's `data` array is stored in state. `data.data || []` guards against `undefined` (empty list fallback). Errors set the error message.

```jsx
23
24    useEffect(() => {
25      loadUrls();
26    }, [token]);
```

👉 **Lines 24–26**: ⭐ `useEffect` runs the load ONCE when the component mounts (and if `token` changes). The dependency array `[token]` means "re-run only when token changes." Without the array, it would loop forever.

```jsx
27
28    const handleCreate = async (e) => {
29      e.preventDefault();
30      setError("");
31      setLoading(true);
32      try {
33        await api.createUrl(originalUrl, token);
34        setOriginalUrl("");
35        await loadUrls();
36      } catch (e) {
37        setError(e.message);
38      } finally {
39        setLoading(false);
40      }
41    };
```

👉 **Lines 28–41**: Form submit handler:
- `e.preventDefault()` → ⭐ stops the browser's default form behavior (full page reload). Without this the SPA would break.
- Reset error, set loading (shows "Creating...").
- `api.createUrl(originalUrl, token)` → POST `/api/url`.
- On success: clear the input, reload the list (so the new link appears).
- On error: show the message.
- `finally` → always stop loading (whether success or failure).

```jsx
42
43    const shortUrl = (code) => `${window.location.origin}/${code}`;
```

👉 **Line 43**: Helper: builds the full short URL using the CURRENT origin (domain) — e.g., `http://localhost:3000/aB3xY9z` in dev, `https://yourdomain.com/aB3xY9z` in prod. (Contrast with the server's hardcoded `localhost:5173` bug.)

```jsx
44
45    return (
46      <Layout>
47        <section className="hero">
48          <div className="blob blob-a" aria-hidden="true" />
49          <div className="blob blob-b" aria-hidden="true" />
50          <h1>Hello, {user?.name}</h1>
```

👉 **Lines 46–50**: Renders inside the shared Layout. Decorative `blob` divs (the organic blur shapes from the Material design). `user?.name` — the **optional chaining** `?.` means "if user is null, don't crash, just render nothing."

```jsx
51          <p className="hero-sub">Shorten a link and share it anywhere.</p>
52          <form className="create-form" onSubmit={handleCreate}>
53            <input
54              className="input"
55              type="url"
56              placeholder="Paste a long URL..."
57              value={originalUrl}
58              onChange={(e) => setOriginalUrl(e.target.value)}
59              required
60            />
61            <button className="btn btn-primary" disabled={loading}>
62              {loading ? "Creating..." : "Shorten"}
63            </button>
64          </form>
65          {error && <p className="error-text">{error}</p>}
66        </section>
```

👉 **Lines 51–66**: The hero section:
- `type="url"` → browser validates it's a real URL.
- `value` + `onChange` → the **controlled input** pattern (React state owns the value).
- `disabled={loading}` → prevents double-submits.
- `{loading ? "Creating..." : "Shorten"}` → dynamic button text (ternary).
- `{error && ...}` → conditional error display.

```jsx
67
68        <section className="urls">
69          <h2 className="section-title">My URLs</h2>
70          {urls.length === 0 && <p className="empty">No URLs yet.</p>}
71          <ul className="url-list">
72            {urls.map((url) => (
73              <li key={url._id}>
74                <button
75                  className="url-item"
76                  onClick={() => navigate(`/url/${url.shortCode}`)}
77                >
78                  <div className="url-main">
79                    <span className="url-short">{shortUrl(url.shortCode)}</span>
80                    <span className="url-original">{url.originalUrl}</span>
81                  </div>
82                  <span className="clicks">{url.clicks} clicks</span>
83                </button>
84              </li>
85            ))}
86          </ul>
87        </section>
88      </Layout>
89    );
90  }
```

👉 **Lines 68–90**: The URL list:
- Line 70: empty-state message if no URLs.
- Lines 72–85: `urls.map(...)` → renders one `<li>` per URL. **`key={url._id}`** is required by React for efficient re-rendering.
- Line 76: clicking a list item navigates to the detail page (`/url/:shortCode`).
- Line 79: shows the pretty short URL; line 80 the original; line 82 the click count.

### 💡 Interview questions
1. **What does `e.preventDefault()` do here and why is it needed?** → stops the browser's native form submission (page reload), keeping the SPA in place.
2. **Controlled vs uncontrolled input?** → controlled = value lives in React state (`value` + `onChange`). Uncontrolled = read from the DOM when needed.
3. **Why `useEffect` with `[token]`?** → fetch once on mount, re-fetch if the auth changes.

---

## 5.29 `client/src/pages/Login.jsx` — sign-in form

```jsx
 1  import { useState } from "react";
 2  import { Link, useNavigate } from "react-router-dom";
 3  import { useAuth } from "../context/AuthContext.jsx";
 4  import { api } from "../api.js";
```

👉 **Lines 1–4**: State, navigation, auth context, API gateway.

```jsx
 5
 6  export default function Login() {
 7    const { login } = useAuth();
 8    const navigate = useNavigate();
 9    const [email, setEmail] = useState("");
10    const [password, setPassword] = useState("");
11    const [error, setError] = useState("");
12    const [loading, setLoading] = useState(false);
```

👉 **Lines 6–12**: The `login` function from context (note: the function and the page share a name — be careful in interviews). Controlled inputs for email/password, plus error/loading state.

```jsx
13
14    const handleSubmit = async (e) => {
15      e.preventDefault();
16      setError("");
17      setLoading(true);
18      try {
19        const data = await api.login({ email, password });
20        login(data);
21        navigate("/");
22      } catch (e) {
23        setError(e.message);
24      } finally {
25        setLoading(false);
26      }
27    };
```

👉 **Lines 14–27**: Submit flow:
1. `e.preventDefault()` — no page reload.
2. `api.login({email, password})` → POST `/api/auth/login` → backend returns `{ token, user }`.
3. `login(data)` → ⭐ **stores the token + user in context and localStorage**. After this, the whole app "knows" you're logged in.
4. `navigate("/")` → go to the dashboard. The `RequireAuth` guard now passes (token exists).
5. Errors → `e.message` (the backend's message, e.g. "Invalid Email or Password").

```jsx
28
29    return (
30      <div className="auth-page">
31        <div className="blob blob-a" aria-hidden="true" />
32        <div className="blob blob-b" aria-hidden="true" />
33        <div className="card auth-card">
34          <p className="brand-center">Smart URL</p>
35          <h1>Welcome back</h1>
36          <p className="auth-sub">Sign in to manage your short links.</p>
37          <form className="form" onSubmit={handleSubmit}>
38            <div className="field">
39              <label htmlFor="email">Email</label>
40              <input
41                className="input"
42                id="email"
43                type="email"
44                autoComplete="email"
45                value={email}
46                onChange={(e) => setEmail(e.target.value)}
47                required
48              />
49            </div>
```

👉 **Lines 38–49**: Email field. `autoComplete="email"` lets the browser autofill. `required` + `type="email"` = browser-side validation. Controlled input pattern.

```jsx
50            <div className="field">
51              <label htmlFor="password">Password</label>
52              <input
53                className="input"
54                id="password"
55                type="password"
56                autoComplete="current-password"
57                value={password}
58                onChange={(e) => setPassword(e.target.value)}
59                required
60              />
61            </div>
62            {error && <p className="error-text">{error}</p>}
63            <button className="btn btn-primary" disabled={loading}>
64              {loading ? "Signing in..." : "Sign in"}
65            </button>
66          </form>
67          <p className="auth-switch">
68            No account? <Link to="/register">Create one</Link>
69          </p>
70        </div>
71      </div>
72    );
73  }
```

👉 **Lines 50–73**: Password field (`type="password"` masks it), error display, submit button, and a `Link` to the register page. `Link` = client-side navigation, no reload.

---

## 5.30 `client/src/pages/Register.jsx` — sign-up form

```jsx
 1  import { useState } from "react";
 2  import { Link, useNavigate } from "react-router-dom";
 3  import { api } from "../api.js";
```

👉 **Lines 1–3**: State, navigation, API. Note: **no `useAuth`** — registration does NOT log you in (the app redirects to login instead).

```jsx
 4
 5  export default function Register() {
 6    const navigate = useNavigate();
 7    const [name, setName] = useState("");
 8    const [email, setEmail] = useState("");
 9    const [password, setPassword] = useState("");
10    const [error, setError] = useState("");
11    const [loading, setLoading] = useState(false);
```

👉 **Lines 5–11**: Same pattern as Login, plus a `name` field.

```jsx
12
13    const handleSubmit = async (e) => {
14      e.preventDefault();
15      setError("");
16      setLoading(true);
17      try {
18        await api.register({ name, email, password });
19        navigate("/login");
20      } catch (e) {
21        setError(e.message);
22      } finally {
23        setLoading(false);
24      }
25    };
```

👉 **Lines 13–25**: Submit → `api.register(...)` → POST `/api/auth/register`. On success, navigate to **`/login`** (the user then signs in — a deliberate two-step flow). Errors show the backend message (e.g., "Email already exists").

```jsx
26
27    return (
28      <div className="auth-page">
29        <div className="blob blob-a" aria-hidden="true" />
30        <div className="blob blob-b" aria-hidden="true" />
31        <div className="card auth-card">
32          <p className="brand-center">Smart URL</p>
33          <h1>Create account</h1>
34          <p className="auth-sub">Start shortening links in seconds.</p>
35          <form className="form" onSubmit={handleSubmit}>
```

👉 **Lines 27–35**: Same visual shell as Login.

```jsx
36            <div className="field">
37              <label htmlFor="name">Name</label>
38              <input
39                className="input"
40                id="name"
41                type="text"
42                autoComplete="name"
43                value={name}
44                onChange={(e) => setName(e.target.value)}
45                required
46              />
47            </div>
48            <div className="field">
49              <label htmlFor="email">Email</label>
50              <input
51                className="input"
52                id="email"
53                type="email"
54                autoComplete="email"
55                value={email}
56                onChange={(e) => setEmail(e.target.value)}
57                required
58              />
59            </div>
60            <div className="field">
61              <label htmlFor="password">Password</label>
62              <input
63                className="input"
64                id="password"
65                type="password"
66                autoComplete="new-password"
67                value={password}
68                onChange={(e) => setPassword(e.target.value)}
69                required
70              />
71            </div>
72            {error && <p className="error-text">{error}</p>}
73            <button className="btn btn-primary" disabled={loading}>
74              {loading ? "Creating..." : "Create account"}
75            </button>
76          </form>
77          <p className="auth-switch">
78            Already have an account? <Link to="/login">Sign in</Link>
79          </p>
80        </div>
81      </div>
82    );
83  }
```

👉 **Lines 36–83**: Three controlled inputs (name, email, password), error text, submit button, and the switch link. `autoComplete="new-password"` helps password managers.

---

## 5.31 `client/src/pages/Redirect.jsx` — public short-link forwarder

**Purpose**: The catch-all page. When a visitor opens `/aB3xY9z`, this component fires the browser to the backend redirect endpoint.

```jsx
 1  import { useEffect } from "react";
 2  import { useParams } from "react-router-dom";
```

👉 **Lines 1–2**: `useEffect` for side effects; `useParams` to read the short code from the URL.

```jsx
 3
 4  export default function Redirect() {
 5    const { shortCode } = useParams();
 6
 7    useEffect(() => {
 8      window.location.replace(`/api/url/${shortCode}`);
 9    }, [shortCode]);
10
11    return (
12      <div className="auth-page">
13        <p className="empty">Redirecting...</p>
14      </div>
15    );
16  }
```

👉 **Lines 5–15**:
- Line 5: `useParams()` reads `:shortCode` from the route (`/aB3xY9z` → `aB3xY9z`).
- Line 8: `window.location.replace("/api/url/" + shortCode)` → ⭐ **full browser navigation** to the API path (not a `fetch`). The browser makes a fresh request → the backend responds with a **302** → the browser follows it to the original website.
- `replace` (not `assign`) → replaces the current history entry, so the "Redirecting..." page isn't left in the back-button stack.
- Lines 11–15: While this happens, a tiny "Redirecting..." placeholder renders.

### 💡 Why not `fetch` here?
If we fetched the URL and used React to navigate, the browser would NOT follow the server's 302 automatically (fetch exposes the response but the redirect target's CORS headers matter). A direct `location.replace` makes the browser do a native redirect — exactly what a short-link system needs. The relative path works because of the dev proxy / Vercel rewrite for `/api`.

---

## 5.32 `client/src/pages/UrlDetails.jsx` — analytics, edit, delete, QR

**Purpose**: The detail page for one short link: live-ish analytics, inline edit, delete, and a QR code.

```jsx
 1  import { useEffect, useState } from "react";
 2  import { Link, useNavigate, useParams } from "react-router-dom";
 3  import QRCode from "qrcode";
 4  import Layout from "../components/Layout.jsx";
 5  import { useAuth } from "../context/AuthContext.jsx";
 6  import { api } from "../api.js";
```

👉 **Lines 1–6**: Hooks, routing, the client-side QR library, Layout, auth, API.

```jsx
 7
 8  export default function UrlDetails() {
 9    const { shortCode } = useParams();
10    const { token } = useAuth();
11    const navigate = useNavigate();
12    const [data, setData] = useState(null);
13    const [qr, setQr] = useState("");
14    const [error, setError] = useState("");
15    const [editing, setEditing] = useState(false);
16    const [editedUrl, setEditedUrl] = useState("");
17    const [busy, setBusy] = useState(false);
18    const [actionError, setActionError] = useState("");
```

👉 **Lines 8–18**: State:
- `shortCode` from the route, `token` from context.
- `data` → the analytics object (initially `null` = loading state).
- `qr` → the QR data URL.
- `editing`/`editedUrl` → inline edit mode.
- `busy`/`actionError` → for update/delete operations.

```jsx
19
20    useEffect(() => {
21      let cancelled = false;
22
23      const loadAnalytics = async () => {
24        try {
25          const analytics = await api.analytics(shortCode, token);
26          if (cancelled) return;
27          setData(analytics.data);
28        } catch (e) {
29          if (!cancelled) setError(e.message);
30        }
31      };
32
33      loadAnalytics();
34      const timer = setInterval(loadAnalytics, 5000);
35
36      return () => {
37        cancelled = true;
38        clearInterval(timer);
39      };
40    }, [shortCode, token]);
```

👉 **Lines 20–40**: ⭐ **Polling effect** — the analytics refresh every 5 seconds.
- `loadAnalytics` → calls `api.analytics(shortCode, token)` and stores `analytics.data`.
- Line 33: run immediately.
- Line 34: `setInterval(loadAnalytics, 5000)` → run again every 5 seconds. This is what makes the click counter appear to update "live."
- Lines 36–39: **cleanup function** — runs when the component unmounts or the effect re-runs. It:
  - sets `cancelled = true` (so a late-arriving response doesn't call `setState` on an unmounted component — a React warning / subtle bug otherwise),
  - `clearInterval(timer)` (stops polling so it doesn't leak forever).
- `[shortCode, token]` deps → re-run the whole effect if the route param or auth changes.

💡 **Scale note**: N open pages × 1 request/5s = constant polling load. The real-time upgrade is WebSockets or Server-Sent Events (server pushes updates). Good "future improvement" point.

```jsx
41
42    useEffect(() => {
43      let cancelled = false;
44      (async () => {
45        try {
46          const qrData = await QRCode.toDataURL(
47            `${window.location.origin}/${shortCode}`,
48            { width: 200, margin: 1 }
49          );
50          if (!cancelled) setQr(qrData);
51        } catch (e) {
52          if (!cancelled) setError(e.message);
53        }
54      })();
55      return () => {
56        cancelled = true;
57      };
58    }, [shortCode]);
```

👉 **Lines 42–58**: QR generation effect.
- Generates the QR **on the client** using the `qrcode` package: `QRCode.toDataURL(shortUrl, {width:200, margin:1})` → a PNG data URL.
- Uses an immediately-invoked async function `(async () => {...})()` to `await` inside the effect.
- Same `cancelled` cleanup pattern.
- 💡 Note: the backend already stored a QR at creation time and has a `/qr` endpoint — but the frontend **regenerates it here** instead. Redundancy worth mentioning.

```jsx
59
60    const startEdit = () => {
61      setEditedUrl(data.originalUrl);
62      setActionError("");
63      setEditing(true);
64    };
```

👉 **Lines 60–64**: Enter edit mode: pre-fill the input with the current URL, clear errors, show the form.

```jsx
65
66    const handleUpdate = async (e) => {
67      e.preventDefault();
68      setBusy(true);
69      setActionError("");
70      try {
71        await api.updateUrl(shortCode, editedUrl, token);
72        const analytics = await api.analytics(shortCode, token);
73        setData(analytics.data);
74        setEditing(false);
75      } catch (e) {
76        setActionError(e.message);
77      } finally {
78        setBusy(false);
79      }
80    };
```

👉 **Lines 66–80**: Save the edit: `api.updateUrl(...)` → PUT `/api/url/:shortCode`. Then re-fetch analytics so the UI shows the new URL. Exit edit mode on success; show the backend error on failure.

```jsx
81
82    const handleDelete = async () => {
83      if (!window.confirm("Delete this short URL?")) return;
84      setBusy(true);
85      setActionError("");
86      try {
87        await api.deleteUrl(shortCode, token);
88        navigate("/");
89      } catch (e) {
90        setActionError(e.message);
91        setBusy(false);
92      }
93    };
```

👉 **Lines 82–93**: Delete:
- Line 83: `window.confirm(...)` → native browser confirmation dialog; if the user cancels, `return` immediately.
- On success → navigate back to the dashboard (`/`).
- On failure → show error and re-enable buttons (note `setBusy(false)` is only in the catch here; navigate unmounts the page on success).

```jsx
94
95    if (error) {
96      return (
97        <Layout>
98          <Link to="/" className="btn btn-ghost btn-sm">
99            Back
100          </Link>
101          <p className="error-text">{error}</p>
102        </Layout>
103      );
104    }
```

👉 **Lines 95–104**: **Early return** — if there's an error, render ONLY the error view (with a Back button) and stop. The rest of the component doesn't run.

```jsx
105
106    if (!data) {
107      return (
108        <Layout>
109          <p className="empty">Loading...</p>
110        </Layout>
111      );
112    }
```

👉 **Lines 106–112**: Second early return — while `data` is still `null` (first fetch in flight), show "Loading...". This is a clean **loading state** pattern.

```jsx
113
114    const fmt = (d) => (d ? new Date(d).toLocaleString() : "Never");
```

👉 **Line 114**: Date formatter — converts ISO dates to a human-readable localized string; "Never" if missing.

```jsx
115
116    return (
117      <Layout>
118        <Link to="/" className="btn btn-ghost btn-sm">
119          &larr; Back
120        </Link>
121        <section className="detail">
122          <div className="card detail-card">
123            <div className="detail-title-row">
124              <h2 className="section-title">Analytics</h2>
125              <div className="detail-actions">
126                {!editing && (
127                  <>
128                    <button className="btn btn-ghost btn-sm" onClick={startEdit}>
129                      Edit
130                    </button>
131                    <button
132                      className="btn btn-danger btn-sm"
133                      onClick={handleDelete}
134                      disabled={busy}
135                    >
136                      Delete
137                    </button>
138                  </>
139                )}
140              </div>
141            </div>
```

👉 **Lines 116–141**: Page layout. Edit/Delete buttons only show when NOT editing (`{!editing && ...}`). `&larr;` is the ← arrow character.

```jsx
142            <dl className="detail-rows">
143              <div className={`detail-row ${editing ? "detail-row-edit" : ""}`}>
144                <dt>
145                  {editing ? <label htmlFor="edit-url">Original URL</label> : "Original URL"}
146                </dt>
147                <dd>
148                  {editing ? (
149                    <form className="edit-inline" onSubmit={handleUpdate}>
150                      <input
151                        className="input"
152                        id="edit-url"
153                        type="url"
154                        value={editedUrl}
155                        onChange={(e) => setEditedUrl(e.target.value)}
156                        required
157                        autoFocus
158                      />
159                      <div className="edit-actions">
160                        <button className="btn btn-primary btn-sm" disabled={busy}>
161                          Save
162                        </button>
163                        <button
164                          type="button"
165                          className="btn btn-ghost btn-sm"
166                          onClick={() => setEditing(false)}
167                          disabled={busy}
168                        >
169                          Cancel
170                        </button>
171                      </div>
172                    </form>
173                  ) : (
174                    <a
175                      className="link"
176                      href={data.originalUrl}
177                      target="_blank"
178                      rel="noopener noreferrer"
179                    >
180                      {data.originalUrl}
181                    </a>
182                  )}
183                </dd>
184              </div>
```

👉 **Lines 142–184**: The Original URL row, with a ternary that swaps between:
- **Edit mode** → an inline `<form>` with the URL input + Save/Cancel buttons (`autoFocus` puts the cursor in it).
- **View mode** → a clickable `<a>` link (opens in a new tab via `target="_blank"` with `rel="noopener noreferrer"` — the latter prevents the new page from manipulating the opener, a security best practice).

```jsx
185              <div className="detail-row">
186                <dt>Short URL</dt>
187                <dd>
188                  <a
189                    className="link"
190                    href={`${window.location.origin}/${data.shortCode}`}
191                    target="_blank"
192                    rel="noopener noreferrer"
193                  >
194                    {`${window.location.origin}/${data.shortCode}`}
195                  </a>
196                </dd>
197              </div>
198              <div className="detail-row">
199                <dt>Clicks</dt>
200                <dd>{data.clicks}</dd>
201              </div>
202              <div className="detail-row">
203                <dt>Status</dt>
204                <dd>
205                  <span
206                    className={`status ${
207                      data.status === "Active" ? "status-active" : "status-inactive"
208                    }`}
209                  >
210                    {data.status}
211                  </span>
212                </dd>
213              </div>
214              <div className="detail-row">
215                <dt>Created</dt>
216                <dd>{fmt(data.createdAt)}</dd>
217              </div>
218            </dl>
219            {actionError && <p className="error-text">{actionError}</p>}
```

👉 **Lines 185–219**: Remaining rows — Short URL (a link using the current origin), **Clicks** (the live counter), **Status** (with conditional CSS class `status-active`/`status-inactive`), and Created date. `actionError` shows update/delete errors.

```jsx
220          </div>
221          <div className="card qr-card">
222            <h3 className="qr-title">QR Code</h3>
223            {qr && (
224              <img
225                className="qr"
226                src={qr}
227                alt={`QR code for ${data.shortCode}`}
228              />
229            )}
230          </div>
231        </section>
232      </Layout>
233    );
234  }
```

👉 **Lines 220–234**: The QR card. `{qr && <img src={qr} .../>}` renders the QR image once generated. `<img src>` accepts the data URL directly.

### 💡 Interview questions
1. **How does the click counter update in real time?** → Polling: `setInterval(loadAnalytics, 5000)` + cleanup. Not true real-time; SSE/WebSocket is the upgrade.
2. **Why the `cancelled` flag?** → prevents `setState` after unmount (avoids memory leaks and React warnings).
3. **Why generate the QR on the client?** → zero server load; but it duplicates the backend's stored QR — dead code on the server side.
4. **`target="_blank"` without `rel="noopener noreferrer"` — why is it dangerous?** → the new tab could access `window.opener` (reverse-tabnabbing). The `rel` attributes close that hole.

---

## 5.33 `client/src/index.css` — the design system (605 lines)

**Purpose**: All styling. Implements a **Material You (Material Design 3)** look: pill buttons, tonal surfaces, organic blur shapes, Roboto.

**How it's organized (by section, not every line — CSS is declarative):**

| Section | Lines (approx) | What it defines |
|---------|---------------|-----------------|
| **Root variables** | ~1–30 | `:root` CSS custom properties (design tokens): primary color, surface colors, radius, shadows, font family. Changing one variable re-themes the whole app. |
| **Reset/base** | ~30–60 | `* { box-sizing: border-box }`, `body { font-family: Roboto, ... }`, margin resets. Normalizes browser differences. |
| **Page layout** | `auth-page`, `page`, `.hero` | Centered cards, max-width containers, padding. |
| **Blobs** | `.blob-a`, `.blob-b` | Large blurred circles (organic shapes) with `position: fixed` + `filter: blur()` for the Material aesthetic. `aria-hidden="true"` marks them as decorative for screen readers. |
| **Cards** | `.card`, `.auth-card`, `.detail-card`, `.qr-card` | Rounded, tonal-surface containers with shadows. |
| **Inputs** | `.input` | Full-width, rounded, tonal inputs with focus states. |
| **Buttons** | `.btn`, `.btn-primary`, `.btn-ghost`, `.btn-danger`, `.btn-sm` | Pill buttons; variants for filled/outlined/danger/small. |
| **Form fields** | `.field`, `.form` | Vertical label + input layouts. |
| **URL list** | `.url-list`, `.url-item`, `.url-main`, `.url-short`, `.url-original`, `.clicks` | The "My URLs" list; truncates long originals (`text-overflow: ellipsis`), shows clicks as a chip. |
| **Detail page** | `.detail`, `.detail-row`, `.detail-rows`, `.edit-inline`, `.edit-actions` | Analytics grid rows + inline edit form. |
| **Status** | `.status`, `.status-active`, `.status-inactive` | Green/red status badges. |
| **QR** | `.qr`, `.qr-title` | Rounded QR image. |
| **Text helpers** | `.error-text`, `.empty`, `.link`, `.section-title`, `.brand-center`, `.auth-sub` | Reusable typography + states. |
| **Header** | `.header`, `.header-inner`, `.header-user`, `.brand` | The shared top bar. |

**Key beginner concepts in this file:**
- **CSS variables (tokens)**: `--primary: #6750a4;` etc. defined once, reused everywhere. This is what "design system" means.
- **Specificity & class naming**: every style is attached to a class (`.btn-primary`), so styles don't leak between components — the plain-CSS version of CSS Modules.
- **Responsive**: viewport-based container widths + media queries for smaller screens.

---

## 5.34 `client/src/.env` recap + README

We covered `.env` (VITE_API_URL) and the repo `README.md` (setup + deployment guide) in earlier sections. The README also contains the full API table and the Vercel/Render deployment walkthrough — reread it before interviews; it documents the exact prod wiring (vercel.json rewrite → Render).

---

# PHASE 6: DATABASE UNDERSTANDING

## 6.1 The two collections (MongoDB "tables")

```
┌──────────────────────────────────────────────────────────────────┐
│  users                                                            │
│  ─────                                                             │
│  _id            ObjectId      (PK — auto-generated)               │
│  name           String        required, trimmed                   │
│  email          String        required, UNIQUE index, lowercase   │
│  password       String        required (bcrypt HASH)              │
│  role           String        enum ["user","admin"] → default     │
│                               "user"                              │
│  createdAt      Date          auto (timestamps: true)             │
│  updatedAt      Date          auto (timestamps: true)             │
└───────────────▲──────────────────────────────────────────────────┘
                │ 1
                │ owns
                │ N (createdBy = User._id)
┌───────────────▼──────────────────────────────────────────────────┐
│  urls                                                             │
│  ─────                                                             │
│  _id            ObjectId      (PK — auto-generated)               │
│  originalUrl    String        required                            │
│  shortCode      String        required, UNIQUE index  ← lookup key│
│  clicks         Number        default 0                           │
│  createdBy      ObjectId      ref "User", required  (FK)          │
│  isActive       Boolean       default true                        │
│  expiresAt      Date          default null                        │
│  qrCode         String        default null (data URL)             │
│  createdAt      Date          auto                                │
│  updatedAt      Date          auto                                │
└───────────────────────────────────────────────────────────────────┘
```

## 6.2 Relationships & keys

- **One-to-many**: `User (1) → Url (N)`. One user creates many URLs; each URL belongs to exactly one user (via `createdBy`).
- **Primary keys**: `_id` on both collections (Mongo auto-generates ObjectIds).
- **Unique indexes**: `users.email` (one account per email) and `urls.shortCode` (one link per code — also makes redirect lookup fast).
- **Foreign key**: `urls.createdBy` references `users._id`. ⚠️ MongoDB has **no enforced FK constraints** — integrity is maintained by application code (the `createdBy.toString() !== req.user.id` ownership checks).

## 6.3 Why each table exists

- **users** → stores accounts so only owners can manage their links, and so we can attribute URLs.
- **urls** → stores the core data: the long URL, its short code, the click counter, ownership, lifecycle flags.

## 6.4 Data flow through the system

```
REGISTER:   browser → register() → bcrypt.hash → User.create()
             → document added to `users` with email, name, password(hash)

CREATE URL: browser → createShortUrl() → generateShortCode()
             → Url.create() → doc in `urls` (clicks:0, createdBy:user._id)
             → QRCode.toDataURL() → url.qrCode = ... → url.save()

REDIRECT:   browser → redirectUrl()
             → Redis GET shortCode
                 HIT  → Url.updateOne({$inc:{clicks:1}}) → 302
                 MISS → Url.findOne({shortCode}) → checks → Redis SET
                      → Url.updateOne({$inc:{clicks:1}}) → 302

UPDATE:     browser → updateUrl() → find → owner check → url.originalUrl = ...
             → url.save() → Redis DEL shortCode

DELETE:     browser → deleteUrl() → find → owner check → findOneAndDelete()
             → Redis DEL shortCode → URL gone from both stores
```

---

# PHASE 7: API UNDERSTANDING

## 7.1 Endpoint reference

Base URL: dev `http://localhost:5174/api` · prod `https://url-shortner-3k6y.onrender.com/api`

| Method | Endpoint | Auth | Rate limit | Body / Query |
|--------|----------|------|-----------|--------------|
| POST | `/auth/register` | — | 10/hour | `{name, email, password}` |
| POST | `/auth/login` | — | 10/15min | `{email, password}` |
| GET | `/auth/profile` | Bearer | — | — |
| POST | `/url` | Bearer | 100/min | `{originalUrl}` |
| GET | `/url/my-urls` | Bearer | — | `?page=1&limit=10` |
| PUT | `/url/:shortCode` | Bearer | — | `{originalUrl}` |
| DELETE | `/url/:shortCode` | Bearer | — | — |
| GET | `/url/:shortCode/analytics` | Bearer | — | — |
| GET | `/url/:shortCode/qr` | Bearer | — | — |
| GET | `/url/:shortCode` | **Public** | 1000/min | → 302 redirect |

**Headers**: authenticated endpoints require `Authorization: Bearer <token>`. JSON endpoints use `Content-Type: application/json`.

## 7.2 Worked example — POST /auth/login

**Request**
```http
POST /api/auth/login
Content-Type: application/json

{ "email": "a@b.com", "password": "secret123" }
```

**Success (200)**
```json
{
  "success": true,
  "message": "Login Successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": { "id": "66...", "name": "A", "email": "a@b.com", "role": "user" }
}
```

**Flow**: `Login.jsx` → `api.login` → `fetch` → Vite proxy → `app.js` → `authRoutes` → `loginLimiter` → `login()` → `User.findOne` → `bcrypt.compare` → `jwt.sign` → 200.

**Errors**: `400` missing fields · `401` invalid credentials (identical message — anti-enumeration) · `429` too many attempts · `500` server error.

## 7.3 Worked example — GET /api/url/my-urls?page=1&limit=10

**Success (200)**
```json
{
  "success": true,
  "currentPage": 1,
  "pageSize": 10,
  "totalUrls": 42,
  "totalPages": 5,
  "data": [ { "_id": "...", "originalUrl": "...", "shortCode": "aB3xY9z", "clicks": 7, "isActive": true, "expiresAt": null, "qrCode": "data:image/png;base64,...", "createdAt": "...", "updatedAt": "..." } ]
}
```

## 7.4 Worked example — GET /api/url/aB3xY9z (public redirect)

- **Success**: `302 Location: https://original.com/path` — the browser follows automatically.
- **Errors**: `404` code not found · `403` inactive · `410` expired · `429` too many requests.

---

# PHASE 8: CODE FLOW MAPPING (full execution paths)

## Server boot sequence
```
npm run dev (nodemon server.js)
  → server.js: dotenv.config() loads .env
  → requires ./app (Express configured with CORS, JSON, routes)
  → connectDatabase() → mongoose.connect(MONGODB_URI)  → "MongoDB Connected"
  → redisClient.connect()                              → "Redis Connected"
  → app.listen(5174)                                   → "Server running on port 5174"
```

## Create a short URL (frontend → backend)
```
Home.jsx handleCreate
  → api.createUrl(originalUrl, token)
  → fetch POST (API + /url) + Bearer token
  → Vite proxy /api → Express
  → urlRoutes: [auth verifies JWT → req.user] → [createUrlLimiter] → createShortUrl
       → validator.isURL
       → generateShortCode() (nanoid 7)
       → Url.create(...)
       → QRCode.toDataURL(shortUrl) → url.qrCode = ... → url.save()
  → 201 JSON → Home reloads myUrls → list re-renders
```

## Follow a short link (public hot path)
```
Browser → https://host/aB3xY9z
  → Vercel rewrite → index.html (SPA) → React Router matches "/:shortCode"
  → Redirect.jsx → window.location.replace("/api/url/aB3xY9z")
  → Express GET /api/url/aB3xY9z
  → [redirectLimiter] → redirectUrl()
       redisClient.get("aB3xY9z")
         MISS → Url.findOne → 404/403/410 checks → redis.set → $inc clicks → res.redirect(302)
         HIT  → JSON.parse → $inc clicks → res.redirect(302)
  → Browser follows 302 → original website
```

## The request pipeline in one line
```
Client → [app.use(cors)] → [app.use(express.json)] → route match
      → [middleware chain] → controller → (model/DB/Redis/QR) → HTTP response
```

---

# PHASE 9: DESIGN DECISIONS

## 9.1 Why this architecture

- **Three tiers (React → Express → Mongo/Redis)** = the standard, boring, reliable stack: fast to build, easy to hire for, huge ecosystem.
- **Redis in front of MongoDB** on the redirect path: redirects dominate traffic, are read-heavy and cacheable — Redis gives the biggest performance win for the least code.
- **JWT over sessions**: stateless means any server instance can authenticate anyone — no shared session store needed for horizontal scaling.
- **nanoid over counters**: no DB round-trip, unguessable, collision probability negligible.

## 9.2 Alternatives & tradeoffs

| Decision | Chosen | Alternative | Tradeoff |
|----------|--------|-------------|----------|
| Database | MongoDB | PostgreSQL | Mongo: flexible schema, JSON-native, easy scale. Postgres: ACID, real FKs, better analytics. Both fine at this scale. |
| Cache | Redis | None / in-memory Map | Redis: shared across instances, TTL, atomic ops. In-memory: zero infra but per-instance and lost on restart. |
| Auth | JWT | express-session + cookie | JWT: stateless but no server-side revocation. Sessions: revocable but need a store + sticky sessions. |
| Short code | nanoid(7) | base62 counter / hash of URL | nanoid: O(1), no DB query, random. Counter: sequential (guessable), needs shared counter. |
| QR | Stored in Mongo | Generated on demand | Storing costs one extra write but enables the `/qr` endpoint. Client-side regeneration (what the frontend does) costs zero server CPU. |
| Rate-limit store | In-memory | Redis store | In-memory breaks across multiple instances — must move to Redis store when scaling out. |
| Deploy | Vercel + Render | AWS / Heroku | Cheap, fast, auto-TLS, zero infra management; less control than AWS. |

## 9.3 Scalability concerns

1. **In-memory rate limiters** don't aggregate across server instances.
2. **Skip-based pagination** gets slower on deep pages → cursor/keyset pagination.
3. **No TTL on Redis cache** → stale data risk + unbounded memory for hot codes.
4. **Click increments hit Mongo on every redirect even on cache hit** → write-heavy side effect on the read path. Fix: buffer with Redis `INCR` + periodic flush, or time-series store.
5. **Single Mongo + Redis instances** are single points of failure → replicas/failover needed.
6. **No connection pooling tuning, compression, or API-side CDN.**

## 9.4 Security concerns (interview-critical)

1. ⚠️ **Real secrets committed** in `server/.env` — rotate immediately, gitignore, purge history.
2. **XSS risk**: JWT in `localStorage` is readable by injected scripts → HttpOnly cookie alternative.
3. **Hardcoded `http://localhost:5173`** shortUrl in `createShortUrl` → broken links in production.
4. **`cors()` fully open**; **`helmet` installed but never applied**.
5. **Weak JWT secret**; single long-lived 7d token, no refresh rotation.
6. **No server-side password-strength/email validation** (only browser `type=email`).
7. **Error messages** leak `error.message` in 500 responses — fine in dev, bad in prod.

## 9.5 Performance considerations

- Redis is the main lever: hot redirects skip Mongo entirely.
- QR generation is synchronous + CPU-heavy → briefly blocks the Node event loop.
- 302 (not 301) keeps redirects re-checkable after edits; could add `Cache-Control` for extra CDN caching of safe links.
- Useful Mongoose optimizations at scale: `.lean()`, field projection, compound index `{createdBy, createdAt}`.

---

# PHASE 10: INTERVIEW PREPARATION (Q&A)

## Basic
**Q: What does this app do?**
A: A URL shortener with accounts, click analytics, and QR codes. Paste a long URL → get a short link → share it → track clicks.

**Q: How is a short code generated?**
A: `nanoid(7)` — 7 random URL-safe characters. ~64⁷ ≈ 4.4 trillion combos → collision probability negligible, and it's O(1) with no DB query.

**Q: What's the difference between 302 and 301?**
A: 301 = permanent (browsers cache it forever). 302 = temporary (re-checked each visit). This app uses 302 so edits to a link take effect immediately.

**Q: How are passwords stored?**
A: `bcrypt.hash(password, 10)` — salted hash with cost factor 10; never plaintext. Checked with `bcrypt.compare`.

## Intermediate
**Q: Walk me through the redirect with vs without cache.**
A: Cache hit → Redis returns the URL → `$inc clicks` → 302 (no DB read). Cache miss → Mongo lookup → 404/403/410 checks → write to Redis → `$inc` → 302. The cache turns a DB query into a sub-millisecond Redis read.

**Q: Why delete the Redis key on update/delete?**
A: Cache-aside consistency. The redirect's cache-hit path never re-reads Mongo, so without `redisClient.del` users would keep getting the old URL after an edit.

**Q: How does authentication work?**
A: Login returns a JWT `{id, email, role}` signed with `JWT_SECRET`, 7-day expiry. The client sends `Authorization: Bearer <token>`. The `auth` middleware verifies it and sets `req.user`. Stateless — nothing stored server-side.

**Q: How is ownership enforced?**
A: `url.createdBy.toString() === req.user.id`, else 403. `req.user.id` comes from the server-signed JWT, so it can't be forged by the client.

**Q: What does `$inc` guarantee?**
A: An atomic increment in MongoDB — concurrent redirects to the same code never lose a click (no read-modify-write race).

**Q: Why is the login 401 message identical for "user not found" and "wrong password"?**
A: Anti-enumeration — an attacker can't probe which emails are registered.

## Advanced
**Q: What happens when you scale to multiple instances?**
A: (1) Move rate limiting to a shared Redis store; (2) set `trust proxy` so real IPs are seen behind the LB; (3) add TTL to cache entries; (4) stateless JWT keeps auth working across instances automatically; (5) read replica for Mongo, or move the redirect map fully into Redis.

**Q: How would you handle 1M daily redirects?**
A: Read path is fine (Redis). The write side is the bottleneck: click increments hit Mongo on every redirect. Batch with Redis `INCR` + flush, or a time-series store. Add Redis replicas, TTLs, connection pooling, and CDN caching where safe.

**Q: What if a nanoid collides?**
A: Astronomically unlikely, but the unique index would throw. Production fix: catch duplicate-key error and regenerate (retry loop).

**Q: Why MongoDB and not SQL?**
A: Documents match the JSON API 1:1, schema is flexible (`expiresAt` optional, `qrCode` string), simple lookups, horizontal scale via sharding. Tradeoff: no native FKs — I enforce referential integrity in app code.

**Q: How would you make analytics real-time?**
A: Replace 5s polling with Server-Sent Events or WebSockets, or use Redis PUB/SUB to push click events to connected clients.

## Architecture / Database / API / Security (speed round)
- **Why Express vs NestJS?** → lightweight, middleware model, mature; Nest adds structure for bigger teams.
- **How would you add custom aliases (e.g. `/yt`)?** → optional `customCode` field with uniqueness + a reserved-word denylist.
- **How would you add password reset?** → email service + signed one-time tokens with TTL.
- **What indexes exist?** → `email` unique, `shortCode` unique; recommend `{createdBy, createdAt}`.
- **What's 404 vs 403 vs 410 here?** → 404 missing; 403 not-owner or inactive; 410 expired.
- **How do you prevent brute-force login?** → rate limiter (10/15min) + identical 401s + bcrypt cost.
- **Token in localStorage risks?** → XSS can steal it; HttpOnly cookie is safer but needs CSRF handling.

---

# PHASE 11: PROJECT PRESENTATION

## 30-second version
"I built a full-stack URL shortener — paste a long link, get a short one plus a QR code, and track every click. React frontend, Express API, MongoDB for storage, Redis for fast redirects, JWT auth."

## 1-minute version
Add the flow: register/login → create a short link (nanoid 7 + QR) → share → anyone clicking gets a 302 redirect backed by Redis with a Mongo fallback; every click is an atomic increment; the analytics page polls every 5 seconds. Mention ownership checks and rate limiting.

## 3-minute version (structure: Problem → Solution → Architecture → Flow)
- **Problem**: long ugly URLs, no sharing, no tracking.
- **Solution**: short links + analytics + QR codes.
- **Architecture**: React SPA → Express API → Redis + MongoDB; JWT + bcrypt; rate limiters.
- **Flow**: click short link → React catch-all → `/api/url/:code` → Redis hit/miss → 302. Walk the create flow too.
- **Key decisions**: 302 not 301, nanoid not counter, cache-aside + manual invalidation, atomic `$inc`.
- **Challenges**: cache invalidation on edit, rate-limit scope, hardcoded localhost URL, secrets hygiene.

## 5-minute deep-dive
Add the DB schema walkthrough (users/urls, unique indexes, ownership via ref), the API table, the scale story (Redis absorbs reads; move rate limits to a Redis store; cursor pagination; TTLs), the security story (bcrypt, JWT, identical 401s, localStorage/XSS tradeoff), and future improvements (SSE/WebSocket analytics, custom aliases, cache TTL, password reset, automated tests).

---

# PHASE 12: OWNERSHIP QUESTIONS (strong answers)

**Q: Why did you choose this architecture?**
A: Three-tier React/Express/Mongo is the sweet spot for a small team: fast iteration, huge ecosystem, and each tier has a clear responsibility. Redis specifically because redirects are read-heavy and benefit most from caching.

**Q: Why not another database?**
A: Mongo's document model matches my JSON API directly and my queries are simple (unique-key lookups + count/skip). I don't need multi-table joins or transactions; I enforce ownership in application code. If I needed relational integrity or heavy joins, I'd use Postgres.

**Q: What happens if Redis goes down?**
A: Graceful degradation. The client's error handler logs but doesn't crash, and the redirect path falls back to a Mongo query for every request. Slower, but the app keeps working.

**Q: What if MongoDB goes down?**
A: Hard failure — uncached codes can't resolve and writes fail. Fix: a replica set / managed Atlas cluster for failover, plus keeping hot codes in Redis so some redirects still work.

**Q: How would you scale to 1 million users?**
A: (1) Load-balance stateless API instances (JWT makes it trivial). (2) Move rate limiting to a shared Redis store. (3) Keep the redirect map in Redis with TTLs; batch click writes via Redis INCR. (4) Cursor pagination instead of skip. (5) Mongo read scaling / replicas. (6) CDN + Cache-Control on safe redirects.

**Q: What are the bottlenecks?**
A: (1) Every redirect does a Mongo `$inc` write even on cache hit. (2) In-memory rate limits don't aggregate across instances. (3) Synchronous QR generation blocks the event loop. (4) Skip-pagination at depth. (5) No TTL on cache entries.

**Q: What would you improve first?**
A: Security first: rotate the committed `.env` secrets. Then correctness: derive the shortUrl from the request host and add cache TTLs. Then scale: Redis-backed rate limiting, batched click writes, cursor pagination. Then features: custom aliases, expiry management UI, real-time analytics.

**Q: How do you test this?**
A: Honestly, there are no automated tests today — that's a known gap. I'd add unit tests for `generateShortCode` and the auth controller (jest/vitest), integration tests with supertest + in-memory Mongo, and Playwright E2E for login → create → redirect.

---

# PHASE 13: REVISION NOTES

## One-page project summary
Full-stack Bitly clone. React (Vite) SPA + Express 5 REST API + MongoDB (Mongoose) + Redis cache. JWT auth (bcrypt hashing, 7-day token), nanoid(7) short codes, QR codes, click analytics, ownership checks, rate limiting. Deploy: Vercel (frontend) + Render (backend).

## Architecture cheat sheet
```
SPA → /api/* (proxy) → Express → [auth | rateLimiter] → Controller → Model → MongoDB
                                            │                        └─ Redis (redirect cache)
                                            └─ qrcode
```

## File dependency cheat sheet
- Boot: `server.js` → `app.js` → `routes/*` → `controllers/*` → `models/*` + `config/redis`
- Auth chain: `middleware/auth` → `controllers/authController` → `models/User`
- Redirect chain: `pages/Redirect` → `/api/url/:code` → `redirectLimiter` → `redirectUrl` → Redis/Mongo
- Frontend state: `main.jsx` → `AuthProvider` → `App` guards → `pages/*` → `api.js`

## Interview cheat sheet
- **302 not 301** → edits must take effect
- **nanoid(7)** → 64⁷ ≈ 4.4T combos, no DB round trip
- **Cache-aside** → get → miss → DB → set; `del` on write
- **`$inc`** → atomic click counting
- **Ownership** → `createdBy.toString() === req.user.id`
- **JWT stateless** → horizontal scaling friendly
- **Rate limiters are in-memory** → per-instance (known limitation)
- **Identical 401 message** → anti user-enumeration

## Last-minute revision notes
- Known gaps to volunteer: hardcoded `localhost:5173` shortUrl (`urlController.js:46`), committed secrets in `server/.env`.
- Empty placeholders: `middleware/errorHandler.js`, `utils/validateUrl.js`.
- Installed but unused: `helmet`, `morgan`; unused endpoint: `getQrCode` (client regenerates QR).
- Client polls analytics every 5s; uses `location.replace` for redirects; token in localStorage (XSS tradeoff).
- Route-order gotcha: `/my-urls` is declared before `/:shortCode` so it isn't swallowed by the param route.
- Git history shows incremental fixes (CORS, URL API error, rate limits) — be ready to discuss the debugging journey.

---

## ⚠️ CRITICAL SECURITY ACTION ITEM

`server/.env` contains **live, committed credentials** (MongoDB Atlas username/password, Redis Cloud password, JWT secret). Anyone with repo access can wipe your database and forge tokens.

**Immediate steps:**
1. Rotate all three credentials and change `JWT_SECRET`.
2. `git rm --cached server/.env` and add `server/.env` to `.gitignore`.
3. Purge history with `git filter-repo` (rewrites history — coordinate with teammates).
4. Commit a `server/.env.example` with placeholder values.

---

## GLOSSARY (beginner-friendly)

| Term | Meaning |
|------|---------|
| **SPA** | Single-Page Application — one HTML page; JS swaps content, no full reloads. |
| **REST API** | HTTP endpoints that create/read/update/delete resources via GET/POST/PUT/DELETE. |
| **JWT** | JSON Web Token — a signed string that proves "who you are" without a session. |
| **bcrypt** | Password-hashing algorithm: slow + salted, for storing passwords safely. |
| **Middleware** | A function in the request pipeline: runs before the final handler. |
| **ODM (Mongoose)** | Object-Document Mapper — JS objects ↔ MongoDB documents. |
| **Schema** | The blueprint defining a collection's fields and types. |
| **Model** | The compiled object you use to query a collection. |
| **Cache-aside** | Pattern: check cache → miss → read DB → write cache → return. |
| **Cache invalidation** | Deleting/updating cached data when the source changes. |
| **302/301** | HTTP redirect statuses: temporary vs permanent. |
| **$inc** | MongoDB operator to atomically increment a number. |
| **ObjectId** | MongoDB's auto-generated 24-char document ID. |
| **Data URL** | A URL that embeds data (e.g. the QR image) directly, `data:image/png;base64,...`. |
| **CORS** | Browser rule controlling which origins may call an API. |
| **Proxy** | A server that forwards requests to another server (dev: Vite; prod: Vercel). |
| **Rate limiting** | Blocking requests beyond a threshold per time window. |
| **Event loop** | Node's single-threaded mechanism; long sync work blocks it. |






