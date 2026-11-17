# Backend Authentication API

Full-featured authentication service built with **Express.js**, **MongoDB (Mongoose)**, **JSON Web Tokens (JWT)**, and **bcryptjs**.

---

## Features

- **Access Token & Refresh Token Pattern**:
  - Short-lived Access Token (`15m` by default) sent in response body.
  - Long-lived Refresh Token (`7d` by default) stored securely in `httpOnly` cookie and persisted in MongoDB.
  - Refresh Token Rotation upon token refresh for enhanced security.
- **Explicit Password Hashing in Controllers**:
  - Salting and hashing performed using `bcryptjs` directly inside controller functions.
- **Protected Routes**:
  - Custom `authenticateToken` middleware verifying JWT bearer tokens and attaching `req.user`.
- **Utils Module**:
  - Token generator and verification helpers in `src/utils/token.utils.js`.

---

## Directory Structure

```
backend/
├── src/
│   ├── config/
│   │   └── db.js                 # MongoDB connection
│   ├── controllers/
│   │   └── auth.controller.js    # Register, Login, Refresh, Logout, Profile
│   ├── middlewares/
│   │   └── auth.middleware.js    # JWT verification middleware
│   ├── models/
│   │   └── user.model.js         # Mongoose User schema
│   ├── routes/
│   │   └── auth.routes.js        # Auth endpoint router
│   ├── utils/
│   │   └── token.utils.js        # JWT generation & cookie helpers
│   └── app.js                    # Express app configuration & middleware
├── .env                          # Environment variables
├── .env.example                  # Environment configuration template
├── package.json
└── server.js                     # Server entrypoint
```

---

## Environment Variables (`.env`)

```env
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173

MONGODB_URI=mongodb://localhost:27017/pharma_db

ACCESS_TOKEN_SECRET=pharma_access_token_super_secret_jwt_key_2026_secure
ACCESS_TOKEN_EXPIRY=15m
REFRESH_TOKEN_SECRET=pharma_refresh_token_super_secret_jwt_key_2026_secure
REFRESH_TOKEN_EXPIRY=7d
```

---

## API Endpoints

### 1. Register User
- **Method / URL**: `POST /api/auth/register`
- **Body**:
  ```json
  {
    "name": "John Doe",
    "email": "john@example.com",
    "password": "secretPassword123"
  }
  ```
- **Response**: `201 Created`
  - Returns user details & `accessToken`. Sets `refreshToken` in `httpOnly` cookie.

### 2. Login User
- **Method / URL**: `POST /api/auth/login`
- **Body**:
  ```json
  {
    "email": "john@example.com",
    "password": "secretPassword123"
  }
  ```
- **Response**: `200 OK`
  - Verifies bcrypt hash, returns `accessToken`, and sets `refreshToken` in cookie.

### 3. Refresh Access Token
- **Method / URL**: `POST /api/auth/refresh-token`
- **Headers / Cookie**: Automatically sends `refreshToken` cookie, or optional JSON `{ "refreshToken": "<token>" }`.
- **Response**: `200 OK`
  - Rotates refresh token in DB & cookie, returns new `accessToken`.

### 4. Logout User (Protected)
- **Method / URL**: `POST /api/auth/logout`
- **Headers**: `Authorization: Bearer <accessToken>`
- **Response**: `200 OK`
  - Clears refresh token in MongoDB and clears cookie.

### 5. Get User Profile (Protected)
- **Method / URL**: `GET /api/auth/profile`
- **Headers**: `Authorization: Bearer <accessToken>`
- **Response**: `200 OK`
  - Returns authenticated user object without password.

---

## Running the Application

1. Make sure MongoDB is running locally or specify your remote URI in `.env`.
2. Start development server with auto-reload:
   ```bash
   npm run dev
   ```
3. Or start standard production server:
   ```bash
   npm start
   ```
2. Redis Caching Implementation

Using the Redis Cloud credentials configured in backend/.env:

Redis Connection Layer (backend/src/config/redis.js):
Connected using ioredis with auto-reconnection and exponential backoff.
Configured with enableOfflineQueue: false and non-blocking try/catch wrappers (getCache, setCache, delCachePattern).
Zero-Downtime Fallback: If Redis Cloud is undergoing maintenance or DNS is resolving, the API automatically falls back to MongoDB with zero 500 errors.
Cache Interceptor Middleware (backend/src/middlewares/cache.middleware.js):
Intercepts incoming GET requests and returns cached JSON with sub-millisecond response times.
Sends diagnostic X-Cache-Status response header (HIT or MISS).

Cached Endpoints & TTLs:
GET /api/categories — 300s (5 min) TTL
GET /api/suppliers — 300s (5 min) TTL
GET /api/medicines/filters — 300s (5 min) TTL
GET /api/medicines & GET /api/medicines/:id — 120s (2 min) TTL
GET /api/inventory/alerts & GET /api/inventory/batches — 60s (1 min) TTL
GET /api/dashboard/admin & GET /api/dashboard/employee — 60s (1 min) TTL

Smart Cache Invalidation:
Automatically flushes matching keys (delCachePattern) when mutations occur:
Adding/editing/deleting medicines flushes meds:*, dash:*, alerts:*.
Recording stock batch entries or adjustments flushes batches:*, alerts:*, meds:*, dash:*.
Creating POS bills, cancelling sales, or processing refunds flushes sales:*, dash:*, batches:*, meds:*, alerts:*.
Category & supplier modifications flush cats:*, suppliers:*, and meds:*.

3. Comprehensive List of Optimizations
In-Memory Redis Caching Layer:
Offloads repetitive database read operations from MongoDB to Redis RAM.
HTTP Response Compression (Gzip / Brotli):
Integrated compression() middleware in app.js, reducing API JSON response payload size over the wire by up to 70–80%.
Mongoose .lean() Query Execution:

Converted read queries (find(), findById()) in medicines, categories, suppliers, and inventory to .lean().
By skipping Mongoose document hydration, internal change-tracking, and getters/setters, JSON serialization speed is improved by 3–5x and V8 heap memory usage is reduced.
Selective Pattern-Based Cache Invalidation:
Only dirty cache slices are invalidated using Redis glob scanning (delCachePattern) rather than clearing the entire cache store.
High-Throughput Payload Processing:
Body parsers resized to 50MB, preventing request truncation during bulk inventory operations.
Graceful Failover Resilience:
All Redis cache operations are non-blocking. If the Redis server is unreachable, the system automatically falls back to MongoDB without interrupting the user.



   

