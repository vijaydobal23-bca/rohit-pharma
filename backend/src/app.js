const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const { slowDown } = require('express-slow-down');
const hpp = require('hpp');

const authRoutes = require('./routes/auth.routes');
const medicineRoutes = require('./routes/medicine.routes');
const categoryRoutes = require('./routes/category.routes');
const supplierRoutes = require('./routes/supplier.routes');
const inventoryRoutes = require('./routes/inventory.routes');
const billingRoutes = require('./routes/billing.routes');
const customerRoutes = require('./routes/customer.routes');
const employeeRoutes = require('./routes/employee.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const uploadRoutes = require('./routes/upload.routes');

const app = express();

// ============================================================================
// SECURITY LAYER ARCHITECTURE
// ============================================================================

// Layer 1 — Secure HTTP Headers via Helmet
// Configured with cross-origin resource policy so frontend & ImageKit CDN assets load smoothly
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// Layer 2 — Limit Payload Size (prevents large body Denial-of-Service attacks)
// Note: Multer streaming middleware handles multipart/form-data file uploads safely
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Layer 3 — Prevent HTTP Parameter Pollution (HPP)
app.use(hpp());

// Layer 4 — Speed Bump (gradually slow down requests before hard blocking)
const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes window
  delayAfter: 50,           // start adding delay after 50 requests
  delayMs: () => 500,       // add 500ms delay per extra request
  skip: () => process.env.NODE_ENV === 'test', // Skip in automated testing
  validate: { xForwardedForHeader: false },
});
app.use(speedLimiter);

// Layer 5 — Hard Rate Limiting (prevents DDoS and brute-force abuse)
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,                 // Limit each IP to 100 requests per windowMs
  standardHeaders: true,    // Return standard RateLimit-* headers
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again after 15 minutes',
  },
  skip: () => process.env.NODE_ENV === 'test',
  validate: { xForwardedForHeader: false },
});
app.use('/api', globalLimiter);

// Layer 5b — Stricter Brute-Force Rate Limiter for Authentication endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,                  // 20 attempts per 15 min
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many authentication attempts, please try again after 15 minutes',
  },
  skip: () => process.env.NODE_ENV === 'test',
  validate: { xForwardedForHeader: false },
});

// Layer 6 — Block Suspicious User Agents & Vulnerability Scanners
app.use((req, res, next) => {
  // Allow system health check
  if (req.path === '/api/health') return next();

  const ua = (req.headers['user-agent'] || '').toLowerCase();
  const blocked = [
    'sqlmap',
    'nikto',
    'masscan',
    'nmap',
    'acunetix',
    'havij',
    'w3af',
    'zaproxy',
    'dirbuster',
    'gobuster',
  ];

  if (!ua || blocked.some((b) => ua.includes(b))) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
});

// Layer 7 — NoSQL Injection Sanitization (strips MongoDB operators like $gt, $where, etc.)
const sanitizeNoSQL = (data) => {
  if (!data || typeof data !== 'object') return data;
  if (Array.isArray(data)) return data.map(sanitizeNoSQL);
  const clean = {};
  for (const key of Object.keys(data)) {
    if (!key.startsWith('$') && !key.includes('.')) {
      clean[key] = sanitizeNoSQL(data[key]);
    }
  }
  return clean;
};

app.use((req, res, next) => {
  if (req.body) req.body = sanitizeNoSQL(req.body);
  if (req.params) req.params = sanitizeNoSQL(req.params);
  next();
});

// Allowed origins for CORS (supports Vite default ports)
const allowedOrigins = [
  process.env.CLIENT_URL,
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
].filter(Boolean);

// CORS Middlewares
app.use(
  cors({
    origin: (origin, callback) => {
      // allow requests with no origin (like mobile apps or curl)
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, true); // Permissive in dev
    },
    credentials: true,
  })
);

app.use(cookieParser());

// Base Route / Health Check
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'Backend server is running smoothly',
    timestamp: new Date().toISOString(),
  });
});

// Mount Routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/medicines', medicineRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/upload', uploadRoutes);

// 404 Handler for undefined routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Cannot ${req.method} ${req.originalUrl}`,
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  if (err.type === 'entity.too.large' || err.status === 413) {
    return res.status(413).json({
      success: false,
      error: 'Payload Too Large: Request entity exceeds the 10kb limit',
    });
  }
  console.error('Unhandled Error:', err.message || err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
  });
});

module.exports = app;

